/**
 * 知识库管理器工具函数
 */

// HTML转义函数
/**
 * 转义HTML特殊字符
 * @param {string} text - 要转义的文本
 * @returns {string} 转义后的文本
 */
export function escapeHtml(text) {
    if (!text) return '';
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 定义语言字段映射，避免重复代码
export const languageFields = [
    { key: 'Chinese', label: '中文' },
    { key: 'English', label: '英文' },
    { key: 'Japanese', label: '日文' },
    { key: 'Korean', label: '韩文' },
    { key: 'Spanish', label: '西班牙文' },
    { key: 'French', label: '法文' },
    { key: 'German', label: '德文' },
    { key: 'Russian', label: '俄文' },
    { key: 'Thai', label: '泰文' },
    { key: 'Italian', label: '意大利文' },
    { key: 'Indonesian', label: '印尼文' },
    { key: 'Portuguese', label: '葡萄牙文' }
];

// 日志记录函数
/**
 * 创建日志记录函数
 * @param {HTMLElement} logOutput - 日志输出的DOM元素
 * @returns {Function} 日志记录函数
 */
export function createLogger(logOutput) {
    return function log(message, type = 'info') {
        if (!logOutput) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;
        logOutput.appendChild(logEntry);
        logOutput.scrollTop = logOutput.scrollHeight;
    };
}
