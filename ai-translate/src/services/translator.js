/**
 * 翻译服务类
 */
import { embeddingService } from './embedding-instance.js';
import fetch from 'node-fetch';

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

            // 确定向量搜索的语言类型
            const vectorLanguage = sourceLanguage === 'Chinese' ? 'chinese' : 'english';
            
            // 搜索相似的翻译条目
            const similarEntries = await embeddingService.searchSimilar(text, vectorLanguage, 5);
            
            // 如果没有找到相似条目，返回空数组
            if (!similarEntries || similarEntries.length === 0) {
                console.log('未找到相似的翻译记忆');
                return [];
            }
            
            // 确定源语言和目标语言在数据库中的字段名
            const sourceField = sourceLanguage === 'Chinese' ? 'Chinese' : 'English';
            let targetField;
            
            // 根据目标语言确定字段名
            switch (targetLanguage) {
                case 'Japanese': targetField = 'Japanese'; break;
                case 'Korean': targetField = 'Korean'; break;
                case 'Spanish': targetField = 'Spanish'; break;
                case 'French': targetField = 'French'; break;
                case 'German': targetField = 'German'; break;
                case 'Russian': targetField = 'Russian'; break;
                case 'Thai': targetField = 'Thai'; break;
                case 'Italian': targetField = 'Italian'; break;
                case 'Indonesian': targetField = 'Indonesian'; break;
                case 'Portuguese': targetField = 'Portuguese'; break;
                case 'English': targetField = 'English'; break;
                case 'Chinese': targetField = 'Chinese'; break;
                default: targetField = targetLanguage;
            }
            
            // 构建翻译记忆列表
            const tmList = [];
            
            for (const entry of similarEntries) {
                const source = entry.payload[sourceField];
                const target = entry.payload[targetField];
                
                // 只有当源和目标都有值时才添加到翻译记忆
                if (source && target && source.trim() !== '' && target.trim() !== '') {
                    tmList.push({
                        source: source,
                        target: target
                    });
                }
            }
            
            console.log(`找到 ${tmList.length} 条翻译记忆`);
            return tmList;
        } catch (error) {
            console.error('获取翻译记忆失败:', error);
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
            // 获取批次的行号范围
            const rowIndices = batch.tasks.map(task => task.rowIndex + 3); // +3 因为用户看到的Excel行号从1开始，加上有两行头部
            const minRow = Math.min(...rowIndices);
            const maxRow = Math.max(...rowIndices);
            const rowRange = minRow === maxRow ? `第 ${minRow} 行` : `第 ${minRow} 行到第 ${maxRow} 行`;
            
            // 获取源语言和目标语言
            const targetLang = batch.tasks.length > 0 ? batch.tasks[0].targetLang : '未知';
            
            this.logCallback(`开始翻译批次 ${batch.batchId} - ${sourceLanguage} 到 ${targetLang} - ${rowRange} - ${batch.tasks.length}个任务`, 'info');
            
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
                if (!validTasks[0].targetLang) {
                    console.error('错误: 目标语言未定义', validTasks[0]);
                    this.logCallback('错误: 目标语言未定义', 'error');
                    return false;
                }
                
                console.log(`翻译批次 - 目标语言: ${validTasks[0].targetLang}, 共${validTasks.length}个任务`);
                
                // 获取目标语言
                const targetLang = validTasks[0].targetLang;
                
                // 如果批次中只有一个任务，使用单个翻译方法
                if (validTasks.length === 1) {
                    const task = validTasks[0];
                    const success = await this.translateSingle(task, sourceLanguage);
                    batch.success = success;
                    return success;
                }
                
                // 收集所有任务的文本和目标语言
                const response = await fetch(this.apiEndpoint, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${typeof this.apiKey === 'string' ? this.apiKey.trim() : this.apiKey}`,
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        model: "qwen-mt-turbo",
                        messages: [
                            {
                                role: "user",
                                content: validTasks.map(t => t.text).join('\n')
                            }
                        ],
                        translation_options: {
                            source_lang: sourceLanguage,
                            target_lang: validTasks[0].targetLang // 批次中所有任务都是相同的目标语言
                        },
                        temperature: 0.7,
                        max_tokens: 2000 // 增加最大token数限制，因为我们现在一次翻译多条
                    })
                });

                if (!response.ok) {
                    const errorText = await response.text();
                    console.error(`翻译API错误 - 状态码: ${response.status}, 错误信息:`, errorText);
                    this.logCallback(`翻译API错误: ${response.status} - ${errorText}`, 'error');
                    throw new Error(`翻译API错误: ${response.status}`);
                }

                const responseText = await response.text();
                
                // 只在开发模式下打印API响应
                if (process.env.NODE_ENV === 'development') {
                    console.log('API原始响应:', responseText);
                }
                
                const data = JSON.parse(responseText);
                
                // 只在开发模式下打印解析后的数据
                if (process.env.NODE_ENV === 'development') {
                    console.log('解析后的响应数据:', data);
                }
                
                if (!data.choices?.[0]?.message?.content) {
                    console.error('翻译返回数据格式错误:', data);
                    this.logCallback('翻译返回数据格式错误', 'error');
                    throw new Error('翻译返回数据格式错误');
                }

                // 获取翻译结果并分配给每个任务
                const translatedContent = data.choices[0].message.content;
                const translatedLines = typeof translatedContent === 'string' ? 
                    translatedContent.trim().split('\n') : 
                    [String(translatedContent)];
                console.log(`收到 ${translatedLines.length} 行翻译结果，共 ${validTasks.length} 个任务`);
                
                // 确保翻译结果行数与任务数量匹配
                const minLength = Math.min(translatedLines.length, validTasks.length);
                
                for (let i = 0; i < minLength; i++) {
                    const translatedLine = translatedLines[i];
                    validTasks[i].text = typeof translatedLine === 'string' ? 
                        translatedLine.trim() : String(translatedLine);
                    console.log(`翻译成功 - 行号: ${validTasks[i].rowIndex + 1}, 译文: ${validTasks[i].text}`);
                }
                
                // 如果翻译结果行数少于任务数量，记录错误
                if (translatedLines.length < validTasks.length) {
                    const missingCount = validTasks.length - translatedLines.length;
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
            console.log(`开始单个翻译 - 源语言: ${sourceLanguage}, 目标语言: ${task.targetLang}, 文本: ${task.text}`);
            
            // 获取翻译记忆
            const tmList = await this.getTranslationMemory(task.text, sourceLanguage, task.targetLang);
            
            // 构建API请求体
            const requestBody = {
                model: "qwen-mt-turbo",
                messages: [
                    {
                        role: "user",
                        content: task.text
                    }
                ],
                translation_options: {
                    source_lang: sourceLanguage,
                    target_lang: task.targetLang
                },
                temperature: 0.7,
                max_tokens: 1000
            };
            
            // 如果有翻译记忆，添加到请求中
            if (tmList && tmList.length > 0) {
                requestBody.translation_options.tm_list = tmList;
                console.log(`使用 ${tmList.length} 条翻译记忆`);
            }
            
            // 发送API请求
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
            
            const data = await response.json();
            
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
