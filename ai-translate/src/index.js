import './styles.css';
import * as XLSX from 'xlsx';
import { readExcelFile, createExcelWorkbook } from './utils/excel.js';
import { TranslationService } from './services/translator.js';
import { ProgressBar } from './components/progress.js';

class ExcelTranslator {
    constructor() {
        this.tableOutput = document.getElementById('tableOutput');
        this.data = {};
        this.currentSheet = '';
        this.sourceLangSelect = null;
        this.apiKey = '';
        this.currentFileName = '';
        this.originalWorkbook = null;
        this.shouldStopTranslation = false;
        this.progressBar = new ProgressBar();
        this.sourceColumnIndex = -1;
        this.targetLanguages = [];
        this.targetColumnIndices = [];
        
        this.sourceLanguages = ['简体中文', '英语'];
        
        this.languageMappings = [
            { columnHeader: '英语', targetLang: 'English' },
            { columnHeader: '日语', targetLang: 'Japanese' },
            { columnHeader: '韩语', targetLang: 'Korean' },
            { columnHeader: '西班牙语', targetLang: 'Spanish' },
            { columnHeader: '法语', targetLang: 'French' },
            { columnHeader: '德语', targetLang: 'German' },
            { columnHeader: '俄语', targetLang: 'Russian' },
            { columnHeader: '泰语', targetLang: 'Thai' },
            { columnHeader: '意大利语', targetLang: 'Italian' },
            { columnHeader: '印尼语', targetLang: 'Indonesian' },
            { columnHeader: '葡萄牙语', targetLang: 'Portuguese' }
        ];
        
        this.sourceLanguageConfig = {
            '简体中文': 'Chinese',
            '英语': 'English'
        };
        
        this.batchSize = 10; // 每批处理的行数
        this.currentBatchNumber = 0;
        
        // 检查是否已经初始化过，避免重复注册事件监听器
        if (!window.excelTranslatorInstance) {
            this.initializeEventListeners();
            this.initializeUI();
            console.log('初始化事件监听器和UI');
        } else {
            console.log('检测到已存在实例，跳过事件监听器初始化');
        }
        
        // 优先从环境变量获取API密钥，如果没有则使用输入框中的值
        if (process.env.DEEPSEEK_API_KEY) {
            this.apiKey = process.env.DEEPSEEK_API_KEY;
            console.log('已从环境变量加载API密钥');
        }
        
        const apiKeyInput = document.getElementById('apiKeyInput');
        if (apiKeyInput) {
            // 如果环境变量中有API密钥，则显示在输入框中（隐藏部分字符）
            if (this.apiKey) {
                const maskedKey = this.apiKey.substring(0, 4) + '...' + this.apiKey.substring(this.apiKey.length - 4);
                apiKeyInput.value = maskedKey;
                apiKeyInput.setAttribute('placeholder', '使用环境变量中的API密钥');
            }
            
            // 仍然允许用户手动输入/修改API密钥
            apiKeyInput.addEventListener('change', (e) => {
                const inputValue = e.target.value;
                if (inputValue && inputValue !== apiKeyInput.getAttribute('placeholder')) {
                    this.apiKey = inputValue;
                    console.log('已使用手动输入的API密钥');
                }
            });
        }
    }

