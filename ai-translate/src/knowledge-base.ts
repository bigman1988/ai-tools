import './styles.css';
import { apiService } from './services/api';
import { TranslationEntry } from './services/database';
import * as XLSX from 'xlsx';
import { KnowledgeBaseTableRenderer } from './components/kb-table-renderer';
import { createLogger } from './utils/kb-utils';
import { IKnowledgeBaseManager } from './types/kb-types';

// 添加全局实例变量，用于检查是否已经初始化
declare global {
    interface Window {
        knowledgeBaseManagerInstance?: KnowledgeBaseManager;
    }
}

export class KnowledgeBaseManager implements IKnowledgeBaseManager {
    private currentEntries: TranslationEntry[] = [];
    private selectedSourceLang: string = 'zh-CN';
    private tableRenderer: KnowledgeBaseTableRenderer;
    
    // DOM元素
    private fileInput!: HTMLInputElement;
    private fileName!: HTMLDivElement;
    private uploadBtn!: HTMLButtonElement;
    private importBtn!: HTMLButtonElement;
    private actionButtons!: HTMLDivElement;
    private logOutput!: HTMLDivElement;
    private progressFill!: HTMLDivElement;
    private progressText!: HTMLDivElement;
    private progressDetails!: HTMLDivElement;
    private searchInput!: HTMLInputElement;
    private searchBtn!: HTMLButtonElement;
    private kbTableOutput!: HTMLDivElement;
    private addEntryBtn!: HTMLButtonElement;
    private deleteSelectedBtn!: HTMLButtonElement;
    private sourceLang!: HTMLSelectElement;
    
    // 日志记录函数
    private logFunction: (message: string, type: 'info' | 'error') => void;

    constructor() {
        // 初始化所有DOM元素
        this.initializeDOMElements();
        
        // 初始化日志函数
        this.logFunction = createLogger(this.logOutput);
        
        // 初始化表格渲染器
        this.tableRenderer = new KnowledgeBaseTableRenderer(
            this.kbTableOutput, 
            this,
            this.deleteEntry.bind(this)
        );
        
        // 检查是否已经初始化过，避免重复注册事件监听器
        if (!window.knowledgeBaseManagerInstance) {
            // 初始化事件监听器
            this.initializeEventListeners();
            // 初始化API服务
            this.initializeDatabase();
            console.log('初始化事件监听器');
        } else {
            console.log('检测到已存在实例，跳过事件监听器初始化');
        }
    }

    /**
     * 初始化DOM元素
     */
    private initializeDOMElements(): void {
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.fileName = document.getElementById('fileName') as HTMLDivElement;
        this.uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
        this.importBtn = document.getElementById('importBtn') as HTMLButtonElement;
        this.actionButtons = document.getElementById('actionButtons') as HTMLDivElement;
        this.logOutput = document.getElementById('logOutput') as HTMLDivElement;
        this.progressFill = document.getElementById('progressFill') as HTMLDivElement;
        this.progressText = document.getElementById('progressText') as HTMLDivElement;
        this.progressDetails = document.getElementById('progressDetails') as HTMLDivElement;
        this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
        this.searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
        this.kbTableOutput = document.getElementById('kbTableOutput') as HTMLDivElement;
        this.addEntryBtn = document.getElementById('addEntryBtn') as HTMLButtonElement;
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn') as HTMLButtonElement;
        this.sourceLang = document.getElementById('sourceLang') as HTMLSelectElement;
    }

    /**
     * 初始化数据库连接
     */
    private async initializeDatabase(): Promise<void> {
        try {
            await this.loadEntries();
            this.log('数据库连接成功');
        } catch (error) {
            this.log(`数据库连接失败: ${(error as Error).message}`, 'error');
        }
    }

