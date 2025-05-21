import { TranslationService, translationService } from './translator.js';

/**
 * 翻译管理器
 */
export class TranslationManager {
    /**
     * 创建翻译管理器
     * @param {string} apiKey - API密钥
     * @param {Function} logCallback - 日志回调函数
     * @param {Object} progressBar - 进度条对象
     */
    constructor(apiKey, logCallback, progressBar) {
        this.apiKey = apiKey;
        this.log = logCallback;
        this.progressBar = progressBar;
        this.shouldStopTranslation = false;
    }

    /**
     * 停止翻译
     */
    stopTranslation() {
        this.shouldStopTranslation = true;
    }

    /**
     * 创建批次
     * @param {Array} items - 项目数组
     * @param {number} batchSize - 批次大小
     * @returns {Array} - 批次数组
     */
    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    /**
     * 准备翻译任务
     * @param {Array} rows - 数据行
     * @param {number} sourceColumnIndex - 源文本列索引
     * @param {Array} targetColumns - 目标列配置
     * @returns {Array} - 翻译任务数组
     */
    prepareTranslationTasks(rows, sourceColumnIndex, targetColumns) {
        const translationTasks = [];
        
        // 遍历所有行，收集需要翻译的任务
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            
            // 检查源文本是否存在
            const sourceText = row[sourceColumnIndex];
            if (!sourceText || typeof sourceText !== 'string' || sourceText.trim() === '') {
                continue; // 跳过空源文本
            }
            
            // 遍历所有目标列
            for (const targetColumn of targetColumns) {
                const targetColumnIndex = targetColumn.index;
                // 使用targetLang属性，如果不存在则使用langCode属性
                const targetLang = targetColumn.targetLang || targetColumn.langCode;
                
                // 检查目标单元格是否已有内容
                const targetText = row[targetColumnIndex];
                if (targetText && typeof targetText === 'string' && targetText.trim() !== '') {
                    continue; // 跳过已有内容的目标单元格
                }
                
                // 创建翻译任务
                translationTasks.push({
                    rowIndex,
                    sourceColumnIndex,
                    targetColumnIndex,
                    targetLang,
                    text: sourceText
                });
            }
        }
        
        return translationTasks;
    }
    
    /**
     * 将任务按目标语言分组并组织成批次
     * @param {Array} tasks - 翻译任务数组
     * @param {number} batchSize - 批次大小
     * @returns {Array} - 批次数组
     */
    organizeTasksIntoBatches(tasks, batchSize = 25) {
        // 按目标语言分组
        const tasksByLanguage = {};
        for (const task of tasks) {
            const lang = task.targetLang;
            if (!tasksByLanguage[lang]) {
                tasksByLanguage[lang] = [];
            }
            tasksByLanguage[lang].push(task);
        }
        
        // 为每种语言创建批次
        const batches = [];
        let batchId = 1;
        
        for (const lang in tasksByLanguage) {
            const langTasks = tasksByLanguage[lang];
            const langBatches = this.createBatches(langTasks, batchSize);
            
            for (const batch of langBatches) {
                batches.push({
                    batchId: batchId++,
                    tasks: batch,
                    success: false,
                    completed: 0
                });
            }
        }
        
        return batches;
    }
    
    /**
     * 执行翻译过程
     * @param {Array} rows - 数据行
     * @param {number} sourceColumnIndex - 源列索引
     * @param {string} sourceLang - 源语言
     * @param {Array} targetColumns - 目标列数组
     * @param {Function} updateCellCallback - 更新单元格回调函数
     * @returns {Promise<void>}
     */
    async executeTranslation(rows, sourceColumnIndex, sourceLang, targetColumns, updateCellCallback) {
        try {
            // 1. 收集所有需要翻译的源文本和目标单元格
            this.log('正在收集需要翻译的内容...', 'info');
            const translationTasks = this.prepareTranslationTasks(rows, sourceColumnIndex, targetColumns);
            
            if (translationTasks.length === 0) {
                this.log('没有找到需要翻译的内容', 'warning');
                return;
            }
            
            this.log(`找到 ${translationTasks.length} 个需要翻译的单元格`, 'info');
            
            // 2. 将任务按目标语言分组，然后每组最多20条
            const batches = this.organizeTasksIntoBatches(translationTasks);
            
            // 3. 使用翻译服务实例
            const translationService = new TranslationService(this.apiKey, this.log);
            
            // 4. 开始批量翻译
            const totalBatches = batches.length;
            let completedBatches = 0;
            
            this.log(`开始处理 ${totalBatches} 个翻译批次`, 'info');
            
            for (let i = 0; i < batches.length; i++) {
                if (this.shouldStopTranslation) {
                    this.log('翻译已被用户停止', 'warning');
                    break;
                }
                
                const batch = batches[i];
                const currentBatchId = i + 1;
                
                // 更新进度
                this.progressBar.updateBatchProgress({
                    completedBatches,
                    totalBatches,
                    currentBatchId,
                    completedTasksInCurrentBatch: 0,
                    totalTasksInCurrentBatch: batch.tasks.length
                });
                
                try {
                    const success = await translationService.translateBatch(batch, sourceLang);
                    completedBatches++;
                    
                    // 更新进度
                    this.progressBar.updateBatchProgress({
                        completedBatches,
                        totalBatches,
                        currentBatchId: 0, // 当前批次已完成
                        completedTasksInCurrentBatch: batch.tasks.length,
                        totalTasksInCurrentBatch: batch.tasks.length
                    });
                    
                    // 只有翻译成功时才更新单元格
                    if (success) {
                        // 每个批次完成后更新单元格，但不重新渲染整个表格
                        let tasksWithResults = 0;
                        let tasksWithoutResults = 0;
                        
                        for (const task of batch.tasks) {
                            // 只有当任务有翻译结果时才更新单元格
                            let translation = task.translation;
                            if (translation && typeof translation === 'string' && translation.trim() !== '') {
                                // 更新数据模型
                                rows[task.rowIndex][task.targetColumnIndex] = translation;
                                
                                // 直接更新DOM中的单元格内容，而不是重新渲染整个表格
                                updateCellCallback(task.rowIndex + 2, task.targetColumnIndex, translation);
                                tasksWithResults++;
                            } else {
                                tasksWithoutResults++;
                            }
                        }
                        
                        if (tasksWithoutResults > 0) {
                            this.log(`警告: ${tasksWithoutResults} 个单元格未获得翻译结果`, 'warning');
                        }
                    }
                    
                    this.log(`批次 ${currentBatchId}/${totalBatches} 完成`, 'success');
                } catch (error) {
                    this.log(`批次 ${currentBatchId}/${totalBatches} 失败: ${error.message}`, 'error');
                }
            }
            
            this.log(`翻译任务完成: ${completedBatches}/${totalBatches} 个批次`, 
                completedBatches === totalBatches ? 'success' : 'warning');
            
        } catch (error) {
            this.log(`翻译过程出错: ${error.message}`, 'error');
            console.error('翻译过程出错:', error);
        }
    }
}
