declare global {
    interface Window {
        excelTranslatorInstance: import('./src/index').ExcelTranslator;
    }
}
