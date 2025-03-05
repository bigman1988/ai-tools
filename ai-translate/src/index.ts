import './styles.css';
import * as XLSX from 'xlsx';

interface ExcelData {
    [key: string]: {
        headerRows: any[][];
        headers: string[];
        rows: any[][];
    };
}

interface LanguageMapping {
    columnHeader: string;
    targetLang: string;
}

interface TranslationTask {
    text: string;
    rowIndex: number;
    targetColumnIndex: number;
    targetLang: string;
}

interface TranslationBatch {
    tasks: TranslationTask[];
    targetLang: string;
}

declare global {
    interface Window {
        excelTranslatorInstance: ExcelTranslator | null;
    }
}

class ExcelTranslator {
    private tableOutput: HTMLElement | null;
    private data: ExcelData;
    private currentFileName: string;
    private originalWorkbook: any;
    private currentSheet: string;
    private isTranslating: boolean = false;
    private shouldStopTranslation: boolean = false;
    private initialized: boolean = false;
    private languageMappings = [
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
        { columnHeader: '葡萄牙语', targetLang: 'Portuguese' },
    ];

    private sourceLanguageConfig = {
        Chinese: {
            columnHeader: '简体中文',
            apiCode: 'Chinese'  
        },
        English: {
            columnHeader: '英语',
            apiCode: 'English'  
        }
    };

    private currentBatchNumber: number = 0;  // 添加批次序号

    private constructor() {
        console.log('ExcelTranslator constructor called');  
        this.tableOutput = document.querySelector('.table-output');
        this.data = {};
        this.currentFileName = '';
        this.currentSheet = '';
        this.originalWorkbook = null;
    }

