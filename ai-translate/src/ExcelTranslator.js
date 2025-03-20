import * as XLSX from 'xlsx';
import { ProgressBar } from './components/progress.js';
import { Logger } from './components/Logger.js';
import { TableRenderer } from './components/TableRenderer.js';
import { TranslationManager } from './services/TranslationManager.js';
import { LanguageUtils } from './utils/LanguageUtils.js';
import { readExcelFile, createExcelWorkbook } from './utils/excel.js';

/**
 * Excel翻译器类
 */
export class ExcelTranslator {
    // 静态属性，用于跟踪事件监听器是否已初始化
    static _eventsInitialized = false;
    
    /**
     * 创建Excel翻译器实例
     */
    constructor() {
        console.log('ExcelTranslator 构造函数被调用');
        
        // 初始化UI元素
        this.tableOutput = document.getElementById('tableOutput');
        this.logOutput = document.getElementById('logOutput');
        
        // 初始化组件
        this.logger = new Logger(this.logOutput);
        this.progressBar = new ProgressBar();
        this.tableRenderer = new TableRenderer(this.tableOutput);
        
        // 初始化数据
        this.data = {};
        this.currentSheet = null;
        this.currentFileName = '';
        this.apiKey = '';
        this.shouldStopTranslation = false;
        this.sourceLangSelect = null;
        
        // 优先从环境变量获取API密钥
        if (process.env.ALI_API_KEY) {
            this.apiKey = process.env.ALI_API_KEY;
            console.log('已从环境变量加载API密钥');
        }
        
        // 初始化UI和事件监听器
        this.initializeUI();
        this.initializeEventListeners();
    }

    /**
     * 初始化UI
     */
    initializeUI() {
        // 初始化进度条
        this.progressBar.show();
        this.progressBar.updateProgress({ current: 0, total: 100 });
        this.progressBar.hide();

        // 绑定停止按钮事件
        const stopBtn = document.getElementById('stopTranslateBtn');
        if (stopBtn) {
            // 移除可能存在的旧事件监听器
            const newStopBtn = stopBtn.cloneNode(true);
            stopBtn.parentNode.replaceChild(newStopBtn, stopBtn);
            
            newStopBtn.addEventListener('click', () => {
                this.shouldStopTranslation = true;
                newStopBtn.disabled = true;
                this.logger.log('正在停止翻译...', 'warning');
            });
        }
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        console.log('initializeEventListeners 被调用', new Error().stack);
        
        // 防止重复注册事件监听器 - 使用静态属性
        if (ExcelTranslator._eventsInitialized) {
            console.log('事件监听器已初始化，跳过重复注册');
            return;
        }
        
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const translateBtn = document.getElementById('translateBtn');
        const exportBtn = document.getElementById('exportBtn');
        const actionButtons = document.getElementById('actionButtons');
        this.sourceLangSelect = document.getElementById('sourceLang');

        console.log('找到的UI元素:', { 
            fileInput: !!fileInput, 
            uploadBtn: !!uploadBtn, 
            translateBtn: !!translateBtn, 
            exportBtn: !!exportBtn 
        });

        // 处理文件选择按钮点击
        if (uploadBtn) {
            console.log('为uploadBtn添加点击事件监听器');
            uploadBtn.addEventListener('click', () => {
                console.log('uploadBtn被点击');
                fileInput?.click();
            });
        }

        if (fileInput) {
            console.log('为fileInput添加change事件监听器');
            fileInput.addEventListener('change', (e) => {
                console.log('fileInput change事件触发');
                this.handleFileSelect(e);
                if (actionButtons) {
                    actionButtons.style.display = 'block';
                }
            });
        }
        
        if (translateBtn) {
            console.log('为translateBtn添加点击事件监听器');
            translateBtn.addEventListener('click', () => {
                console.log('translateBtn被点击');
                this.handleTranslateClick();
            });
        }
        
        if (exportBtn) {
            console.log('为exportBtn添加点击事件监听器');
            exportBtn.addEventListener('click', () => {
                console.log('exportBtn被点击');
                this.exportToExcel();
            });
        }
        
        // 标记事件监听器已初始化
        ExcelTranslator._eventsInitialized = true;
        console.log('事件监听器初始化完成');
    }

    /**
     * 处理文件选择事件
     * @param {Event} event - 文件选择事件
     */
    async handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            this.currentFileName = file.name;
            this.logger.log(`正在读取文件: ${file.name}`, 'info');
            this.progressBar.show();
            
            // 读取Excel文件
            this.data = await readExcelFile(file);
            
