import './styles.css';
import { ApiService } from './services/api';
import { TranslationEntry } from './services/database';
import { IKnowledgeBaseManager } from './types/kb-types';
import { KnowledgeBaseModals } from './components/kb-modals';
import { KnowledgeBaseTableRenderer } from './components/kb-table-renderer';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/kb-utils';

// 添加全局实例变量，用于检查是否已经初始化
declare global {
    interface Window {
        knowledgeBaseManagerInstance?: KnowledgeBaseManager;
    }
}

export class KnowledgeBaseManager implements IKnowledgeBaseManager {
    private currentEntries: TranslationEntry[] = [];
    private tableRenderer: KnowledgeBaseTableRenderer;
    private apiService: ApiService;
    
    // DOM元素
    private fileInput!: HTMLInputElement;
    private fileName!: HTMLDivElement;
    private uploadBtn!: HTMLButtonElement;
    private actionButtons!: HTMLDivElement;
    private logOutput!: HTMLDivElement;
    private progressFill!: HTMLDivElement;
    private progressText!: HTMLDivElement;
    private progressDetails!: HTMLDivElement;
    private searchInput!: HTMLInputElement;
    private searchBtn!: HTMLButtonElement;
    private kbTableOutput!: HTMLDivElement;
    private deleteSelectedBtn!: HTMLButtonElement;
    private addEntryBtn!: HTMLButtonElement;
    
    // 日志记录函数
    private logFunction: (message: string, type: 'info' | 'warning' | 'error') => void;

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
        
        // 初始化apiService
        this.apiService = new ApiService(); // 在构造函数中初始化
        
        // 检查是否已经初始化过，避免重复注册事件监听器
        if (!window.knowledgeBaseManagerInstance) {
            // 初始化事件监听器
            this.initialize();
            window.knowledgeBaseManagerInstance = this;
        }
    }

    /**
     * 初始化DOM元素
     */
    private initializeDOMElements(): void {
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.fileName = document.getElementById('fileName') as HTMLDivElement;
        this.uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
        this.actionButtons = document.getElementById('actionButtons') as HTMLDivElement;
        this.logOutput = document.getElementById('logOutput') as HTMLDivElement;
        this.progressFill = document.getElementById('progressFill') as HTMLDivElement;
        this.progressText = document.getElementById('progressText') as HTMLDivElement;
        this.progressDetails = document.getElementById('progressDetails') as HTMLDivElement;
        this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
        this.searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
        this.kbTableOutput = document.getElementById('kbTableOutput') as HTMLDivElement;
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn') as HTMLButtonElement;
        
        // 检查必要的DOM元素是否存在
        if (!this.fileInput || !this.uploadBtn || !this.kbTableOutput) {
            console.error('无法找到必要的DOM元素');
        }
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
                
                // 自动开始导入流程
                this.importFile(file);
            }
        });

        // 上传按钮事件 - 触发文件选择对话框
        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click(); // 点击上传按钮时触发文件选择对话框
        });

        // 搜索按钮事件
        this.searchBtn.addEventListener('click', async () => {
            const searchTerm = this.searchInput.value.trim();
            const entries = await this.searchEntries(searchTerm);
            this.currentEntries = entries;
            this.tableRenderer.renderTable(entries);
        });

        // 搜索输入框回车事件
        this.searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const searchTerm = this.searchInput.value.trim();
                this.searchEntries(searchTerm).then((entries) => {
                    this.currentEntries = entries;
                    this.tableRenderer.renderTable(entries);
                });
            }
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
                        
                        const success = await this.apiService.deleteEntry(cleanId);
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
            // 如果没有搜索词且内存中没有数据，则从数据库加载
            if (!searchTerm && this.currentEntries.length === 0) {
                const entries = await this.apiService.getEntries();
                this.currentEntries = entries;
                this.tableRenderer.renderTable(entries);
                this.log(`加载了 ${entries.length} 条记录`);
                return;
            }
            
            // 如果有搜索词或内存中已有数据，则在内存中搜索
            let filteredEntries = this.currentEntries;
            
            if (searchTerm) {
                const searchTermLower = searchTerm.toLowerCase();
                filteredEntries = this.currentEntries.filter(entry => {
                    // 在所有字段中搜索
                    return Object.values(entry).some(value => {
                        if (typeof value === 'string') {
                            return value.toLowerCase().includes(searchTermLower);
                        }
                        return false;
                    });
                });
                
                this.tableRenderer.renderTable(filteredEntries);
                this.log(`搜索结果: ${filteredEntries.length} 条记录`);
            } else {
                // 如果没有搜索词，显示所有记录
                this.tableRenderer.renderTable(this.currentEntries);
                this.log(`显示全部 ${this.currentEntries.length} 条记录`);
            }
        } catch (error) {
            this.log(`加载失败: ${(error as Error).message}`, 'error');
        }
    }

    /**
     * 搜索条目
     */
    public async searchEntries(searchTerm: string): Promise<TranslationEntry[]> {
        try {
            // 如果搜索词为空，获取所有条目
            if (!searchTerm.trim()) {
                const entries = await this.apiService.getEntries();
                return entries;
            }

            // 使用向量搜索
            const results = await this.apiService.vectorSearch(searchTerm);
            if (results && results.length > 0) {
                // 从结果的payload中提取翻译数据
                const entries = results.map(result => result.payload);
                return entries;
            } else {
                return [];
            }
        } catch (error) {
            console.error('搜索条目时出错:', error);
            this.log('搜索条目失败', 'error');
            return [];
        }
    }

    /**
     * 删除条目
     */
    public async deleteEntry(chinese: string): Promise<void> {
        const confirmDelete = confirm('确定要删除这条记录吗？');
        if (!confirmDelete) return;
        
        try {
            const success = await this.apiService.deleteEntry(chinese);
            
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
                    // 检查主键长度，如果超过100个字符则忽略
                    if (entry.Chinese.length > 100) {
                        this.log(`警告: 忽略过长的主键 "${entry.Chinese.substring(0, 30)}..." (${entry.Chinese.length} 字符)`, 'warning');
                        continue;
                    }
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
     * 导入文件
     */
    public async importFile(file: File): Promise<void> {
        try {
            this.log('开始导入文件...');
            
            // 检查文件类型
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                this.log('只支持.xlsx或.xls格式的Excel文件', 'error');
                return;
            }

            // 开始导入
            const result = await this.apiService.importExcel(file);
            
            if (result.success) {
                this.log(`成功导入 ${result.count} 条记录`, 'info');
                // 刷新数据
                await this.loadEntries();
            } else {
                this.log('导入失败', 'error');
            }
        } catch (error) {
            console.error('导入文件时出错:', error);
            this.log('导入文件失败', 'error');
        }
    }

    /**
     * 初始化
     */
    public initialize(): void {
        // 初始化事件监听器
        this.initializeEventListeners();
        
        // 初始化数据库连接
        this.initializeDatabase();
    }

    /**
     * 记录日志
     */
    public log(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
        this.logFunction(message, type);
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeBaseManagerInstance = new KnowledgeBaseManager();
});
