import './styles.css';
import { apiService } from './services/api';
import { TranslationEntry } from './services/database';
import * as XLSX from 'xlsx';

// 添加全局实例变量，用于检查是否已经初始化
declare global {
    interface Window {
        knowledgeBaseManagerInstance?: KnowledgeBaseManager;
    }
}

export class KnowledgeBaseManager {
    private currentEntries: TranslationEntry[] = [];
    private selectedSourceLang: string = 'zh-CN';

    // 使用!操作符告诉TypeScript这些属性会在构造函数中被初始化
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

    constructor() {
        // 初始化所有DOM元素
        this.initializeDOMElements();
        
        // 初始化API服务
        this.initializeDatabase();
        
        // 检查是否已经初始化过，避免重复注册事件监听器
        if (!window.knowledgeBaseManagerInstance) {
            // 初始化事件监听器
            this.initializeEventListeners();
            console.log('初始化事件监听器');
        } else {
            console.log('检测到已存在实例，跳过事件监听器初始化');
        }
    }

    private initializeDOMElements(): void {
        // 初始化所有DOM元素引用
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.fileName = document.getElementById('fileName') as HTMLDivElement;
        this.uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
        this.importBtn = document.getElementById('importBtn') as HTMLButtonElement;
        this.actionButtons = document.getElementById('actionButtons') as HTMLDivElement;
        this.logOutput = document.getElementById('logOutput') as HTMLDivElement;
        this.progressFill = document.querySelector('.progress-fill') as HTMLDivElement;
        this.progressText = document.querySelector('.progress-text') as HTMLDivElement;
        this.progressDetails = document.querySelector('.progress-details') as HTMLDivElement;
        this.searchInput = document.getElementById('searchInput') as HTMLInputElement;
        this.searchBtn = document.getElementById('searchBtn') as HTMLButtonElement;
        this.kbTableOutput = document.getElementById('kbTableOutput') as HTMLDivElement;
        this.addEntryBtn = document.getElementById('addEntryBtn') as HTMLButtonElement;
        this.deleteSelectedBtn = document.getElementById('deleteSelectedBtn') as HTMLButtonElement;
        this.sourceLang = document.getElementById('sourceLang') as HTMLSelectElement;
    }

    private async initializeDatabase(): Promise<void> {
        try {
            // 使用API服务初始化数据库连接（实际上是检查API服务器是否可用）
            await apiService.initializeDatabase();
            this.log('API服务器连接成功');
            await this.loadEntries();
        } catch (error) {
            this.log(`API服务器连接失败: ${(error as Error).message}`, 'error');
        }
    }

