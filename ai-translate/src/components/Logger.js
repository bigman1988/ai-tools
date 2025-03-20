/**
 * 日志记录器组件
 */
export class Logger {
    /**
     * 创建日志记录器
     * @param {HTMLElement} container - 日志容器元素
     */
    constructor(container) {
        this.container = container;
    }

    /**
     * 记录日志消息
     * @param {string} message - 日志消息
     * @param {string} type - 日志类型 (info, warning, error, success)
     */
    log(message, type = 'info') {
        if (!this.container) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        this.container.appendChild(logEntry);
        this.container.scrollTop = this.container.scrollHeight;
    }
}
