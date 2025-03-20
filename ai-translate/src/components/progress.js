/**
 * 进度条组件
 */
export class ProgressBar {
    /**
     * 创建进度条组件
     */
    constructor() {
        this.progressContainer = document.querySelector('.progress-container');
        this.progressFill = document.querySelector('.progress-fill');
        this.progressText = document.querySelector('.progress-text');
        this.progressDetails = document.querySelector('.progress-details');
        
        // 创建批次计数器元素
        this.progressBatchCounter = document.createElement('div');
        this.progressBatchCounter.className = 'progress-batch-counter';
        this.progressBatchCounter.style.textAlign = 'center';
        this.progressBatchCounter.style.marginTop = '5px';
        this.progressBatchCounter.style.fontSize = '14px';
        this.progressBatchCounter.style.color = '#666';
        
        // 将批次计数器添加到进度条容器后面
        this.progressContainer.parentNode?.insertBefore(
            this.progressBatchCounter, 
            this.progressContainer.nextSibling
        );
    }

    /**
     * 更新进度
     * @param {Object} data - 进度数据
     * @param {number} data.current - 当前进度
     * @param {number} data.total - 总进度
     * @param {string} [data.text] - 进度文本
     */
    updateProgress(data) {
        const percentage = (data.current / data.total) * 100;
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${Math.round(percentage)}%`;
        
        if (data.text) {
            this.progressDetails.textContent = data.text;
        }
    }
    
    /**
     * 更新批次进度
     * @param {Object} progress - 批次进度数据
     * @param {number} progress.completedBatches - 已完成批次数
     * @param {number} progress.totalBatches - 总批次数
     * @param {number} progress.currentBatchId - 当前批次ID
     * @param {number} progress.completedTasksInCurrentBatch - 当前批次已完成任务数
     * @param {number} progress.totalTasksInCurrentBatch - 当前批次总任务数
     */
    updateBatchProgress(progress) {
        // 更新总体进度
        const overallPercentage = (progress.completedBatches / progress.totalBatches) * 100;
        this.progressFill.style.width = `${overallPercentage}%`;
        this.progressText.textContent = `${Math.round(overallPercentage)}%`;
        
        // 更新批次计数器
        this.progressBatchCounter.textContent = `批次进度: ${progress.completedBatches}/${progress.totalBatches}`;
        
        // 更新详细信息
        if (progress.currentBatchId > 0) {
            const batchProgress = (progress.completedTasksInCurrentBatch / progress.totalTasksInCurrentBatch) * 100;
            this.progressDetails.textContent = `当前批次 ${progress.currentBatchId}/${progress.totalBatches}: 完成 ${Math.round(batchProgress)}%`;
        }
    }

    /**
     * 重置进度条
     */
    reset() {
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
        this.progressDetails.textContent = '';
    }

    /**
     * 显示进度条
     */
    show() {
        this.progressContainer.style.display = 'block';
    }

    /**
     * 隐藏进度条
     */
    hide() {
        this.progressContainer.style.display = 'none';
    }
}