            // 更新工作表选择器
            this.updateSheetSelector(Object.keys(this.data));
            
            // 显示第一个工作表
            if (Object.keys(this.data).length > 0) {
                this.currentSheet = Object.keys(this.data)[0];
                this.displaySheet();
                this.logger.log(`已加载工作表: ${this.currentSheet}`, 'success');
            }
            
            // 尝试自动检测源语言列
            this.autoDetectSourceLanguage();
            
        } catch (error) {
            this.logger.log(`读取文件失败: ${error.message}`, 'error');
            console.error('文件读取错误:', error);
        } finally {
            this.progressBar.hide();
        }
    }

    /**
     * 自动检测源语言列
     */
    autoDetectSourceLanguage() {
        if (!this.currentSheet || !this.data[this.currentSheet] || !this.sourceLangSelect) return;
        
        const { headerRows } = this.data[this.currentSheet];
        if (headerRows.length < 2) return;
        
        // 获取表头行
        const headerRow = headerRows[1];
        
        // 遍历所有列标题，尝试匹配语言
        for (let i = 0; i < headerRow.length; i++) {
            const columnHeader = headerRow[i];
            const language = LanguageUtils.findLanguageByColumnHeader(columnHeader);
            
            if (language === 'Chinese') {
                // 如果找到中文列，设置为源语言
                this.sourceLangSelect.value = 'Chinese';
                this.logger.log(`已自动检测到源语言列: ${columnHeader} (列 ${this.getExcelColumnName(i)})`, 'info');
                break;
            }
        }
    }

    /**
     * 更新工作表选择器
     * @param {Array} sheets - 工作表名称数组
     */
    updateSheetSelector(sheets) {
        const sheetSelector = document.getElementById('sheetSelector');
        if (!sheetSelector) return;

        // 清除现有选项
        sheetSelector.innerHTML = '';

        // 添加新选项
        sheets.forEach(sheetName => {
            const option = document.createElement('option');
            option.value = sheetName;
            option.textContent = sheetName;
            sheetSelector.appendChild(option);
        });
        
        // 添加工作表切换事件
        sheetSelector.addEventListener('change', () => {
            this.currentSheet = sheetSelector.value;
            this.displaySheet();
            this.logger.log(`已切换到工作表: ${this.currentSheet}`, 'info');
        });
    }

    /**
     * 显示当前工作表
     */
    displaySheet() {
        if (!this.tableOutput || !this.currentSheet || !this.data[this.currentSheet]) {
            console.error('无法显示表格：', {
                tableOutput: !!this.tableOutput,
                currentSheet: this.currentSheet,
                hasData: this.data[this.currentSheet] ? true : false
            });
            return;
        }

        const sheetData = this.data[this.currentSheet];
        
        // 使用TableRenderer渲染表格
        this.tableRenderer.renderTable(sheetData, (rowIndex, colIndex, content) => {
            // 单元格编辑回调
            if (rowIndex < sheetData.headerRows.length) {
                sheetData.headerRows[rowIndex][colIndex] = content;
            } else {
                const dataRowIndex = rowIndex - sheetData.headerRows.length;
                // 确保数据行数组有足够的长度
                while (sheetData.rows.length <= dataRowIndex) {
                    sheetData.rows.push([]);
                }
                // 确保数据行有足够的列
                while (sheetData.rows[dataRowIndex].length <= colIndex) {
                    sheetData.rows[dataRowIndex].push('');
                }
                sheetData.rows[dataRowIndex][colIndex] = content;
            }
        });
    }

    /**
     * 处理翻译按钮点击事件
     */
    async handleTranslateClick() {
        if (!this.currentSheet || !this.data[this.currentSheet]) {
            this.logger.log('没有可翻译的数据', 'warning');
            return;
        }

        const translateBtn = document.getElementById('translateBtn');
        const stopBtn = document.getElementById('stopTranslateBtn');
        
        // 显示停止按钮，隐藏翻译按钮
        if (translateBtn) translateBtn.style.display = 'none';
        if (stopBtn) {
            stopBtn.style.display = 'inline-block';
            stopBtn.disabled = false;
        }
        
        // 重置停止标志
        this.shouldStopTranslation = false;
        
        // 显示进度条
        this.progressBar.show();
        this.progressBar.updateProgress({ current: 0, total: 100 });
        
        // 获取API密钥，优先使用环境变量中的ALI_API_KEY
        if (process.env.ALI_API_KEY) {
            this.apiKey = process.env.ALI_API_KEY;
            console.log('使用环境变量中的API密钥');
        } else {
            this.apiKey = document.getElementById('apiKey')?.value || '';
        }
        
        if (!this.apiKey) {
            this.logger.log('请输入API密钥', 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        // 获取源语言
        const sourceLang = this.sourceLangSelect?.value || 'Chinese';
        const sourceApiCode = LanguageUtils.getApiLanguageCode(sourceLang);
        
        // 查找源语言列
        const { headerRows, rows } = this.data[this.currentSheet];
        if (headerRows.length < 2) {
            this.logger.log('错误：表格缺少表头行', 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        const headerRow = headerRows[1];
        let sourceColumnIndex = -1;
        
        // 查找源语言列
        for (let i = 0; i < headerRow.length; i++) {
            const columnHeader = headerRow[i];
            const language = LanguageUtils.findLanguageByColumnHeader(columnHeader);
            const sourceLanguageConfig = LanguageUtils.getSourceLanguageConfig();
            
            if (language === sourceLanguageConfig[LanguageUtils.getLanguageDisplayName(sourceLang)]) {
                sourceColumnIndex = i;
                break;
            }
        }
        
        if (sourceColumnIndex === -1) {
            this.logger.log(`错误：找不到源语言(${LanguageUtils.getLanguageDisplayName(sourceLang)})列`, 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        // 查找所有目标语言列
        const targetColumns = [];
        const sourceLanguageConfig = LanguageUtils.getSourceLanguageConfig();
        
        for (let i = 0; i < headerRow.length; i++) {
            if (i === sourceColumnIndex) continue;
            
            const columnHeader = headerRow[i];
            const language = LanguageUtils.findLanguageByColumnHeader(columnHeader);
            
            if (language && language !== sourceLanguageConfig[LanguageUtils.getLanguageDisplayName(sourceLang)]) {
                targetColumns.push({
                    index: i,
                    langCode: language,
                    display: columnHeader
                });
            }
        }
        
        if (targetColumns.length === 0) {
            this.logger.log('错误：找不到任何目标语言列', 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        this.logger.log(`开始翻译，源语言: ${LanguageUtils.getLanguageDisplayName(sourceLang)} (列 ${this.getExcelColumnName(sourceColumnIndex)})`, 'info');
        this.logger.log('目标语言: ' + targetColumns.map(c => `${c.display} (列 ${this.getExcelColumnName(c.index)})`).join(', '), 'info');
        
        try {
            // 创建翻译管理器
            const translationManager = new TranslationManager(
                this.apiKey, 
                this.logger.log.bind(this.logger),
                this.progressBar
            );
            
            // 设置停止按钮事件
            if (stopBtn) {
                // 移除可能存在的旧事件监听器
                const newStopBtn = stopBtn.cloneNode(true);
                stopBtn.parentNode.replaceChild(newStopBtn, stopBtn);
                
                newStopBtn.onclick = () => {
                    this.shouldStopTranslation = true;
                    translationManager.stopTranslation();
                    newStopBtn.disabled = true;
                    this.logger.log('正在停止翻译...', 'warning');
                };
            }
            
            // 执行翻译
            await translationManager.executeTranslation(
                rows,
                sourceColumnIndex,
                sourceLang,
                targetColumns,
                (rowIndex, colIndex, text) => {
                    // 更新单元格回调
                    this.tableRenderer.updateCellInDOM(rowIndex, colIndex, text, headerRows.length);
                }
            );
            
        } catch (error) {
            console.error('翻译过程出错:', error);
            this.logger.log(`翻译过程出错: ${error.message || String(error)}`, 'error');
        } finally {
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            stopBtn.disabled = true;
            this.progressBar.hide();
        }
    }

    /**
     * 导出到Excel
     */
    async exportToExcel() {
        if (!this.currentSheet || !this.data[this.currentSheet]) {
            this.logger.log('没有可导出的数据', 'warning');
            return;
        }

        try {
            const workbook = createExcelWorkbook(this.data);
            XLSX.writeFile(workbook, `${this.currentFileName.replace('.xlsx', '')}_translated.xlsx`);
            this.logger.log('导出成功', 'success');
        } catch (error) {
            if (error instanceof Error) {
                this.logger.log(`导出失败: ${error.message}`, 'error');
            } else {
                this.logger.log('导出失败: 未知错误', 'error');
            }
        }
    }

    /**
     * 获取Excel列名
     * @param {number} index - 列索引
     * @returns {string} - 列名
     */
    getExcelColumnName(index) {
        return this.tableRenderer.getExcelColumnName(index);
    }
}