    /**
     * 初始化事件监听器
     */
    private initializeEventListeners(): void {
        // 文件选择事件
        this.fileInput.addEventListener('change', (event) => {
            const files = (event.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                const file = files[0];
                this.fileName.textContent = file.name;
                this.actionButtons.style.display = 'block';
            }
        });

        // 上传按钮事件 - 触发文件选择对话框
        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click(); // 点击上传按钮时触发文件选择对话框
        });

        // 导入按钮事件
        this.importBtn.addEventListener('click', async () => {
            try {
                const files = this.fileInput.files;
                if (!files || files.length === 0) {
                    this.log('请先选择文件', 'error');
                    return;
                }
                
                const file = files[0];
                
                // 先处理Excel文件
                this.log(`开始处理Excel文件: ${file.name}`);
                this.processExcelFile(file);
                
                // 显示进度条
                this.progressFill.style.width = '0%';
                this.progressText.textContent = '0%';
                this.progressDetails.textContent = '准备导入...';
                this.progressDetails.style.display = 'block';
                
                // 获取当前选中的源语言
                this.selectedSourceLang = this.sourceLang.value;
                
                // 等待Excel处理完成
                setTimeout(() => {
                    // 获取所有条目
                    const entries = this.currentEntries;
                    
                    if (entries.length === 0) {
                        this.log('没有数据可导入', 'error');
                        return;
                    }
                    
                    // 开始导入
                    this.log(`开始导入 ${entries.length} 条记录`);
                    
                    // 批量导入
                    const batchSize = 1; 
                    let successCount = 0;
                    let failCount = 0;
                    const failedEntries: { entry: TranslationEntry, error: string }[] = [];
                    
                    const importBatch = async (startIndex: number) => {
                        if (startIndex >= entries.length) {
                            // 导入完成
                            this.log(`导入完成，成功: ${successCount}，失败: ${failCount}`);
                            
                            // 显示失败的条目详情
                            if (failCount > 0) {
                                this.log(`失败条目详情：`, 'error');
                                failedEntries.forEach((item, index) => {
                                    this.log(`${index + 1}. 条目: "${item.entry.Chinese}" 失败原因: ${item.error}`, 'error');
                                });
                            }
                            
                            // 刷新数据
                            await this.loadEntries();
                            return;
                        }
                        
                        const endIndex = Math.min(startIndex + batchSize, entries.length);
                        const batch = entries.slice(startIndex, endIndex);
                        
                        try {
                            // 逐条处理，以便记录每条的错误
                            for (const entry of batch) {
                                try {
                                    await apiService.addEntry(entry);
                                    successCount++;
                                } catch (error) {
                                    failCount++;
                                    const errorMessage = (error as Error).message || '未知错误';
                                    failedEntries.push({ entry, error: errorMessage });
                                    this.log(`导入失败: "${entry.Chinese}", 原因: ${errorMessage}`, 'error');
                                }
                            }
                        } catch (error) {
                            // 批处理整体失败的情况
                            failCount += batch.length;
                            const errorMessage = (error as Error).message || '未知错误';
                            this.log(`批量导入失败: ${errorMessage}`, 'error');
                            batch.forEach(entry => {
                                failedEntries.push({ entry, error: errorMessage });
                            });
                        }
                        
                        // 更新进度
                        const progress = Math.round(endIndex / entries.length * 100);
                        this.progressFill.style.width = `${progress}%`;
                        this.progressText.textContent = `${progress}%`;
                        this.progressDetails.textContent = `已处理 ${endIndex} / ${entries.length} 条记录，成功: ${successCount}，失败: ${failCount}`;
                        
                        // 处理下一批
                        setTimeout(() => importBatch(endIndex), 0);
                    };
                    
                    // 开始导入第一批
                    importBatch(0);
                }, 500); // 给Excel处理一些时间
                
            } catch (error) {
                this.log(`导入失败: ${(error as Error).message}`, 'error');
            }
        });

        // 搜索按钮事件
        this.searchBtn.addEventListener('click', () => {
            const searchTerm = this.searchInput.value.trim();
            this.loadEntries(searchTerm);
        });

        // 搜索输入框回车事件
        this.searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const searchTerm = this.searchInput.value.trim();
                this.loadEntries(searchTerm);
            }
        });

        // 添加条目按钮事件
        this.addEntryBtn.addEventListener('click', () => {
            this.tableRenderer.showAddEntryForm();
        });

        // 批量删除按钮事件
        this.deleteSelectedBtn.addEventListener('click', async () => {
            const selectedIds = this.tableRenderer.getSelectedEntryIds();
            
            if (selectedIds.length === 0) {
                this.log('请先选择要删除的条目', 'error');
                return;
            }
            
            const confirmDelete = confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`);
            if (!confirmDelete) return;
            
            try {
                let successCount = 0;
                let failCount = 0;
                
                for (const id of selectedIds) {
                    try {
                        // 确保ID正确处理，打印出实际发送的ID以便调试
                        console.log(`原始ID: "${id}"`);
                        
                        // 预处理ID，移除换行符
                        const cleanId = id.replace(/[\r\n]+/g, ' ').trim();
                        console.log(`处理后ID: "${cleanId}"`);
                        
                        const success = await apiService.deleteEntry(cleanId);
                        if (success) {
                            successCount++;
                        } else {
                            failCount++;
                            this.log(`删除失败: ${cleanId}`, 'error');
                        }
                    } catch (error) {
                        failCount++;
                        this.log(`删除失败 "${id}": ${(error as Error).message}`, 'error');
                    }
                }
                
                this.log(`批量删除完成，成功: ${successCount}，失败: ${failCount}`);
                
                // 刷新数据
                await this.loadEntries();
            } catch (error) {
                this.log(`批量删除失败: ${(error as Error).message}`, 'error');
            }
        });
    }

    /**
     * 加载翻译条目
     */
    public async loadEntries(searchTerm?: string): Promise<void> {
        try {
            const entries = await apiService.getEntries(searchTerm);
            this.currentEntries = entries;
            this.tableRenderer.renderTable(entries);
            
            if (searchTerm) {
                this.log(`搜索结果: ${entries.length} 条记录`);
            } else {
                this.log(`加载了 ${entries.length} 条记录`);
            }
        } catch (error) {
            this.log(`加载失败: ${(error as Error).message}`, 'error');
        }
    }

    /**
     * 删除条目
     */
    public async deleteEntry(chinese: string): Promise<void> {
        const confirmDelete = confirm('确定要删除这条记录吗？');
        if (!confirmDelete) return;
        
        try {
            const success = await apiService.deleteEntry(chinese);
            
            if (success) {
                this.log('删除成功');
                await this.loadEntries();
            } else {
                this.log('删除失败', 'error');
            }
        } catch (error) {
            this.log(`删除失败: ${(error as Error).message}`, 'error');
        }
    }

    /**
     * 处理Excel文件
     */
    private processExcelFile(file: File): void {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 获取第一个工作表
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // 将工作表转换为JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 处理数据
                this.processExcelData(jsonData as any[][]);
            } catch (error) {
                this.log(`Excel文件处理失败: ${(error as Error).message}`, 'error');
            }
        };
        
        reader.onerror = () => {
            this.log('文件读取失败', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }

    /**
     * 处理Excel数据
     */
    private processExcelData(data: any[][]): void {
        try {
            // 检查数据是否有效
            if (!data || data.length < 7) {
                this.log('Excel文件格式不正确，至少需要7行数据', 'error');
                return;
            }
            
            // 获取表头（第2行，索引为1）
            const headers = data[1];
            
            // 定义表头映射
            const headerMap: { [key: string]: string } = {
                '简体中文': 'Chinese',
                '英语': 'English',
                '日语': 'Japanese',
                '韩语': 'Korean',
                '西班牙语': 'Spanish',
                '法语': 'French',
                '德语': 'German',
                '俄语': 'Russian',
                '泰语': 'Thai',
                '意大利语': 'Italian',
                '印尼语': 'Indonesian',
                '葡萄牙语': 'Portuguese'
            };
            
            // 解析表头索引
            const headerIndices: { [key: string]: number } = {};
            headers.forEach((header: string, index: number) => {
                const mappedHeader = headerMap[header];
                if (mappedHeader) {
                    headerIndices[mappedHeader] = index;
                }
            });
            
            // 检查必要的表头是否存在
            if (!headerIndices['Chinese']) {
                this.log('Excel文件缺少必要的表头：简体中文', 'error');
                return;
            }
            
            // 处理数据（从第7行开始，索引为6）
            const entries: TranslationEntry[] = [];
            
            for (let i = 6; i < data.length; i++) {
                const row = data[i];
                
                // 跳过空行
                if (!row || row.length === 0) continue;
                
                // 创建条目对象
                const entry: Partial<TranslationEntry> = {};
                
                // 填充条目数据
                Object.entries(headerIndices).forEach(([field, index]) => {
                    if (index < row.length) {
                        (entry as any)[field] = row[index] || '';
                    }
                });
                
                // 检查必要字段
                if (entry.Chinese) {
                    entries.push(entry as TranslationEntry);
                }
            }
            
            // 更新当前条目
            this.currentEntries = entries;
            
            // 渲染表格
            this.tableRenderer.renderTable(entries);
            
            this.log(`成功解析 ${entries.length} 条记录`);
        } catch (error) {
            this.log(`数据处理失败: ${(error as Error).message}`, 'error');
        }
    }

    /**
     * 记录日志
     */
    public log(message: string, type: 'info' | 'error' = 'info'): void {
        this.logFunction(message, type);
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeBaseManagerInstance = new KnowledgeBaseManager();
});