    async translateCell(text, targetLang) {
        // 获取选择的源语言
        const sourceLangSelect = document.getElementById('sourceLang');
        const sourceLangValue = sourceLangSelect?.value || 'zh-CN';
        
        // 根据选择的值确定源语言代码
        const sourceLang = this.sourceLanguageConfig[sourceLangValue === 'en' ? '英语' : '简体中文'];
        
        console.log(`翻译请求 - 源语言: ${sourceLang}, 目标语言: ${targetLang}, 文本: ${text}`);
        const url = 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions';
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.apiKey.trim()}`,
                    'Accept': 'application/json'
                },
                body: JSON.stringify({
                    model: "qwen-mt-turbo",
                    messages: [
                        {
                            role: "user",
                            content: text
                        }
                    ],
                    translation_options: {
                        source_lang: sourceLang,
                        target_lang: targetLang
                    },
                    temperature: 0.7,
                    max_tokens: 2000
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`翻译API错误 - 状态码: ${response.status}, 错误信息:`, errorText);
                this.log(`翻译API错误: ${response.status} - ${errorText}`, 'error');
                throw new Error(`翻译API错误: ${response.status}`);
            }

            const data = await response.json();
            return data.choices[0].message.content.trim();
        } catch (error) {
            console.error('翻译出错:', error);
            this.log(`翻译出错: ${error.message}`, 'error');
            throw error;
        }
    }
    
    async handleFileSelect(event) {
        const input = event.target;
        if (!input.files || !input.files[0]) return;

        try {
            this.log('正在读取Excel文件...', 'info');
            const file = input.files[0];
            const data = await readExcelFile(file);
            this.data = data;
            this.currentFileName = file.name;
            
            // 更新文件名显示
            const fileNameElement = document.getElementById('fileName');
            if (fileNameElement) {
                fileNameElement.textContent = file.name;
            }
            
            this.log(`成功读取Excel文件: ${file.name}`, 'success');
            this.log(`工作表数量: ${Object.keys(data).length}`, 'info');

            // 再次确保tableOutput元素已经初始化
            this.tableOutput = document.getElementById('tableOutput');
            if (!this.tableOutput) {
                console.error('表格容器元素不存在');
                this.log('无法找到表格容器元素', 'error');
                return;
            }

            // 更新工作表选择器
            this.updateSheetSelector(Object.keys(data));

            // 显示第一个工作表的数据
            if (Object.keys(data).length > 0) {
                this.currentSheet = Object.keys(data)[0];
                this.log(`显示工作表: ${this.currentSheet}`, 'info');
                this.displaySheet();
            }
        } catch (error) {
            console.error('Error reading Excel file:', error);
            this.log('读取Excel文件失败', 'error');
        }
    }

    async handleTranslateClick() {
        const translateBtn = document.getElementById('translateBtn');
        const stopBtn = document.getElementById('stopTranslateBtn');
        translateBtn.style.display = 'none';
        stopBtn.style.display = 'inline-block';
        this.progressBar.show();
        stopBtn.disabled = false;
        this.shouldStopTranslation = false;
        this.currentBatchNumber = 0;

        // 获取API密钥
        if (!this.apiKey || this.apiKey.trim() === '') {
            this.log('错误：API密钥未设置', 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }

        // 获取选择的源语言
        const sourceLangSelect = document.getElementById('sourceLang');
        const sourceLangValue = sourceLangSelect?.value || 'zh-CN';
        
        // 根据选择的值确定源语言名称和API代码
        let sourceLang = '简体中文';
        let sourceApiCode = 'Chinese';
        if (sourceLangValue === 'en') {
            sourceLang = '英语';
            sourceApiCode = 'English';
        }
        
        // 获取表头行以查找列索引
        const { headerRows } = this.data[this.currentSheet];
        if (headerRows.length === 0) {
            this.log('错误：找不到表头行', 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        // 查找源语言列索引
        const headerRow = headerRows[1]; // 假设第二行是语言表头
        let sourceColumnIndex = -1;
        
        // 根据选择的源语言查找对应的列
        for (let i = 0; i < headerRow.length; i++) {
            if (headerRow[i] === sourceLang) {
                sourceColumnIndex = i;
                break;
            }
        }
        
        if (sourceColumnIndex === -1) {
            this.log(`错误：在表头中找不到源语言 "${sourceLang}" 列`, 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        // 确定目标语言列
        const targetColumns = [];
        
        // 遍历表头查找所有目标语言
        for (let i = 0; i < headerRow.length; i++) {
            // 跳过源语言列
            if (i === sourceColumnIndex) continue;
            
            // 查找表头对应的语言代码
            const mapping = this.languageMappings.find(m => m.columnHeader === headerRow[i]);
            if (mapping) {
                // 如果源语言是英语，跳过中文目标
                if (sourceLang === '英语' && headerRow[i] === '简体中文') continue;
                
                targetColumns.push({
                    index: i,
                    langCode: mapping.targetLang,
                    display: mapping.columnHeader
                });
            }
        }
        
        if (targetColumns.length === 0) {
            this.log('错误：找不到任何目标语言列', 'error');
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            this.progressBar.hide();
            return;
        }
        
        this.log(`开始翻译，源语言: ${sourceLang} (列 ${this.getExcelColumnName(sourceColumnIndex)})`, 'info');
        this.log('目标语言: ' + targetColumns.map(c => `${c.display} (列 ${this.getExcelColumnName(c.index)})`).join(', '), 'info');

        const rows = this.data[this.currentSheet].rows;
        
        try {
            // 1. 收集所有需要翻译的源文本和目标单元格
            const translationTasks = [];
            
            this.log('正在收集需要翻译的内容...', 'info');
            
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
            
            if (translationTasks.length === 0) {
                this.log('没有找到需要翻译的内容', 'warning');
                translateBtn.style.display = 'inline-block';
                stopBtn.style.display = 'none';
                this.progressBar.hide();
                return;
            }
            
            this.log(`找到 ${translationTasks.length} 个需要翻译的单元格`, 'info');
            
            // 2. 将任务按目标语言分组，然后每组最多20条
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
            
            // 3. 创建翻译服务实例
            const translationService = new TranslationService(this.apiKey, this.log.bind(this));
            
            // 设置停止按钮事件
            stopBtn.onclick = () => {
                this.shouldStopTranslation = true;
                translationService.stopTranslation();
                stopBtn.disabled = true;
                this.log('正在停止翻译...', 'warning');
            };
            
            // 4. 开始批量翻译
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
                            this.updateCellInDOM(task.rowIndex + 2, task.targetColumnIndex, task.text);
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
            
            // 不需要再次更新表格显示，因为我们已经在每个批次完成后直接更新了单元格
            
            // 在processBatches方法中处理单元格更新
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
        } finally {
            translateBtn.style.display = 'inline-block';
            stopBtn.style.display = 'none';
            stopBtn.disabled = true;
            this.progressBar.hide();
        }
    }

    createBatches(items, batchSize) {
        const batches = [];
        for (let i = 0; i < items.length; i += batchSize) {
            batches.push(items.slice(i, i + batchSize));
        }
        return batches;
    }

    initializeUI() {
        // 初始化进度条
        this.progressBar.show();
        this.progressBar.updateProgress({ current: 0, total: 100 });
        this.progressBar.hide();

        // 绑定停止按钮事件
        const stopBtn = document.getElementById('stopTranslateBtn');
        if (stopBtn) {
            stopBtn.addEventListener('click', () => {
                this.shouldStopTranslation = true;
                stopBtn.disabled = true;
                this.log('正在停止翻译...', 'warning');
            });
        }
    }

    initializeEventListeners() {
        const fileInput = document.getElementById('fileInput');
        const uploadBtn = document.getElementById('uploadBtn');
        const translateBtn = document.getElementById('translateBtn');
        const exportBtn = document.getElementById('exportBtn');
        const actionButtons = document.getElementById('actionButtons');
        this.sourceLangSelect = document.getElementById('sourceLang');

        // 处理文件选择按钮点击
        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => {
                fileInput?.click();
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                this.handleFileSelect(e);
                if (actionButtons) {
                    actionButtons.style.display = 'block';
                }
            });
        }
        if (translateBtn) translateBtn.addEventListener('click', () => this.handleTranslateClick());
        if (exportBtn) exportBtn.addEventListener('click', () => this.exportToExcel());
    }

    async exportToExcel() {
        if (!this.currentSheet || !this.data[this.currentSheet]) {
            this.log('没有可导出的数据', 'warning');
            return;
        }

        try {
            const workbook = createExcelWorkbook(this.data);
            XLSX.writeFile(workbook, `${this.currentFileName.replace('.xlsx', '')}_translated.xlsx`);
            this.log('导出成功', 'success');
        } catch (error) {
            if (error instanceof Error) {
                this.log(`导出失败: ${error.message}`, 'error');
            } else {
                this.log('导出失败: 未知错误', 'error');
            }
        }
    }

    getExcelColumnName(index) {
        let columnName = '';
        while (index >= 0) {
            columnName = String.fromCharCode(65 + (index % 26)) + columnName;
            index = Math.floor(index / 26) - 1;
        }
        return columnName;
    }

    log(message, type = 'info') {
        const logContainer = document.getElementById('logOutput');
        if (!logContainer) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
        logContainer.appendChild(logEntry);
        logContainer.scrollTop = logContainer.scrollHeight;
    }

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
    }

    /**
     * 直接更新DOM中的单元格内容，而不重新渲染整个表格
     * @param {number} rowIndex 行索引
     * @param {number} colIndex 列索引
     * @param {string} text 新的单元格内容
     */
    updateCellInDOM(rowIndex, colIndex, text) {
        const tableOutput = document.getElementById('tableOutput');
        if (!tableOutput) return;
        
        const tableWrapper = tableOutput.querySelector('.table-wrapper');
        if (!tableWrapper) return;
        
        const table = tableWrapper.querySelector('table');
        if (!table) return;
        
        // 考虑到我们的表格有头部行，需要计算实际的行索引
        // 在表格中，第一行是列头，所以数据行从第二行开始
        const { headerRows } = this.data[this.currentSheet];
        
        // 如果是头部行，不进行更新
        if (rowIndex < headerRows.length) return;
        
        // 计算实际的DOM行索引，考虑到我们可能隐藏了一些行
        // 我们需要找到实际显示的行，而不是隐藏的行
        const rows = table.querySelectorAll('tr');
        let targetRow = undefined;
        
        // 遍历所有行，找到对应的行
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumberCell = row.querySelector('.row-number');
            if (rowNumberCell && rowNumberCell.textContent === (rowIndex + 1).toString()) {
                targetRow = row;
                break;
            }
        }
        
        if (!targetRow) return;
        
        // 找到对应的单元格，注意第一列是行号，所以需要+1
        if (colIndex + 1 < targetRow.children.length) {
            const cell = targetRow.children[colIndex + 1];
            if (cell) {
                cell.textContent = text;
            }
        }
    }
    
    displaySheet() {
        // 检查tableOutput是否存在
        this.tableOutput = document.getElementById('tableOutput');
        if (!this.tableOutput || !this.currentSheet || !this.data[this.currentSheet]) {
            console.error('无法显示表格：', {
                tableOutput: !!this.tableOutput,
                currentSheet: this.currentSheet,
                hasData: this.data[this.currentSheet] ? true : false
            });
            return;
        }

        // 清空现有内容
        this.tableOutput.innerHTML = '';
        
        // 创建表格容器，使用固定头的布局
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        const table = document.createElement('table');
        table.className = 'excel-table';

        const { headerRows, rows } = this.data[this.currentSheet];
        const allRows = [...headerRows, ...rows];

        // 计算最大列数
        const maxColumns = Math.max(
            ...headerRows.map(row => row.length),
            ...rows.map(row => row.length)
        );

        // 创建列号行
        const colNumberRow = document.createElement('tr');
        const emptyTh = document.createElement('th'); // 左上角空单元格
        colNumberRow.appendChild(emptyTh);
        
        for (let i = 0; i < maxColumns; i++) {
            const th = document.createElement('th');
            th.textContent = this.getExcelColumnName(i);
            th.className = 'column-header';
            colNumberRow.appendChild(th);
        }
        table.appendChild(colNumberRow);

        // 创建表格内容
        allRows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            
            // 如果不是第二行（索引为1），并且是在前6行内，则隐藏
            if (rowIndex !== 1 && rowIndex < 6) {
                tr.style.display = 'none';
                return;
            }

            // 添加行号
            const rowNumberCell = document.createElement('td');
            rowNumberCell.textContent = (rowIndex + 1).toString();
            rowNumberCell.className = 'row-number';
            tr.appendChild(rowNumberCell);

            // 添加数据单元格
            for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
                const td = document.createElement(rowIndex < headerRows.length ? 'th' : 'td');
                td.textContent = row[colIndex] || '';
                
                // 设置单元格可编辑
                if (rowIndex >= headerRows.length) {
                    td.contentEditable = 'true';
                }
                
                // 添加单元格编辑事件
                td.addEventListener('input', () => {
                    if (rowIndex < headerRows.length) {
                        headerRows[rowIndex][colIndex] = td.textContent || '';
                    } else {
                        const dataRowIndex = rowIndex - headerRows.length;
                        // 确保数据行数组有足够的长度
                        while (rows.length <= dataRowIndex) {
                            rows.push([]);
                        }
                        // 确保数据行有足够的列
                        while (rows[dataRowIndex].length <= colIndex) {
                            rows[dataRowIndex].push('');
                        }
                        rows[dataRowIndex][colIndex] = td.textContent || '';
                    }
                });

                tr.appendChild(td);
            }

            table.appendChild(tr);
        });

        tableWrapper.appendChild(table);
        this.tableOutput.appendChild(tableWrapper);
        
        // 添加CSS样式使行号和列头固定
        const styleId = 'fixed-table-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .table-wrapper {
                    position: relative;
                    overflow: auto;
                    height: 99vh;
                    max-width: 100%;
                    border: 1px solid #ccc;
                    margin: 1px;
                    scroll-padding-top: 40px; /* 添加滚动填充，防止内容被固定头部遮挡 */
                }
                
                .excel-table {
                    border-collapse: collapse;
                }
                
                .excel-table th, .excel-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    min-width: 100px;
                }
                
                .excel-table th:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 3;
                    background-color: #f2f2f2;
                }
                
                .excel-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background-color: #f2f2f2;
                    box-shadow: 0 1px 0 rgba(0,0,0,0.1); /* 添加底部阴影，增强视觉效果 */
                }
                
                .excel-table tr:first-child th {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background-color: #f2f2f2;
                    box-shadow: 0 1px 0 rgba(0,0,0,0.1); /* 添加底部阴影，增强视觉效果 */
                }
                
                /* 处理左上角单元格，同时固定在顶部和左侧 */
                .excel-table tr:first-child th:first-child {
                    position: sticky;
                    top: 0;
                    left: 0;
                    z-index: 4; /* 最高层级，确保始终显示在最上层 */
                    background-color: #f2f2f2;
                    box-shadow: 1px 1px 0 rgba(0,0,0,0.1); /* 添加右侧和底部阴影 */
                }
                
                .excel-table .row-number {
                    position: sticky;
                    left: 0;
                    z-index: 1;
                    background-color: #f2f2f2;
                }
            `;
            document.head.appendChild(style);
        }
    }
}

// 初始化应用
window.excelTranslatorInstance = new ExcelTranslator();