    private setupEventListeners(): void {
        if (this.initialized) {
            console.log('Event listeners already initialized, skipping...');
            return;
        }
        console.log('Setting up event listeners...');
        
        // 文件选择按钮
        const uploadBtn = document.getElementById('uploadBtn');
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        
        if (uploadBtn && fileInput) {
            fileInput.addEventListener('change', (event) => {
                this.handleFileSelect(event);
            });
            uploadBtn.onclick = () => fileInput.click();
        }

        // 翻译按钮
        const translateBtn = document.getElementById('translateBtn');
        if (translateBtn) {
            translateBtn.addEventListener('click', () => {
                this.handleTranslate();
            });
        }

        // 停止翻译按钮
        const stopTranslateBtn = document.getElementById('stopTranslateBtn');
        if (stopTranslateBtn) {
            stopTranslateBtn.addEventListener('click', () => {
                this.shouldStopTranslation = true;
                this.log('正在停止翻译...', 'warning');
            });
        }

        // 导出按钮
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => {
                this.exportToExcel();
            });
        }

        // 添加点击事件监听器，用于清除高亮
        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            if (!target.closest('.excel-table')) {
                this.clearHighlight();
            }
        });

        this.initialized = true;
        console.log('Event listeners initialized successfully');
    }

    public static getInstance(): ExcelTranslator {
        if (!window.excelTranslatorInstance) {
            console.log('Creating new ExcelTranslator instance');
            window.excelTranslatorInstance = new ExcelTranslator();
        }
        return window.excelTranslatorInstance;
    }

    public initialize(): void {
        if (!document.readyState || document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.setupEventListeners());
        } else {
            this.setupEventListeners();
        }
    }

    private async loadExcelFile(file: File) {
        try {
            this.log('正在加载文件...');
            
            const arrayBuffer = await file.arrayBuffer();
            this.originalWorkbook = XLSX.read(arrayBuffer);
            
            if (!this.originalWorkbook.SheetNames.length) {
                throw new Error('Excel文件没有工作表');
            }

            // 初始化数据结构
            this.data = {};
            this.currentFileName = file.name;
            this.currentSheet = this.originalWorkbook.SheetNames[0];
            
            // 处理每个工作表
            await this.processSheet(this.currentSheet);
            
            // 显示数据
            this.displaySheet();
            
            this.log('文件加载完成', 'success');

            // 显示操作按钮区域
            const actionButtons = document.getElementById('actionButtons');
            if (actionButtons) {
                actionButtons.style.display = 'block';
            }
        } catch (error: any) {
            console.error('加载文件失败:', error);
            this.log(`加载文件失败: ${error.message}`, 'error');
        }
    }

    private async exportToExcel(): Promise<void> {
        try {
            if (!this.originalWorkbook) {
                this.log('没有可以导出的数据', 'error');
                return;
            }

            // 创建一个新的工作簿
            const newWorkbook = XLSX.utils.book_new();
            
            // 获取原始工作表的数据
            const originalSheet = this.originalWorkbook.Sheets[this.currentSheet];
            const newSheet = { ...originalSheet };  // 复制原始工作表

            // 更新翻译后的数据
            // 首先处理前6行的表头数据
            for (let i = 0; i < 6; i++) {
                for (let j = 0; j < this.data[this.currentSheet].headerRows[i].length; j++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: i, c: j });
                    newSheet[cellAddress] = { 
                        t: 's',  // 设置单元格类型为字符串
                        v: this.data[this.currentSheet].headerRows[i][j]  // 设置值
                    };
                }
            }

            // 然后处理从第7行开始的数据
            for (let rowIndex = 0; rowIndex < this.data[this.currentSheet].rows.length; rowIndex++) {
                for (let colIndex = 0; colIndex < this.data[this.currentSheet].rows[rowIndex].length; colIndex++) {
                    const cellAddress = XLSX.utils.encode_cell({ r: rowIndex + 6, c: colIndex });
                    newSheet[cellAddress] = { 
                        t: 's',  // 设置单元格类型为字符串
                        v: this.data[this.currentSheet].rows[rowIndex][colIndex]  // 设置值
                    };
                }
            }

            // 添加工作表到工作簿
            XLSX.utils.book_append_sheet(newWorkbook, newSheet, this.currentSheet);

            // 导出文件
            const defaultFileName = this.currentFileName.replace('.xlsx', '') + '_translated.xlsx';
            XLSX.writeFile(newWorkbook, defaultFileName);
            
            this.log('文件导出完成', 'success');
        } catch (error) {
            console.error('导出错误:', error);
            this.log(`导出失败: ${error}`, 'error');
        }
    }

    private displaySheet(sheetName?: string): void {
        if (sheetName) {
            this.currentSheet = sheetName;
        }

        if (!this.data || !this.currentSheet || !this.data[this.currentSheet]) {
            return;
        }

        const sheetData = this.data[this.currentSheet];

        // 创建表格
        const table = document.createElement('table');
        table.className = 'excel-table';

        // 创建表头
        const thead = document.createElement('thead');

        // 添加列序号行（A, B, C...）
        const columnLetterRow = document.createElement('tr');
        const cornerCell = document.createElement('th');
        cornerCell.className = 'row-number corner-cell';
        columnLetterRow.appendChild(cornerCell);

        sheetData.headers.forEach((_, index) => {
            const letterCell = document.createElement('th');
            letterCell.textContent = this.getExcelColumnName(index);
            letterCell.className = 'column-letter';
            letterCell.dataset.colIndex = index.toString();
            letterCell.addEventListener('click', () => this.highlightColumn(table, index));
            columnLetterRow.appendChild(letterCell);
        });
        thead.appendChild(columnLetterRow);

        // 添加表头行
        const headerRow = document.createElement('tr');

        // 添加行号列的表头
        const rowNumberHeader = document.createElement('th');
        rowNumberHeader.textContent = '#';
        rowNumberHeader.className = 'row-number';
        headerRow.appendChild(rowNumberHeader);

        // 添加其他列的表头
        sheetData.headers.forEach((header, index) => {
            const th = document.createElement('th');
            th.textContent = header || '';
            th.contentEditable = 'true';
            th.dataset.colIndex = index.toString();
            th.addEventListener('blur', () => {
                this.updateHeaderCell(this.currentSheet, index, th.textContent || '');
            });
            headerRow.appendChild(th);
        });

        thead.appendChild(headerRow);
        table.appendChild(thead);

        // 创建表格主体
        const tbody = document.createElement('tbody');

        // 添加数据行
        sheetData.rows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');

            // 添加行号
            const rowNumberCell = document.createElement('td');
            rowNumberCell.textContent = (rowIndex + 7).toString();
            rowNumberCell.className = 'row-number';
            rowNumberCell.addEventListener('click', () => this.highlightRow(tr));
            tr.appendChild(rowNumberCell);

            // 添加数据单元格
            sheetData.headers.forEach((_, colIndex) => {
                const td = document.createElement('td');
                td.contentEditable = 'true';
                td.dataset.colIndex = colIndex.toString();

                const cellValue = row[colIndex];
                td.textContent = cellValue !== undefined && cellValue !== null ? cellValue.toString() : '';

                td.addEventListener('blur', () => {
                    this.updateDataCell(this.currentSheet, rowIndex, colIndex, td.textContent || '');
                });

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        });

        table.appendChild(tbody);

        // 清空并显示新表格
        if (this.tableOutput) {
            this.tableOutput.innerHTML = '';
            this.tableOutput.appendChild(table);
        }
    }

    private log(message: string, type: 'info' | 'error' | 'success' | 'warning' = 'info'): void {
        const logOutput = document.getElementById('logOutput');
        if (!logOutput) return;

        // 获取当前时间
        const now = new Date();
        const timestamp = now.toLocaleTimeString();

        // // 检查是否已经存在相同的日志条目
        // const existingEntries = logOutput.getElementsByClassName('log-entry');
        // const lastEntry = existingEntries[existingEntries.length - 1];
        // if (lastEntry) {
        //     const lastTimestamp = lastEntry.querySelector('.timestamp')?.textContent?.slice(1, -1); // 移除 []
        //     const lastMessage = lastEntry.textContent?.replace(`[${lastTimestamp}]`, '').trim();
            
        //     // 如果最后一条日志的时间戳和消息与当前的相同，则不添加新的日志
        //     if (lastTimestamp === timestamp && lastMessage === message) {
        //         return;
        //     }
        // }

        // 创建新的日志条目
        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.innerHTML = `<span class="timestamp">[${timestamp}]</span> ${message}`;
        logOutput.appendChild(logEntry);
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    private showError(message: string): void {
        if (this.tableOutput) {
            this.tableOutput.innerHTML = `<div class="error">${message}</div>`;
        }
        this.log(message, 'error');
    }

    private async handleTranslate(): Promise<void> {
        const translateBtn = document.getElementById('translateBtn');
        const stopTranslateBtn = document.getElementById('stopTranslateBtn');
        const sourceLangSelect = document.getElementById('sourceLang') as HTMLSelectElement;

        if (!translateBtn || !stopTranslateBtn || !sourceLangSelect) {
            this.log('找不到必要的UI元素', 'error');
            return;
        }

        if (this.isTranslating) {
            this.log('已有翻译任务正在进行中...', 'warning');
            return;
        }

        if (!this.data || Object.keys(this.data).length === 0) {
            this.log('请先选择Excel文件', 'error');
            return;
        }

        try {
            // 禁用翻译按钮，显示停止按钮
            translateBtn.style.display = 'none';
            stopTranslateBtn.style.display = 'block';
            this.isTranslating = true;
            this.shouldStopTranslation = false;
            this.currentBatchNumber = 0;  // 重置批次序号

            const sourceLang = sourceLangSelect.value;
            
            // 获取所有目标语言（除了中文和英文）
            const targetLangs = this.languageMappings
                .map(mapping => mapping.targetLang)
                .filter(lang => lang !== 'Chinese' && lang !== 'English');

            this.log('开始翻译，目标语言: ' + targetLangs.join(', '));

            // 创建进度条
            this.createProgressBar();
            let totalProgress = 0;
            let totalBatches = 0;

            // 计算总批次数
            for (const targetLang of targetLangs) {
                const tasks = this.prepareTranslationTasks(sourceLang, targetLang);
                if (tasks.length > 0) {
                    const batches = this.createBatches(tasks, 10);
                    totalBatches += batches.length;
                }
            }

            // 显示初始进度
            this.showProgressDetails(0, totalBatches);

            // 为每个目标语言创建翻译任务
            for (const targetLang of targetLangs) {
                if (this.shouldStopTranslation) {
                    this.log('翻译已停止', 'warning');
                    break;
                }

                this.currentBatchNumber++;  // 增加批次序号
                const mapping = this.languageMappings.find(m => m.targetLang === targetLang);
                const langDisplay = mapping ? mapping.columnHeader : targetLang;

                const tasks = this.prepareTranslationTasks(sourceLang, targetLang);
                if (tasks.length === 0) {
                    this.log(`批次 ${this.currentBatchNumber}: 没有需要翻译成${langDisplay}的内容`);
                    continue;
                }

                this.log(`开始批次 ${this.currentBatchNumber} (${langDisplay})`, 'info');

                // 将任务分成批次
                const batches = this.createBatches(tasks, 10);
                this.log(`批次 ${this.currentBatchNumber}: 创建了 ${batches.length} 个子批次用于翻译成 ${langDisplay}`);

                let subBatch = 0;
                for (const batch of batches) {
                    if (this.shouldStopTranslation) {
                        break;
                    }

                    subBatch++;
                    try {
                        await this.translateBatch(batch);
                        // 每个批次完成后立即更新表格显示
                        this.displaySheet();
                        totalProgress++;
                        this.updateProgressBar((totalProgress / totalBatches) * 100, totalProgress, totalBatches);
                        this.log(`批次 ${this.currentBatchNumber}.${subBatch} (${langDisplay}) 翻译完成`, 'success');
                    } catch (error: any) {
                        this.log(`批次 ${this.currentBatchNumber}.${subBatch} (${langDisplay}) 翻译失败: ${error.message}`, 'error');
                    }
                }

                this.log(`批次 ${this.currentBatchNumber} (${langDisplay}) 全部完成`, 'success');
            }

            this.log('所有翻译任务完成', 'success');
        } catch (error: any) {
            this.log(`翻译出错: ${error.message}`, 'error');
        } finally {
            // 恢复按钮状态
            translateBtn.style.display = 'block';
            stopTranslateBtn.style.display = 'none';
            this.isTranslating = false;
            this.shouldStopTranslation = false;
        }
    }

    private createProgressBar(): void {
        const wrapper = document.querySelector('.progress-wrapper') as HTMLDivElement;
        if (!wrapper) return;

        wrapper.innerHTML = `
            <div class="progress-container">
                <div class="progress-fill"></div>
                <div class="progress-text">0%</div>
            </div>
            <div class="progress-details" style="display: none;">
                已完成: 0 / 0 批次
            </div>
        `;
    }

    private showProgressDetails(currentBatch: number, totalBatches: number): void {
        const wrapper = document.querySelector('.progress-wrapper') as HTMLDivElement;
        if (!wrapper) return;

        const progressDetails = wrapper.querySelector('.progress-details') as HTMLDivElement;
        if (!progressDetails) return;

        progressDetails.style.display = 'block';
        progressDetails.textContent = `已完成: ${currentBatch} / ${totalBatches} 批次`;
    }

    private updateProgressBar(progress: number, currentBatch: number, totalBatches: number): void {
        const wrapper = document.querySelector('.progress-wrapper') as HTMLDivElement;
        if (!wrapper) return;

        const progressFill = wrapper.querySelector('.progress-fill') as HTMLDivElement;
        const progressText = wrapper.querySelector('.progress-text') as HTMLDivElement;
        const progressDetails = wrapper.querySelector('.progress-details') as HTMLDivElement;

        if (!progressFill || !progressText || !progressDetails) return;

        const percentage = Math.round(progress);
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = `${percentage}%`;
        progressDetails.textContent = `已完成: ${currentBatch} / ${totalBatches} 批次`;
    }

    private createBatches(tasks: TranslationTask[], batchSize: number): TranslationBatch[] {
        const batches: TranslationBatch[] = [];

        for (let i = 0; i < tasks.length; i += batchSize) {
            const batchTasks = tasks.slice(i, i + batchSize);
            const targetLang = batchTasks[0].targetLang;
            batches.push({ tasks: batchTasks, targetLang });
        }

        return batches;
    }

    private async translateBatch(batch: TranslationBatch): Promise<void> {
        try {
            console.log(`开始翻译批次 - ${batch.tasks.length}个任务:`, batch.tasks);
            
            // @ts-ignore
            const apiKey = process.env.DEEPSEEK_API_KEY;
            if (!apiKey) {
                const error = new Error('API Key not found in environment variables');
                console.error(error);
                this.log(error.message, 'error');
                throw error;
            }
            
            for (const task of batch.tasks) {
                if (this.shouldStopTranslation) {
                    console.log('翻译被用户停止');
                    break;
                }

                if (!task.text.trim()) {
                    console.log(`跳过空文本 - 行号: ${task.rowIndex}, 列: ${task.targetColumnIndex}`);
                    continue;
                }

                try {
                    console.log(`翻译请求 - 目标语言: ${task.targetLang}, 文本: ${task.text}`);
                    const response = await fetch('https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${apiKey.trim()}`,
                            'Accept': 'application/json'
                        },
                        body: JSON.stringify({
                            model: "qwen-mt-turbo",
                            messages: [
                                {
                                    role: "user",
                                    content: task.text
                                }
                            ],
                            translation_options: {
                                source_lang: this.sourceLanguageConfig[task.targetLang === 'English' ? 'Chinese' : 'Chinese'].apiCode,
                                target_lang: task.targetLang
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

                    const responseText = await response.text();
                    console.log('API原始响应:', responseText);
                    const data = JSON.parse(responseText);
                    console.log('解析后的响应数据:', data);
                    
                    if (!data.choices?.[0]?.message?.content) {
                        console.error('翻译返回数据格式错误:', data);
                        this.log('翻译返回数据格式错误', 'error');
                        throw new Error('翻译返回数据格式错误');
                    }

                    const translatedText = data.choices[0].message.content.trim();
                    console.log(`翻译成功 - 行号: ${task.rowIndex}, 原文: ${task.text}, 译文: ${translatedText}`);
                    
                    // 更新数据
                    this.data[this.currentSheet].rows[task.rowIndex][task.targetColumnIndex] = translatedText;
                } catch (error: any) {
                    console.error(`单条翻译失败 - 行号: ${task.rowIndex}, 文本: ${task.text}`, error);
                    this.log(`行${task.rowIndex}翻译失败: ${error}`, 'error');
                }
            }
        } catch (error: any) {
            console.error('批次翻译失败:', error);
            this.log(`批次翻译失败: ${error}`, 'error');
            throw error;
        }
    }

    private async processSheet(sheetName: string): Promise<void> {
        const worksheet = this.originalWorkbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];

        if (jsonData.length > 6) { // 确保至少有6行数据
            // 保存前6行原始数据
            const headerRows = jsonData.slice(0, 6);
            // 使用第二行作为表头
            const headers = jsonData[1] as string[];
            // 从第7行开始的数据
            const rows = jsonData.slice(6);

            this.data[sheetName] = {
                headerRows, // 保存前6行
                headers,
                rows
            };
        }
    }

    private prepareTranslationTasks(sourceLang: string, targetLang: string): TranslationTask[] {
        console.log(`准备翻译任务 - 源语言: ${sourceLang}, 目标语言: ${targetLang}`);
        const tasks: TranslationTask[] = [];
        
        if (!this.data || !this.currentSheet) {
            return tasks;
        }

        const sheetData = this.data[this.currentSheet];
        const sourceConfig = this.sourceLanguageConfig[sourceLang];
        const targetMapping = this.languageMappings.find(mapping => mapping.targetLang === targetLang);

        if (!sourceConfig || !targetMapping) {
            return tasks;
        }

        // 获取源语言和目标语言的列索引
        const sourceColumnIndex = this.getColumnIndex(sourceConfig.columnHeader);
        const targetColumnIndex = this.getColumnIndex(targetMapping.columnHeader);

        console.log(`列索引 - 源语言列: ${sourceColumnIndex}, 目标语言列: ${targetColumnIndex}`);

        if (sourceColumnIndex === -1 || targetColumnIndex === -1) {
            return tasks;
        }

        // 遍历每一行，检查源语言列的内容
        sheetData.rows.forEach((row, rowIndex) => {
            const sourceText = row[sourceColumnIndex];
            const targetText = row[targetColumnIndex];

            // 只有当源文本存在且目标文本为空时才需要翻译
            if (sourceText && (!targetText || targetText.trim() === '')) {
                tasks.push({
                    text: sourceText,
                    rowIndex,
                    targetColumnIndex,
                    targetLang
                });
            }
        });

        console.log(`创建了${tasks.length}个翻译任务`);
        return tasks;
    }

    private highlightColumn(table: HTMLElement, colIndex: number): void {
        // 移除所有高亮
        this.clearHighlight();

        // 高亮列序号
        const letterCells = table.querySelectorAll('.column-letter');
        letterCells[colIndex].classList.add('highlight');

        // 高亮表头和数据单元格
        const cells = table.querySelectorAll(`th[data-col-index="${colIndex}"], td[data-col-index="${colIndex}"]`);
        cells.forEach(cell => cell.classList.add('highlight'));
    }

    private highlightRow(row: HTMLTableRowElement): void {
        // 移除所有高亮
        this.clearHighlight();

        // 高亮整行
        row.classList.add('highlight');
    }

    private clearHighlight(): void {
        if (!this.tableOutput) return;

        // 清除列高亮
        const highlightedCells = this.tableOutput.querySelectorAll('.highlight');
        highlightedCells.forEach(cell => cell.classList.remove('highlight'));
    }

    private updateHeaderCell(sheetName: string, colIndex: number, newValue: string): void {
        const sheetData = this.data[sheetName];
        if (!sheetData) return;

        sheetData.headers[colIndex] = newValue;
    }

    private updateDataCell(sheetName: string, rowIndex: number, colIndex: number, newValue: string): void {
        const sheetData = this.data[sheetName];
        if (!sheetData || !sheetData.rows[rowIndex]) return;

        sheetData.rows[rowIndex][colIndex] = newValue;
    }

    private getExcelColumnName(index: number): string {
        let columnName = '';
        let num = index;
        
        while (num >= 0) {
            columnName = String.fromCharCode(65 + (num % 26)) + columnName;
            num = Math.floor(num / 26) - 1;
        }
        
        return columnName;
    }

    private getColumnIndex(header: string): number {
        if (!this.data || !this.currentSheet) return -1;
        
        const sheetData = this.data[this.currentSheet];
        if (!sheetData || !sheetData.headers) return -1;

        return sheetData.headers.findIndex(h => h === header);
    }

    private handleFileSelect = async (event: Event) => {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) {
            this.log('未选择文件', 'error');
            return;
        }

        try {
            await this.loadExcelFile(file);
        } catch (error) {
            this.log('文件处理失败', 'error');
        }
    };
}

// 初始化window.excelTranslatorInstance
window.excelTranslatorInstance = null;

// 使用单例模式初始化应用
document.addEventListener('DOMContentLoaded', () => {
    const translator = ExcelTranslator.getInstance();
    translator.initialize();
});
