import './styles.css';
import { ApiService } from './services/api.js';
import { KnowledgeBaseModals } from './components/kb-modals.js';
import { KnowledgeBaseTableRenderer } from './components/kb-table-renderer.js';
import * as XLSX from 'xlsx';
import { createLogger } from './utils/kb-utils.js';

// 添加全局实例变量，用于检查是否已经初始化
// 注意：在JavaScript中，我们不需要声明global接口，直接使用window对象

export class KnowledgeBaseManager {
    constructor() {
        // 初始化属性
        this.currentEntries = [];
        
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
    initializeDOMElements() {
        this.fileInput = document.getElementById('fileInput');
        this.fileName = document.getElementById('fileName');
        this.uploadBtn = document.getElementById('uploadBtn');
        this.actionButtons = document.getElementById('actionButtons');
        this.logOutput = document.getElementById('logOutput');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.progressDetails = document.getElementById('progressDetails');
        this.searchInput = document.getElementById('searchInput');
        this.searchBtn = document.getElementById('searchBtn');
        this.kbTableOutput = document.getElementById('kbTableOutput');
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn');
        
        // 检查必要的DOM元素是否存在
        if (!this.fileInput || !this.uploadBtn || !this.kbTableOutput) {
            console.error('无法找到必要的DOM元素');
        }
    }

    /**
     * 初始化数据库连接
     */
    async initializeDatabase() {
        try {
            await this.loadEntries();
            this.log('数据库连接成功');
        } catch (error) {
            this.log(`数据库连接失败: ${error.message}`, 'error');
        }
    }

    /**
     * 初始化事件监听器
     */
    initializeEventListeners() {
        // 文件选择事件
        this.fileInput.addEventListener('change', (event) => {
            const files = event.target.files;
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
            await this.loadEntries(searchTerm);
        });

        // 搜索输入框回车事件
        this.searchInput.addEventListener('keypress', (event) => {
            if (event.key === 'Enter') {
                const searchTerm = this.searchInput.value.trim();
                this.loadEntries(searchTerm).then();
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
                        this.log(`删除失败 "${id}": ${error.message}`, 'error');
                    }
                }
                
                this.log(`批量删除完成，成功: ${successCount}，失败: ${failCount}`);
                
                // 刷新数据
                await this.loadEntries();
            } catch (error) {
                this.log(`批量删除失败: ${error.message}`, 'error');
            }
        });
    }

    /**
     * 加载翻译条目
     * @param {string} [searchTerm] - 可选的搜索词
     * @returns {Promise<void>}
     */
    async loadEntries(searchTerm) {
        try {
            // 始终从数据库重新加载数据，确保数据是最新的
            const entries = await this.apiService.getEntries();
            this.currentEntries = entries;
            
            // 如果有搜索词，则在新加载的数据中过滤
            if (searchTerm) {
                const searchTermLower = searchTerm.toLowerCase();
                const filteredEntries = this.currentEntries.filter(entry => {
                    // 在所有字段中搜索
                    return Object.values(entry).some(value => {
                        if (typeof value === 'string') {
                            return value.toLowerCase().includes(searchTermLower);
                        }
                        return false;
                    });
                });
                
                this.tableRenderer.renderTable(filteredEntries);
                this.log(`找到 ${filteredEntries.length} 条匹配记录`);
            } else {
                // 没有搜索词，显示所有数据
                this.tableRenderer.renderTable(entries);
                this.log(`加载了 ${entries.length} 条记录`);
            }
        } catch (error) {
            console.error('加载条目时出错:', error);
            this.log('加载条目失败', 'error');
        }
    }

    /**
     * 搜索条目
     * @param {string} searchTerm - 搜索词
     * @returns {Promise<Array>} - 返回匹配的翻译条目
     */
    async searchEntries(searchTerm) {
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
     * @param {string} chinese - 中文文本（作为主键）
     * @returns {Promise<void>}
     */
    async deleteEntry(chinese) {
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
            this.log(`删除失败: ${error.message}`, 'error');
        }
    }

    /**
     * 处理Excel文件
     * @param {File} file - Excel文件
     */
    processExcelFile(file) {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target?.result);
                const workbook = XLSX.read(data, { type: 'array' });
                
                // 获取第一个工作表
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // 将工作表转换为JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                
                // 处理数据
                this.processExcelData(jsonData);
            } catch (error) {
                this.log(`Excel文件处理失败: ${error.message}`, 'error');
            }
        };
        
        reader.onerror = () => {
            this.log('文件读取失败', 'error');
        };
        
        reader.readAsArrayBuffer(file);
    }

    /**
     * 处理Excel数据
     * @param {Array<Array>} data - Excel数据
     */
    processExcelData(data) {
        try {
            // 检查数据是否有效
            if (!data || data.length < 7) {
                this.log('Excel文件格式不正确，至少需要7行数据', 'error');
                return;
            }
            
            // 获取表头（第2行，索引为1）
            const headers = data[1];
            
            // 定义表头映射
            const headerMap = {
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
                '葡萄牙语': 'Portuguese',
                '越南语': 'Vietnamese',
                '繁体中文': 'TraditionalChinese'
            };
            
            // 解析表头索引
            const headerIndices = {};
            headers.forEach((header, index) => {
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
            const entries = [];
            
            for (let i = 6; i < data.length; i++) {
                const row = data[i];
                
                // 跳过空行
                if (!row || row.length === 0) continue;
                
                // 创建条目对象
                const entry = {};
                
                // 填充条目数据
                Object.entries(headerIndices).forEach(([field, index]) => {
                    if (index < row.length) {
                        entry[field] = row[index] || '';
                    }
                });
                
                // 检查必要字段
                if (entry.Chinese) {
                    // 检查主键长度，如果超过100个字符则忽略
                    if (entry.Chinese.length > 100) {
                        this.log(`警告: 忽略过长的主键 "${entry.Chinese.substring(0, 30)}..." (${entry.Chinese.length} 字符)`, 'warning');
                        continue;
                    }
                    entries.push(entry);
                }
            }
            
            // 更新当前条目
            this.currentEntries = entries;
            
            // 渲染表格
            this.tableRenderer.renderTable(entries);
            
            this.log(`成功解析 ${entries.length} 条记录`);
        } catch (error) {
            this.log(`数据处理失败: ${error.message}`, 'error');
        }
    }

    /**
     * 导入文件
     * @param {File} file - 要导入的文件
     * @returns {Promise<void>}
     */
    async importFile(file) {
        try {
            this.log('开始导入文件...');
            console.log('开始导入文件:', file.name, '大小:', file.size, '类型:', file.type);
            
            // 检查文件类型
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                this.log('只支持.xlsx或.xls格式的Excel文件', 'error');
                console.error('文件格式不支持:', file.name);
                return;
            }

            // 显示进度条
            this.progressFill.style.width = '50%';
            this.progressText.textContent = '导入中...';
            this.progressDetails.textContent = `正在导入 ${file.name}`;

            // 开始导入
            console.log('调用API导入文件');
            const result = await this.apiService.importExcel(file);
            console.log('导入结果:', result);
            
            if (result.success) {
                this.log(`成功导入 ${result.count} 条记录`, 'info');
                console.log(`成功导入 ${result.count} 条记录`);
                
                // 更新进度条
                this.progressFill.style.width = '100%';
                this.progressText.textContent = '导入完成';
                this.progressDetails.textContent = `成功导入 ${result.count} 条记录`;
                
                // 刷新数据
                console.log('开始刷新数据表');
                await this.loadEntries();
                console.log('数据表刷新完成');
            } else {
                const errorMessage = result.error || '导入失败';
                this.log(errorMessage, 'error');
                console.error('导入失败:', errorMessage);
                
                // 更新进度条
                this.progressFill.style.width = '0%';
                this.progressText.textContent = '导入失败';
                this.progressDetails.textContent = errorMessage;
                
                // 显示详细错误信息
                alert(`导入失败: ${errorMessage}`);
            }
        } catch (error) {
            console.error('导入文件时出错:', error);
            this.log(`导入文件失败: ${error.message}`, 'error');
            
            // 更新进度条
            this.progressFill.style.width = '0%';
            this.progressText.textContent = '导入失败';
            this.progressDetails.textContent = error.message;
            
            // 显示详细错误信息
            alert(`导入文件失败: ${error.message}`);
        }
    }

    /**
     * 初始化
     */
    initialize() {
        // 初始化事件监听器
        this.initializeEventListeners();
        
        // 初始化数据库连接
        this.initializeDatabase();
    }

    /**
     * 记录日志
     * @param {string} message - 日志消息
     * @param {'info' | 'warning' | 'error'} [type='info'] - 日志类型
     */
    log(message, type = 'info') {
        // 使用日志函数记录日志
        this.logFunction(message, type);
        
        // 同时在控制台记录
        if (type === 'info') {
            console.log(`[知识库] ${message}`);
        } else if (type === 'warning') {
            console.warn(`[知识库] ${message}`);
        } else if (type === 'error') {
            console.error(`[知识库] ${message}`);
        }
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeBaseManagerInstance = new KnowledgeBaseManager();
});
