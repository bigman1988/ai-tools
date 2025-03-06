import { ProgressData, BatchProgress } from '../types/types';

export class ProgressBar {
    private progressContainer: HTMLElement;
    private progressFill: HTMLElement;
    private progressText: HTMLElement;
    private progressDetails: HTMLElement;
    private progressBatchCounter: HTMLElement;

    constructor() {
        this.progressContainer = document.querySelector('.progress-container') as HTMLElement;
        this.progressFill = document.querySelector('.progress-fill') as HTMLElement;
        this.progressText = document.querySelector('.progress-text') as HTMLElement;
        this.progressDetails = document.querySelector('.progress-details') as HTMLElement;
        
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

    updateProgress(data: ProgressData): void {
        const percentage = (data.current / data.total) * 100;
        this.progressFill.style.width = `${percentage}%`;
        this.progressText.textContent = `${Math.round(percentage)}%`;
        
        if (data.text) {
            this.progressDetails.textContent = data.text;
        }
    }
    
    updateBatchProgress(progress: BatchProgress): void {
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

    reset(): void {
        this.progressFill.style.width = '0%';
        this.progressText.textContent = '0%';
        this.progressDetails.textContent = '';
    }

    show(): void {
        this.progressContainer.style.display = 'block';
    }

    hide(): void {
        this.progressContainer.style.display = 'none';
    }
}
