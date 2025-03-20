import './styles.css';
import { ExcelTranslator } from './ExcelTranslator.js';

// 初始化应用
window.addEventListener('DOMContentLoaded', () => {
    window.excelTranslatorInstance = new ExcelTranslator();
});
