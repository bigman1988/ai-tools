/**
 * 翻译服务类
 */
import { embeddingService } from './embedding-instance.js';
import fetch from 'node-fetch';
import { LanguageUtils } from '../utils/LanguageUtils.js';

export class TranslationService {
    /**
     * 创建翻译服务实例
     * @param {string} apiKey - API密钥
     * @param {Function} logCallback - 日志回调函数
     */
    constructor(apiKey, logCallback) {
        this.apiEndpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        // 优先使用传入的API密钥，如果没有则使用环境变量中的密钥
        this.apiKey = apiKey || process.env.ALI_API_KEY || '';
        this.logCallback = logCallback || console.log;
        this.shouldStopTranslation = false;
        
        if (this.apiKey) {
            console.log('已成功加载API密钥');
        }
    }

    /**
     * 停止翻译
     */
    stopTranslation() {
        this.shouldStopTranslation = true;
    }

    /**
     * 重置停止标志
     */
    resetStopFlag() {
        this.shouldStopTranslation = false;
    }

    /**
     * 从知识库中获取翻译记忆
     * @param {string} text - 源文本
     * @param {string} sourceLanguage - 源语言
     * @param {string} targetLanguage - 目标语言
     * @returns {Promise<Array>} - 翻译记忆列表
     */
    async getTranslationMemory(text, sourceLanguage, targetLanguage) {
        try {
            if (!text || text.trim() === '') {
                return [];
            }

            // 将语言代码转换为标准格式
            const standardSourceLang = LanguageUtils.getApiLanguageCode(sourceLanguage);
            const standardTargetLang = LanguageUtils.getApiLanguageCode(targetLanguage);

            // 确定向量搜索的语言类型
            const vectorLanguage = standardSourceLang === 'Chinese' ? 'chinese' : 'english';
            
            try {
                // 搜索相似的翻译条目
                const similarEntries = await embeddingService.searchSimilar(text, vectorLanguage, 3);
                
                // 如果没有找到相似条目，返回空数组
                if (!similarEntries || similarEntries.length === 0) {
                    console.log('未找到相似的翻译记忆');
                    return [];
                }
                
                // 确定源语言和目标语言在数据库中的字段名
                const sourceField = standardSourceLang;
                const targetField = standardTargetLang;
                
                console.log(`构建翻译记忆 - 源语言字段: ${sourceField}, 目标语言字段: ${targetField}`);
                
                // 构建翻译记忆列表
                const tmList = [];
                
                for (const entry of similarEntries) {
                    // 检查条目是否有效
                    if (!entry) {
                        console.log('跳过翻译记忆: 条目为空');
                        continue;
                    }
                    
                    // 输出完整的条目以便调试
                    console.log('翻译记忆条目:', JSON.stringify(entry));
                    
                    // 获取源语言和目标语言的文本
                    // 由于Qdrant中的字段名是首字母大写的，直接使用标准格式
                    const sourceText = entry[sourceField] || '';
                    const targetText = entry[targetField] || '';
                    
                    // 只有当源和目标都有值时才添加到翻译记忆
                    if (sourceText && targetText && sourceText.trim() !== '' && targetText.trim() !== '') {
                        tmList.push({
                            source: sourceText,
                            target: targetText
                        });
                        console.log(`添加翻译记忆: ${sourceText} -> ${targetText}`);
                    } else {
                        if (!sourceText || sourceText.trim() === '') {
                            console.log(`跳过翻译记忆: 源语言字段为空`);
                        }
                        if (!targetText || targetText.trim() === '') {
                            console.log(`跳过翻译记忆: 目标语言字段为空, 条目中的字段: ${Object.keys(entry).join(', ')}`);
                        }
                    }
                }
                
                console.log(`找到 ${tmList.length} 条翻译记忆`);
                return tmList;
            } catch (vectorError) {
                // 向量搜索失败，记录错误但不中断翻译流程
                console.error('向量搜索失败，将跳过翻译记忆匹配:', vectorError.message);
                return [];
            }
        } catch (error) {
            console.error('获取翻译记忆失败:', error);
            // 出错时返回空数组，允许翻译流程继续
            return [];
        }
    }

