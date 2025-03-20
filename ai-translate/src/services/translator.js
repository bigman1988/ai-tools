/**
 * 翻译服务类
 */
export class TranslationService {
    /**
     * 创建翻译服务实例
     * @param {string} apiKey - API密钥
     * @param {Function} logCallback - 日志回调函数
     */
    constructor(apiKey, logCallback) {
        this.apiEndpoint = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        // 优先使用传入的API密钥，如果没有则使用环境变量中的密钥
        this.apiKey = apiKey || process.env.DEEPSEEK_API_KEY || '';
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
                if (process.env.DEEPSEEK_API_KEY) {
                    this.apiKey = process.env.DEEPSEEK_API_KEY;
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
                
                console.log(`翻译批次 - 目标语言: ${validTasks[0].targetLang}, 共${validTasks.length}个任务`);
                
                // 获取目标语言
                const targetLang = validTasks[0].targetLang;
                
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
                
                this.logCallback(`批次 ${batch.batchId} 翻译失败: ${error.message || error}`, 'error');
                // 标记翻译失败
                batch.success = false;
                return false;
            }
            
            // 标记批次已完成
            batch.completed = batch.tasks.length;
            
        } catch (error) {
            console.error('批次翻译失败:', error);
            
            // 打印错误堆栈和批次详细信息
            console.error('错误堆栈:', error.stack || '无堆栈信息');
            console.error('批次详细信息:', {
                batchId: batch.batchId,
                taskCount: batch.tasks.length,
                tasks: batch.tasks.map(task => ({
                    rowIndex: task.rowIndex,
                    text: task.text ?  task.text : null,
                    textType: typeof task.text
                }))
            });
            
            this.logCallback(`批次翻译失败: ${error.message || error}`, 'error');
            // 标记翻译失败
            batch.success = false;
            return false;
        }
    }
    
    /**
     * 处理批次
     * @param {Array} batches - 批次数组
     * @param {string} sourceLanguage - 源语言
     * @param {Function} updateProgressCallback - 更新进度回调
     * @param {Function} [updateCellCallback] - 更新单元格回调
     * @returns {Promise<void>}
     */
    async processBatches(
        batches, 
        sourceLanguage,
        updateProgressCallback,
        updateCellCallback
    ) {
        const totalBatches = batches.length;
        let completedBatches = 0;
        
        this.logCallback(`开始处理 ${totalBatches} 个翻译批次`, 'info');
        
        for (let i = 0; i < batches.length; i++) {
            if (this.shouldStopTranslation) {
                this.logCallback('翻译已被用户停止', 'warning');
                break;
            }
            
            const batch = batches[i];
            const currentBatchId = i + 1;
            
            // 更新进度
            updateProgressCallback({
                completedBatches,
                totalBatches,
                currentBatchId,
                completedTasksInCurrentBatch: 0,
                totalTasksInCurrentBatch: batch.tasks.length
            });
            
            try {
                const success = await this.translateBatch(batch, sourceLanguage);
                completedBatches++;
                
                // 更新进度
                updateProgressCallback({
                    completedBatches,
                    totalBatches,
                    currentBatchId: 0, // 当前批次已完成
                    completedTasksInCurrentBatch: batch.tasks.length,
                    totalTasksInCurrentBatch: batch.tasks.length
                });
                
                // 只有翻译成功时才更新单元格
                if (success && updateCellCallback) {
                    updateCellCallback(batch);
                }
                
                this.logCallback(`批次 ${currentBatchId}/${totalBatches} 完成`, 'success');
            } catch (error) {
                this.logCallback(`批次 ${currentBatchId}/${totalBatches} 失败`, 'error');
            }
        }
        
        this.logCallback(`翻译任务完成: ${completedBatches}/${totalBatches} 个批次`, 
            completedBatches === totalBatches ? 'success' : 'warning');
    }
}
