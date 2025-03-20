import { TranslationService } from './translator.js';

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
     * @param {number} sourceColumnIndex - 源列索引
     * @param {Array} targetColumns - 目标列数组
     * @returns {Array} - 翻译任务数组
     */
    prepareTranslationTasks(rows, sourceColumnIndex, targetColumns) {
        const translationTasks = [];
        
        // 遍历所有行，收集需要翻译的任务
        for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
            const row = rows[rowIndex];
            
            // 确保行有足够的列
            while (row.length <= Math.max(...targetColumns.map(c => c.index))) {
                row.push('');
            }
            
            // 获取源文本
            const sourceText = row[sourceColumnIndex];
            
            // 安全地检查源文本
            try {
                // 如果源文本为空，跳过该行
                if (!sourceText || (typeof sourceText === 'string' && sourceText.trim() === '')) {
                    this.log(`跳过第 ${rowIndex + 1} 行：源文本为空`, 'warning');
                    continue;
                }
                
                // 如果源文本不是字符串，尝试转换为字符串
                if (typeof sourceText !== 'string') {
                    this.log(`警告: 第 ${rowIndex + 1} 行的源文本不是字符串，尝试转换`, 'warning');
                    row[sourceColumnIndex] = String(sourceText);
                }
            } catch (error) {
                console.error(`处理行 ${rowIndex + 1} 列 ${sourceColumnIndex} 的源文本时出错:`, error);
                this.log(`警告: 处理行 ${rowIndex + 1} 列 ${sourceColumnIndex} 时出错，跳过该行`, 'warning');
                continue;
            }
            
            // 遍历所有目标语言
            for (const targetColumn of targetColumns) {
                // 如果目标单元格已有内容，则跳过
                try {
                    // 安全地检查目标单元格的内容
                    const cellContent = row[targetColumn.index];
                    if (cellContent !== null && cellContent !== undefined && 
                        typeof cellContent === 'string' && cellContent.trim() !== '') {
                        continue;
                    }
                } catch (error) {
                    console.error(`处理行 ${rowIndex + 1} 列 ${targetColumn.index} 时出错:`, error);
                    this.log(`警告: 处理行 ${rowIndex + 1} 列 ${targetColumn.index} 时出错`, 'warning');
                    // 如果出错，我们假设单元格为空，继续处理
                }
                
                // 创建翻译任务
                translationTasks.push({
                    text: sourceText,
                    targetLang: targetColumn.langCode,
                    rowIndex: rowIndex,
                    columnIndex: sourceColumnIndex,
                    targetColumnIndex: targetColumn.index,
                    langDisplay: targetColumn.display
                });
            }
        }
        
        return translationTasks;
    }

    /**
     * 将翻译任务分组为批次
     * @param {Array} translationTasks - 翻译任务数组
     * @returns {Array} - 批次数组
     */
    organizeTasksIntoBatches(translationTasks) {
        const batches = [];
        let batchId = 1;
        
        // 按目标语言分组
        const tasksByLanguage = {};
        
        // 将任务按目标语言分组
        for (const task of translationTasks) {
            if (!tasksByLanguage[task.targetLang]) {
                tasksByLanguage[task.targetLang] = [];
            }
            tasksByLanguage[task.targetLang].push(task);
        }
        
        this.log(`已将翻译任务分组为 ${Object.keys(tasksByLanguage).length} 种目标语言`, 'info');
        
        // 对每种语言，将任务分成批次，每批次最多20个任务
        for (const langCode in tasksByLanguage) {
            const tasksForLanguage = tasksByLanguage[langCode];
            const langDisplay = tasksForLanguage[0].langDisplay; // 获取语言显示名称
            
            this.log(`处理目标语言 ${langDisplay} 的 ${tasksForLanguage.length} 个任务`, 'info');
            
            // 将语言组内的任务划分为小组，每组最多20个任务且总字符数不超过2000
            let currentBatchTasks = [];
            let currentCharCount = 0;
            const MAX_CHAR_COUNT = 2000; // 最大字符数限制
            const MAX_TASKS_PER_BATCH = 20; // 每批次的任务数量限制
            
            for (let i = 0; i < tasksForLanguage.length; i++) {
                const task = tasksForLanguage[i];
                
                // 如果当前批次已有20个任务或者加上当前任务会超过2000个字符，则创建新批次
                if (currentBatchTasks.length >= MAX_TASKS_PER_BATCH || currentCharCount + (typeof task.text === 'string' ? task.text.length : 0) > MAX_CHAR_COUNT) {
                    if (currentBatchTasks.length > 0) {
                        // 创建批次对象
                        const newBatch = {
                            tasks: [...currentBatchTasks],
                            batchId: batchId++,
                            totalCharCount: currentCharCount
                        };
                        
                        // 将批次添加到批次数组
                        batches.push(newBatch);
                        
                        // 重置当前批次
                        currentBatchTasks = [];
                        currentCharCount = 0;
                    }
                }
                
                // 如果单个任务的字符数就超过2000，则单独处理该任务
                if (task.text.length > MAX_CHAR_COUNT) {
                    this.log(`警告: 任务字符数(${task.text.length})超过限制(${MAX_CHAR_COUNT})，单独处理`, 'warning');
                    const singleTaskBatch = {
                        tasks: [task],
                        batchId: batchId++,
                        totalCharCount: task.text.length
                    };
                    batches.push(singleTaskBatch);
                } else {
                    // 将任务添加到当前批次
                    currentBatchTasks.push(task);
                    currentCharCount += task.text.length;
                }
            }
            
            // 添加最后一个批次
            if (currentBatchTasks.length > 0) {
                const newBatch = {
                    tasks: currentBatchTasks,
                    batchId: batchId++,
                    totalCharCount: currentCharCount
                };
                batches.push(newBatch);
            }
        }
        
        this.log(`将翻译任务分成了 ${batches.length} 个批次`, 'info');
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
            
            // 3. 创建翻译服务实例
            const translationService = new TranslationService(this.apiKey, this.log);
            
            // 4. 开始批量翻译
            const sourceApiCode = sourceLang;
            await translationService.processBatches(
                batches, 
                sourceApiCode,
                (progress) => {
                    // 更新进度条
                    this.progressBar.updateBatchProgress(progress);
                },
                (batch) => {
                    // 每个批次完成后更新单元格，但不重新渲染整个表格
                    let tasksWithResults = 0;
                    let tasksWithoutResults = 0;
                    
                    for (const task of batch.tasks) {
                        // 只有当任务有翻译结果时才更新单元格
                        if (task.text && typeof task.text === 'string' && task.text.trim() !== '') {
                            // 更新数据模型
                            rows[task.rowIndex][task.targetColumnIndex] = task.text;
                            
                            // 直接更新DOM中的单元格内容，而不是重新渲染整个表格
                            updateCellCallback(task.rowIndex + 2, task.targetColumnIndex, task.text);
                            tasksWithResults++;
                        } else {
                            tasksWithoutResults++;
                        }
                    }
                    
                    // 如果有任务没有收到翻译结果，显示警告
                    if (tasksWithoutResults > 0) {
                        this.log(`警告: ${tasksWithoutResults} 个任务没有收到翻译结果`, 'warning');
                    }
                    
                    // 安全地访问可选属性
                    const displayName = batch.tasks.length > 0 ? batch.tasks[0].langDisplay : '';
                    this.log(`已更新 ${displayName} 的翻译结果`, 'info');
                }
            );
            
            this.log('所有翻译任务完成', 'success');
            
        } catch (error) {
            // 记录更详细的错误信息
            const errorMessage = error.message || String(error);
            const errorStack = error.stack || 'No stack trace available';
            
            console.error('翻译过程出错:', error);
            console.error('错误堆栈:', errorStack);
            
            // 打印错误堆栈的第一行和第二行，通常包含错误位置
            try {
                const stackLines = errorStack.split('\n');
                const errorInfo = stackLines.slice(0, 3).join('\n');
                this.log(`翻译过程出错: ${errorMessage}\n${errorInfo}`, 'error');
            } catch (e) {
                // 如果解析错误堆栈失败，则使用原始错误消息
                this.log(`翻译过程出错: ${errorMessage}`, 'error');
                console.error('解析错误堆栈时出错:', e);
            }
        }
    }
}