    /**
     * 翻译批次
     * @param {Object} batch - 翻译批次
     * @param {string} sourceLanguage - 源语言
     * @returns {Promise<boolean>} - 是否成功
     */
    async translateBatch(batch, sourceLanguage) {
        try {
            // 确保batch和batch.tasks存在
            if (!batch || !batch.tasks || !Array.isArray(batch.tasks) || batch.tasks.length === 0) {
                console.error('错误: 无效的批量翻译任务', batch);
                this.logCallback('错误: 无效的批量翻译任务', 'error');
                return false;
            }
            
            // 获取批次的行号范围
            const rowIndices = batch.tasks.map(task => task.rowIndex + 3); // +3 因为用户看到的Excel行号从1开始，加上有两行头部
            const minRow = Math.min(...rowIndices);
            const maxRow = Math.max(...rowIndices);
            const rowRange = minRow === maxRow ? `第 ${minRow} 行` : `第 ${minRow} 行到第 ${maxRow} 行`;
            
            // 确保sourceLanguage和targetLang正确设置
            const sourceLang = sourceLanguage || 'zh';
            
            // 检查目标语言是否存在
            if (!batch.tasks[0].targetLang && !batch.tasks[0].targetLanguage && !batch.tasks[0].to) {
                console.error('错误: 目标语言未定义', batch.tasks[0]);
                this.logCallback('错误: 目标语言未定义', 'error');
                return false;
            }
            
            // 获取目标语言，优先使用targetLanguage字段
            const targetLang = batch.tasks[0].targetLanguage || batch.tasks[0].targetLang || batch.tasks[0].to || 'en';
            
            this.logCallback(`开始翻译批次 ${batch.batchId} - ${sourceLang} 到 ${targetLang} - ${rowRange} - ${batch.tasks.length}个任务`, 'info');
            
            // 只在调试模式下打印详细任务信息
            if (process.env.NODE_ENV === 'development') {
                console.log(`开始翻译批次 - ${batch.tasks.length}个任务:`, batch.tasks);
            }
            
            // 再次尝试从环境变量获取API密钥
            if (!this.apiKey || (typeof this.apiKey === 'string' && this.apiKey.trim() === '')) {
                if (process.env.ALI_API_KEY) {
                    this.apiKey = process.env.ALI_API_KEY;
                    console.log('从环境变量获取到API密钥');
                } else {
                    const error = new Error('错误：API密钥未设置');
                    console.error(error);
                    this.logCallback(error.message, 'error');
                    throw error;
                }
            }
            
            // 过滤掉空文本任务或非字符串任务
            const validTasks = batch.tasks.filter(task => {
                try {
                    // 如果任务文本不是字符串，尝试转换
                    if (typeof task.text !== 'string') {
                        console.error(`警告: 任务文本不是字符串，类型为 ${typeof task.text}`);
                        if (task.text === null || task.text === undefined) {
                            return false; // 跳过 null 或 undefined
                        }
                        // 尝试转换为字符串
                        task.text = String(task.text);
                    }
                    return task.text.trim() !== '';
                } catch (error) {
                    console.error(`过滤任务时出错:`, error, task);
                    return false; // 如果出错，跳过该任务
                }
            });
            if (validTasks.length === 0) {
                this.logCallback('批次中没有有效的翻译任务', 'warning');
                return false;
            }
            
            if (this.shouldStopTranslation) {
                console.log('翻译被用户停止');
                this.logCallback('翻译被用户停止', 'warning');
                return false;
            }

            try {
                // 检查是否有有效任务
                if (validTasks.length === 0) {
                    this.logCallback('没有有效的翻译任务', 'warning');
                    return false;
                }
                
                // 检查目标语言是否存在
                if (!validTasks[0].targetLanguage && !validTasks[0].targetLang && !validTasks[0].to) {
                    console.error('错误: 目标语言未定义', validTasks[0]);
                    this.logCallback('错误: 目标语言未定义', 'error');
                    return false;
                }
                
                console.log(`翻译批次 - 目标语言: ${validTasks[0].targetLanguage || validTasks[0].targetLang || validTasks[0].to}, 共${validTasks.length}个任务`);
                
                // 获取目标语言，优先使用targetLanguage字段
                const targetLang = validTasks[0].targetLanguage || validTasks[0].targetLang || validTasks[0].to;
                
                console.log(`翻译批次 - 目标语言: ${targetLang}, 共${validTasks.length}个任务`);
                
                // 如果批次中只有一个任务，使用单个翻译方法
                if (validTasks.length === 1) {
                    const task = validTasks[0];
                    const success = await this.translateSingle(task, sourceLanguage);
                    batch.success = success;
                    return success;
                }
                
                // 使用JSON格式组织翻译请求和处理结果
                // 创建带有ID的源文本数组
                const sourceTexts = validTasks.map((t, idx) => ({
                    id: idx,
                    text: t.text
                }));
                
                const requestBody = {
                    model: "deepseek-v3",
                    messages: [
                        {
                            role: "system",
                            content: `你是一个专业的翻译助手。请将以下${LanguageUtils.getLanguageName(sourceLang)}文本翻译成${LanguageUtils.getLanguageName(targetLang)}。

我将提供一个JSON格式的数组，其中包含多个对象，每个对象有id和text字段。请将每个对象的text字段翻译成${LanguageUtils.getLanguageName(targetLang)}，并返回一个新的JSON格式数组，包含原始id和翻译后的文本。

返回格式应为: [{"id": 0, "translation": "翻译结果1"}, {"id": 1, "translation": "翻译结果2"}, ...]

只返回翻译结果的JSON数组，不要添加任何解释或额外内容。重要：不要翻译特殊标记<color=#xxxxxx>,</color>,//n 等，这些是格式标记或特殊字符，应原样保留。`
                        },
                        {
                            role: "user",
                            content: JSON.stringify(sourceTexts)
                        }
                    ],
                    temperature: 0.3,
                    max_tokens: 8000 // 增加最大token数限制，因为我们现在一次翻译多条
                };
                
                // 打印请求体
                console.log('发送翻译请求体:', JSON.stringify(requestBody, null, 2));
                
                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${typeof this.apiKey === 'string' ? this.apiKey.trim() : this.apiKey}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`翻译API错误 - 状态码: ${response.status}, 错误信息:`, errorText);
                    this.logCallback(`翻译API错误: ${response.status} - ${errorText}`, 'error');
                    throw new Error(`翻译API错误: ${response.status}`);
                }

                const responseText = await response.text();
                
                // 打印API响应
                console.log('API原始响应:', responseText);
                
                const data = JSON.parse(responseText);
                
                // 打印解析后的数据
                console.log('解析后的响应数据:', JSON.stringify(data, null, 2));
                
                if (!data.choices?.[0]?.message?.content) {
                    console.error('翻译返回数据格式错误:', data);
                    this.logCallback('翻译返回数据格式错误', 'error');
                    throw new Error('翻译返回数据格式错误');
                }

                // 获取翻译结果并分配给每个任务
                const translatedContent = data.choices[0].message.content;
                console.log('原始翻译结果:', translatedContent);
                
                let translatedResults = [];
                try {
                    // 尝试提取JSON部分
                    const jsonMatch = translatedContent.match(/\[\s*\{.*\}\s*\]/s);
                    const jsonContent = jsonMatch ? jsonMatch[0] : translatedContent;
                    
                    // 解析JSON结果
                    translatedResults = JSON.parse(jsonContent);
                    console.log(`成功解析JSON翻译结果，包含 ${translatedResults.length} 个条目`);
                } catch (parseError) {
                    console.error('解析JSON翻译结果失败:', parseError);
                    this.logCallback(`解析翻译结果失败: ${parseError.message}`, 'error');
                    throw new Error(`解析翻译结果失败: ${parseError.message}`);
                }
                
                // 创建一个映射来存储ID和翻译结果
                const translationMap = {};
                for (const result of translatedResults) {
                    if (result.id !== undefined && result.translation) {
                        translationMap[result.id] = result.translation;
                        console.log(`解析翻译结果 - ID ${result.id}: ${result.translation}`);
                    }
                }
                
                // 将翻译结果分配给每个任务
                let translatedCount = 0;
                for (let i = 0; i < validTasks.length; i++) {
                    if (translationMap[i] !== undefined) {
                        // 设置translation字段而不是覆盖text字段
                        validTasks[i].translation = translationMap[i];
                        console.log(`翻译成功 - 行号: ${validTasks[i].rowIndex + 1}, 译文: ${validTasks[i].translation}`);
                        translatedCount++;
                    } else {
                        console.log(`未找到ID ${i} 的翻译结果`);
                    }
                }
                
                // 如果有任务没有收到翻译结果，记录警告
                if (translatedCount < validTasks.length) {
                    const missingCount = validTasks.length - translatedCount;
                    this.logCallback(`警告: ${missingCount} 个任务没有收到翻译结果`, 'warning');
                }
                
                // 标记翻译成功
                batch.success = true;
                return true;
                
            } catch (error) {
                console.error(`批量翻译失败 - 批次 ${batch.batchId}`, error);
                
                // 打印批次信息以帮助调试
                console.error('批次任务详情:', batch.tasks.map(task => ({
                    rowIndex: task.rowIndex,
                    text: task.text,
                    textType: typeof task.text
                })));
                
                this.logCallback(`翻译失败: ${error.message}`, 'error');
                
                // 标记翻译失败
                batch.success = false;
                return false;
            }
        } catch (error) {
            console.error('翻译批次失败:', error);
            this.logCallback(`翻译失败: ${error.message}`, 'error');
            return false;
        }
    }

    /**
     * 翻译单个任务
     * @param {Object} task - 翻译任务
     * @param {string} sourceLanguage - 源语言
     * @returns {Promise<boolean>} - 是否成功
     */
    async translateSingle(task, sourceLanguage) {
        try {
            // 确保sourceLanguage和targetLang正确设置
            const sourceLang = sourceLanguage || (task.from === 'zh' ? 'Chinese' : 'English');
            
            // 处理目标语言，优先使用targetLanguage字段
            const targetLang = task.targetLanguage || task.targetLang || task.to || 'English';
            
            console.log(`开始单个翻译 - 源语言: ${sourceLang}, 目标语言: ${targetLang}, 文本: ${task.text}`);
            
            // // 获取翻译记忆
            // const tmList = await this.getTranslationMemory(task.text, sourceLang, targetLang);
            
            // 构建DeepSeek翻译API请求体
            const requestBody = {
                model: "deepseek-r1",
                messages: [
                    {
                        role: "system",
                        content: `你是一个专业的翻译助手。请将以下${LanguageUtils.getLanguageName(sourceLang)}文本翻译成${LanguageUtils.getLanguageName(targetLang)}，只返回翻译结果，不要添加任何解释或额外内容。`
                    },
                    {
                        role: "user",
                        content: task.text
                    }
                ],
                temperature: 0.3,
                max_tokens: 2000
            };
            
            // // 如果有翻译记忆，添加到系统提示中
            // if (tmList && tmList.length > 0) {
            //     let tmPrompt = "参考以下翻译记忆进行翻译:\n";
            //     tmList.forEach((tm, index) => {
            //         tmPrompt += `参考${index + 1}: ${tm.source} => ${tm.target}\n`;
            //     });
            //     requestBody.messages[0].content = tmPrompt + requestBody.messages[0].content;
            //     console.log(`使用 ${tmList.length} 条翻译记忆`);
            // }
            
            // 打印请求体
            console.log('发送单个翻译请求体:', JSON.stringify(requestBody, null, 2));
            
            // 发送API请求 - 仍使用通义千问的API端点
            const response = await fetch(this.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${typeof this.apiKey === 'string' ? this.apiKey.trim() : this.apiKey}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`单个翻译API错误 - 状态码: ${response.status}, 错误信息:`, errorText);
                this.logCallback(`翻译API错误: ${response.status} - ${errorText}`, 'error');
                throw new Error(`翻译API错误: ${response.status}`);
            }
            
            const responseText = await response.text();
            console.log('单个翻译API原始响应:', responseText);
            
            const data = JSON.parse(responseText);
            console.log('单个翻译解析后的响应数据:', JSON.stringify(data, null, 2));
            
            if (!data.choices?.[0]?.message?.content) {
                console.error('翻译返回数据格式错误:', data);
                this.logCallback('翻译返回数据格式错误', 'error');
                throw new Error('翻译返回数据格式错误');
            }
            
            // 获取翻译结果
            const translatedContent = data.choices[0].message.content;
            task.text = typeof translatedContent === 'string' ? 
                translatedContent.trim() : String(translatedContent);
            
            console.log(`单个翻译成功 - 行号: ${task.rowIndex + 1}, 译文: ${task.text}`);
            return true;
            
        } catch (error) {
            console.error('单个翻译失败:', error);
            this.logCallback(`翻译失败: ${error.message}`, 'error');
            return false;
        }
    }
}

// 导出翻译服务实例
export const translationService = new TranslationService();