    private async initializeEventListeners() {
        // 初始化源语言选择器
        this.sourceLang.value = this.selectedSourceLang;
        this.sourceLang.addEventListener('change', (e) => {
            this.selectedSourceLang = (e.target as HTMLSelectElement).value;
        });

        // 初始化文件选择按钮
        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // 初始化文件输入
        this.fileInput.addEventListener('change', (e) => {
            const files = (e.target as HTMLInputElement).files;
            if (files && files.length > 0) {
                const file = files[0];
                this.fileName.textContent = file.name;
                
                this.actionButtons.style.display = 'block';
            }
        });

        // 初始化导入按钮
        this.importBtn.addEventListener('click', async () => {
            const files = this.fileInput.files;
            
            if (!files || files.length === 0) {
                this.log('请先选择要导入的文件', 'error');
                return;
            }

            try {
                const result = await apiService.importExcel(files[0]);
                this.log(`导入成功，共导入 ${result.count} 条记录`);
                await this.loadEntries();
                
                // 清理文件选择
                this.fileInput.value = '';
                this.fileName.textContent = '';
                this.actionButtons.style.display = 'none';
            } catch (error) {
                this.log(`导入失败: ${(error as Error).message}`, 'error');
            }
        });

        // 初始化搜索按钮
        this.searchBtn.addEventListener('click', () => {
            this.loadEntries(this.searchInput.value);
        });

        // 初始化搜索输入框的回车事件
        this.searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.loadEntries(this.searchInput.value);
            }
        });

        // 初始化添加条目按钮
        this.addEntryBtn.addEventListener('click', () => {
            this.showAddEntryForm();
        });

        // 初始化删除所选按钮
        this.deleteSelectedBtn.addEventListener('click', async () => {
            const selectedIds = this.getSelectedEntryIds();
            if (selectedIds.length === 0) {
                this.log('请先选择要删除的条目', 'error');
                return;
            }

            const confirmDelete = confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`);
            if (confirmDelete) {
                try {
                    let deletedCount = 0;
                    for (const id of selectedIds) {
                        // 不需要再次使用encodeURIComponent，API服务中已经处理了
                        const success = await apiService.deleteEntry(id.toString());
                        if (success) deletedCount++;
                    }
                    
                    this.log(`成功删除 ${deletedCount} 条记录`);
                    await this.loadEntries();
                } catch (error) {
                    this.log(`删除失败: ${(error as Error).message}`, 'error');
                }
            }
        });
    }

    private async loadEntries(searchTerm?: string): Promise<void> {
        try {
            this.log('加载翻译条目...');
            this.currentEntries = await apiService.getEntries(searchTerm);
            this.renderTable(this.currentEntries);
            this.log(`已加载 ${this.currentEntries.length} 条翻译条目`);
        } catch (error) {
            this.log(`加载条目失败: ${(error as Error).message}`, 'error');
        }
    }

    private renderTable(entries: TranslationEntry[]): void {
        const container = document.getElementById('kbTableOutput');
        if (!container) return;

        // 创建表格容器
        container.innerHTML = `
            <div class="table-wrapper">
                <table class="kb-table">
                    <thead>
                        <tr>
                            <th class="checkbox-cell"><input type="checkbox" id="selectAll"></th>
                            <th>中文</th>
                            <th>英文</th>
                            <th>日文</th>
                            <th>韩文</th>
                            <th>西班牙文</th>
                            <th>法文</th>
                            <th>德文</th>
                            <th>俄文</th>
                            <th>泰文</th>
                            <th>意大利文</th>
                            <th>印尼文</th>
                            <th>葡萄牙文</th>
                            <th>操作</th>
                        </tr>
                    </thead>
                    <tbody id="entriesTableBody">
                    </tbody>
                </table>
            </div>
        `;

        // 获取表格体
        const tableBody = document.getElementById('entriesTableBody');
        if (!tableBody) return;

        // 添加表格内容
        entries.forEach((entry, index) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td class="checkbox-cell"><input type="checkbox" class="entry-checkbox" data-id="${entry.Chinese}"></td>
                <td>${this.escapeHtml(entry.Chinese || '')}</td>
                <td>${this.escapeHtml(entry.English || '')}</td>
                <td>${this.escapeHtml(entry.Japanese || '')}</td>
                <td>${this.escapeHtml(entry.Korean || '')}</td>
                <td>${this.escapeHtml(entry.Spanish || '')}</td>
                <td>${this.escapeHtml(entry.French || '')}</td>
                <td>${this.escapeHtml(entry.German || '')}</td>
                <td>${this.escapeHtml(entry.Russian || '')}</td>
                <td>${this.escapeHtml(entry.Thai || '')}</td>
                <td>${this.escapeHtml(entry.Italian || '')}</td>
                <td>${this.escapeHtml(entry.Indonesian || '')}</td>
                <td>${this.escapeHtml(entry.Portuguese || '')}</td>
                <td>
                    <button class="btn-small view-btn" data-id="${entry.Chinese}">查看</button>
                    <button class="btn-small edit-btn" data-id="${entry.Chinese}">编辑</button>
                    <button class="btn-small delete-btn" data-id="${entry.Chinese}">删除</button>
                </td>
            `;
            tableBody.appendChild(tr);
        });

        // 添加全选功能
        const selectAllCheckbox = document.getElementById('selectAll') as HTMLInputElement;
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.entry-checkbox') as NodeListOf<HTMLInputElement>;
                checkboxes.forEach(checkbox => {
                    checkbox.checked = selectAllCheckbox.checked;
                });
            });
        }

        // 添加查看按钮事件监听器
        const viewButtons = document.querySelectorAll('.view-btn') as NodeListOf<HTMLButtonElement>;
        viewButtons.forEach(button => {
            button.addEventListener('click', () => {
                const chinese = button.getAttribute('data-id') || '';
                const entry = this.currentEntries.find(e => e.Chinese === chinese);
                if (entry) {
                    this.showEntryDetails(entry);
                }
            });
        });

        // 添加编辑按钮事件监听器
        const editButtons = document.querySelectorAll('.edit-btn') as NodeListOf<HTMLButtonElement>;
        editButtons.forEach(button => {
            button.addEventListener('click', () => {
                const chinese = button.getAttribute('data-id') || '';
                const entry = this.currentEntries.find(e => e.Chinese === chinese);
                if (entry) {
                    this.showEditEntryForm(entry);
                }
            });
        });

        // 添加删除按钮事件监听器
        const deleteButtons = document.querySelectorAll('.delete-btn') as NodeListOf<HTMLButtonElement>;
        deleteButtons.forEach(button => {
            button.addEventListener('click', async () => {
                const chinese = button.getAttribute('data-id') || '';
                await this.deleteEntry(chinese);
            });
        });
    }

    // 添加单独的删除条目方法
    private async deleteEntry(chinese: string): Promise<void> {
        try {
            const confirmDelete = confirm(`确定要删除该条目吗？`);
            if (!confirmDelete) return;

            // 不需要再次使用encodeURIComponent，API服务中已经处理了
            const success = await apiService.deleteEntry(chinese);
            if (success) {
                this.log('删除条目成功');
                await this.loadEntries();
            } else {
                this.log('删除条目失败', 'error');
            }
        } catch (error) {
            this.log(`删除条目失败: ${(error as Error).message}`, 'error');
        }
    }

    private showEntryDetails(entry: TranslationEntry): void {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // 添加所有字段
        const fields = [
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
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>查看翻译条目</h2>
                <div class="entry-details">
        `;
        
        fields.forEach(field => {
            const value = entry[field.key as keyof TranslationEntry];
            content += `
                <div class="entry-field">
                    <label>${field.label}:</label>
                    <div class="field-value">${this.escapeHtml(value?.toString() || '')}</div>
                </div>
            `;
        });
        
        content += `
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // 添加关闭按钮事件
        const closeBtn = modal.querySelector('.close');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => {
                document.body.removeChild(modal);
            });
        }
    }

    private showEditEntryForm(entry: TranslationEntry): void {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // 添加所有可编辑字段
        const fields = [
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
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>编辑翻译条目</h2>
                <form id="editEntryForm">
                    <input type="hidden" id="entryChinese" value="${entry.Chinese}">
        `;
        
        // 添加所有可编辑字段
        fields.forEach(field => {
            const value = entry[field.key as keyof TranslationEntry];
            content += `
                <div class="form-group">
                    <label for="${field.key}">${field.label}:</label>
                    <textarea id="${field.key}" class="form-control" rows="2">${this.escapeHtml(value?.toString() || '')}</textarea>
                </div>
            `;
        });
        
        content += `
                    <div class="form-group">
                        <button type="submit" class="btn">保存</button>
                        <button type="button" class="btn cancel-btn">取消</button>
                    </div>
                </form>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // 添加关闭按钮事件
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        // 添加表单提交事件
        const form = modal.querySelector('#editEntryForm') as HTMLFormElement;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const entryChinese = (document.getElementById('entryChinese') as HTMLInputElement).value;
            const updatedEntry: Partial<TranslationEntry> = {};
            
            // 收集表单数据
            fields.forEach(field => {
                const input = document.getElementById(field.key) as HTMLTextAreaElement;
                (updatedEntry as any)[field.key] = input.value;
            });
            
            try {
                // 使用API服务更新条目
                await apiService.updateEntry(entryChinese, updatedEntry);
                this.log('条目更新成功');
                document.body.removeChild(modal);
                
                // 刷新数据
                await this.loadEntries();
            } catch (error) {
                this.log(`更新失败: ${(error as Error).message}`, 'error');
            }
        });
    }

    private showAddEntryForm(): void {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        // 添加所有可编辑字段
        const fields = [
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
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>添加翻译条目</h2>
                <form id="addEntryForm">
        `;
        
        // 添加所有可编辑字段
        fields.forEach(field => {
            content += `
                <div class="form-group">
                    <label for="${field.key}">${field.label}:</label>
                    <textarea id="${field.key}" class="form-control" rows="2"></textarea>
                </div>
            `;
        });
        
        content += `
                    <div class="form-group">
                        <button type="submit" class="btn">保存</button>
                        <button type="button" class="btn cancel-btn">取消</button>
                    </div>
                </form>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // 添加关闭按钮事件
        const closeBtn = modal.querySelector('.close');
        const cancelBtn = modal.querySelector('.cancel-btn');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        // 添加表单提交事件
        const form = modal.querySelector('#addEntryForm') as HTMLFormElement;
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newEntry: Partial<TranslationEntry> = {};
            
            // 收集表单数据
            fields.forEach(field => {
                const input = document.getElementById(field.key) as HTMLTextAreaElement;
                (newEntry as any)[field.key] = input.value;
            });
            
            try {
                // 使用API服务添加条目
                await apiService.addEntry(newEntry);
                this.log('条目添加成功');
                document.body.removeChild(modal);
                
                // 刷新数据
                await this.loadEntries();
            } catch (error) {
                this.log(`添加失败: ${(error as Error).message}`, 'error');
            }
        });
    }

    private getSelectedEntryIds(): string[] {
        const selectedIds: string[] = [];
        const checkboxes = document.querySelectorAll('.entry-checkbox:checked') as NodeListOf<HTMLInputElement>;
        
        checkboxes.forEach(checkbox => {
            const chinese = checkbox.getAttribute('data-id') || '';
            if (chinese) {
                selectedIds.push(chinese);
            }
        });
        
        return selectedIds;
    }

    private log(message: string, type: 'info' | 'error' = 'info'): void {
        const logOutput = document.getElementById('logOutput');
        if (!logOutput) return;

        const logEntry = document.createElement('div');
        logEntry.className = `log-entry ${type}`;
        logEntry.textContent = message;
        logOutput.appendChild(logEntry);
        logOutput.scrollTop = logOutput.scrollHeight;
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.knowledgeBaseManagerInstance = new KnowledgeBaseManager();
});
