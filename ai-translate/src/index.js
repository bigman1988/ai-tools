import './styles.css';
import { ExcelTranslator } from './ExcelTranslator.js';

console.log('index.js 被加载');

// 初始化应用
window.addEventListener('DOMContentLoaded', () => {
    console.log('DOMContentLoaded 事件触发');
    
    // 检查是否已经有实例
    if (window.excelTranslatorInstance) {
        console.log('已存在 ExcelTranslator 实例，不再创建新实例');
        return;
    }
    
    console.log('创建新的 ExcelTranslator 实例');
    window.excelTranslatorInstance = new ExcelTranslator();
    console.log('ExcelTranslator 实例创建完成');
});
