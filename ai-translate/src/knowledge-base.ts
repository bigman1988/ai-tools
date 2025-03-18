import './styles.css';
import { excelImporter } from './services/excel-importer';
import { databaseService, TranslationEntry } from './services/database';
import * as XLSX from 'xlsx';

class KnowledgeBaseManager {
    private fileInput: HTMLInputElement;
    private fileName: HTMLDivElement;
    private uploadBtn: HTMLButtonElement;
    private importBtn: HTMLButtonElement;
    private exportBtn: HTMLButtonElement;
    private actionButtons: HTMLDivElement;
    private logOutput: HTMLDivElement;
    private progressFill: HTMLDivElement;
    private progressText: HTMLDivElement;
    private progressDetails: HTMLDivElement;
    private searchInput: HTMLInputElement;
    private searchBtn: HTMLButtonElement;
    private kbTableOutput: HTMLDivElement;
    private addEntryBtn: HTMLButtonElement;
    private deleteSelectedBtn: HTMLButtonElement;
    private sourceLang: HTMLSelectElement;
    private targetLang: HTMLSelectElement;
    private selectedFile: File | null = null;
    private currentEntries: TranslationEntry[] = [];

    constructor() {
        this.fileInput = document.getElementById('fileInput') as HTMLInputElement;
        this.fileName = document.getElementById('fileName') as HTMLDivElement;
        this.uploadBtn = document.getElementById('uploadBtn') as HTMLButtonElement;
        this.importBtn = document.getElementById('importBtn') as HTMLButtonElement;
        this.exportBtn = document.getElementById('exportBtn') as HTMLButtonElement;
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
        this.targetLang = document.getElementById('targetLang') as HTMLSelectElement;

        this.initEventListeners();
        this.initDatabase();
    }

    private initEventListeners(): void {
        // 文件上传按钮点击事件
        this.uploadBtn.addEventListener('click', () => {
            this.fileInput.click();
        });

        // 文件选择事件
        this.fileInput.addEventListener('change', (event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                this.selectedFile = target.files[0];
                this.fileName.textContent = this.selectedFile.name;
                this.actionButtons.style.display = 'block';
                this.log(`已选择文件: ${this.selectedFile.name}`);
            }
        });

        // 导入按钮点击事件
        this.importBtn.addEventListener('click', async () => {
            if (!this.selectedFile) {
                this.log('请先选择一个Excel文件', 'error');
                return;
            }

            try {
                this.importBtn.disabled = true;
                this.log('开始导入数据...');
                this.showProgress(0);
                this.progressDetails.style.display = 'block';
                this.progressDetails.textContent = '正在处理...';

                const importedCount = await excelImporter.importExcelToDatabase(this.selectedFile);
                
                this.showProgress(100);
                this.progressDetails.textContent = `已完成: ${importedCount} 条目`;
                this.log(`成功导入 ${importedCount} 条翻译条目到数据库`);
                
                // 刷新表格显示
                await this.loadEntries();
            } catch (error) {
                this.log(`导入失败: ${(error as Error).message}`, 'error');
                this.showProgress(0);
            } finally {
                this.importBtn.disabled = false;
            }
        });

        // 导出按钮点击事件
        this.exportBtn.addEventListener('click', async () => {
            try {
                this.exportBtn.disabled = true;
                this.log('开始导出数据...');
                
                // 获取所有条目
                const entries = await databaseService.getEntries(undefined, 10000, 0);
                
                if (entries.length === 0) {
                    this.log('没有数据可导出', 'warning');
                    return;
                }
                
                // 创建工作簿
                const workbook = XLSX.utils.book_new();
                
                // 将数据转换为工作表
                const worksheet = XLSX.utils.json_to_sheet(entries);
                
                // 将工作表添加到工作簿
                XLSX.utils.book_append_sheet(workbook, worksheet, '翻译数据');
                
                // 导出为Excel文件
                XLSX.writeFile(workbook, '翻译知识库导出.xlsx');
                
                this.log(`成功导出 ${entries.length} 条翻译条目`);
            } catch (error) {
                this.log(`导出失败: ${(error as Error).message}`, 'error');
            } finally {
                this.exportBtn.disabled = false;
            }
        });

        // 搜索按钮点击事件
        this.searchBtn.addEventListener('click', async () => {
            const searchTerm = this.searchInput.value.trim();
            await this.loadEntries(searchTerm);
        });

        // 搜索输入框回车事件
        this.searchInput.addEventListener('keyup', async (event) => {
            if (event.key === 'Enter') {
                const searchTerm = this.searchInput.value.trim();
                await this.loadEntries(searchTerm);
            }
        });

        // 添加条目按钮点击事件
        this.addEntryBtn.addEventListener('click', () => {
            this.showAddEntryForm();
        });

        // 删除所选按钮点击事件
        this.deleteSelectedBtn.addEventListener('click', async () => {
            const selectedIds = this.getSelectedEntryIds();
            if (selectedIds.length === 0) {
                this.log('请先选择要删除的条目', 'warning');
                return;
            }

            if (confirm(`确定要删除选中的 ${selectedIds.length} 条记录吗？`)) {
                try {
                    let deletedCount = 0;
                    for (const id of selectedIds) {
                        const success = await databaseService.deleteEntry(id);
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

    private async initDatabase(): Promise<void> {
        try {
            await databaseService.initializeDatabase();
            this.log('数据库连接成功');
            await this.loadEntries();
        } catch (error) {
            this.log(`数据库初始化失败: ${(error as Error).message}`, 'error');
        }
    }

    private async loadEntries(searchTerm?: string): Promise<void> {
        try {
            this.log('加载翻译条目...');
            this.currentEntries = await databaseService.getEntries(searchTerm);
            this.renderEntriesTable(this.currentEntries);
            this.log(`已加载 ${this.currentEntries.length} 条翻译条目`);
        } catch (error) {
            this.log(`加载条目失败: ${(error as Error).message}`, 'error');
        }
    }

    private renderEntriesTable(entries: TranslationEntry[]): void {
        if (entries.length === 0) {
            this.kbTableOutput.innerHTML = '<div class="empty-state">没有找到翻译条目</div>';
            return;
        }

        // 创建表格
        let tableHtml = `
            <table class="kb-table">
                <thead>
                    <tr>
                        <th><input type="checkbox" id="selectAll"></th>
                        <th>ID</th>
                        <th>中文</th>
                        <th>英语</th>
                        <th>日语</th>
                        <th>操作</th>
                    </tr>
                </thead>
                <tbody>
        `;

        // 添加表格行
        entries.forEach(entry => {
            tableHtml += `
                <tr data-id="${entry.id}">
                    <td><input type="checkbox" class="entry-checkbox"></td>
                    <td>${entry.id}</td>
                    <td>${this.escapeHtml(entry.Chinese)}</td>
                    <td>${this.escapeHtml(entry.English)}</td>
                    <td>${this.escapeHtml(entry.Japanese)}</td>
                    <td>
                        <button class="btn-small view-btn">查看</button>
                        <button class="btn-small edit-btn">编辑</button>
                        <button class="btn-small delete-btn">删除</button>
                    </td>
                </tr>
            `;
        });

        tableHtml += `
                </tbody>
            </table>
        `;

        this.kbTableOutput.innerHTML = tableHtml;

        // 添加全选功能
        const selectAllCheckbox = document.getElementById('selectAll') as HTMLInputElement;
        selectAllCheckbox.addEventListener('change', () => {
            const checkboxes = document.querySelectorAll('.entry-checkbox') as NodeListOf<HTMLInputElement>;
            checkboxes.forEach(checkbox => {
                checkbox.checked = selectAllCheckbox.checked;
            });
        });

        // 添加行操作按钮事件
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                const row = (event.target as HTMLElement).closest('tr');
                const id = Number(row?.getAttribute('data-id'));
                const entry = this.currentEntries.find(e => e.id === id);
                if (entry) {
                    this.showEntryDetails(entry);
                }
            });
        });

        document.querySelectorAll('.edit-btn').forEach(btn => {
            btn.addEventListener('click', (event) => {
                const row = (event.target as HTMLElement).closest('tr');
                const id = Number(row?.getAttribute('data-id'));
                const entry = this.currentEntries.find(e => e.id === id);
                if (entry) {
                    this.showEditEntryForm(entry);
                }
            });
        });

        document.querySelectorAll('.delete-btn').forEach(btn => {
            btn.addEventListener('click', async (event) => {
                const row = (event.target as HTMLElement).closest('tr');
                const id = Number(row?.getAttribute('data-id'));
                
                if (confirm('确定要删除这条记录吗？')) {
                    try {
                        const success = await databaseService.deleteEntry(id);
                        if (success) {
                            this.log(`成功删除ID为 ${id} 的记录`);
                            await this.loadEntries();
                        } else {
                            this.log(`删除ID为 ${id} 的记录失败`, 'error');
                        }
                    } catch (error) {
                        this.log(`删除失败: ${(error as Error).message}`, 'error');
                    }
                }
            });
        });
    }

    private showEntryDetails(entry: TranslationEntry): void {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>条目详情 (ID: ${entry.id})</h2>
                <div class="entry-details">
        `;
        
        // 添加所有语言的详情
        const languages = [
            { code: 'Chinese', name: '中文' },
            { code: 'English', name: '英语' },
            { code: 'Japanese', name: '日语' },
            { code: 'Korean', name: '韩语' },
            { code: 'Spanish', name: '西班牙语' },
            { code: 'French', name: '法语' },
            { code: 'German', name: '德语' },
            { code: 'Russian', name: '俄语' },
            { code: 'Thai', name: '泰语' },
            { code: 'Italian', name: '意大利语' },
            { code: 'Indonesian', name: '印尼语' },
            { code: 'Portuguese', name: '葡萄牙语' }
        ];
        
        languages.forEach(lang => {
            content += `
                <div class="detail-item">
                    <div class="detail-label">${lang.name}:</div>
                    <div class="detail-value">${this.escapeHtml(entry[lang.code as keyof TranslationEntry] as string || '')}</div>
                </div>
            `;
        });
        
        content += `
                </div>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // 关闭模态框
        const closeBtn = modal.querySelector('.close') as HTMLElement;
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 点击模态框外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    private showEditEntryForm(entry: TranslationEntry): void {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>编辑条目 (ID: ${entry.id})</h2>
                <form id="editEntryForm">
        `;
        
        // 添加所有语言的输入框
        const languages = [
            { code: 'Chinese', name: '中文' },
            { code: 'English', name: '英语' },
            { code: 'Japanese', name: '日语' },
            { code: 'Korean', name: '韩语' },
            { code: 'Spanish', name: '西班牙语' },
            { code: 'French', name: '法语' },
            { code: 'German', name: '德语' },
            { code: 'Russian', name: '俄语' },
            { code: 'Thai', name: '泰语' },
            { code: 'Italian', name: '意大利语' },
            { code: 'Indonesian', name: '印尼语' },
            { code: 'Portuguese', name: '葡萄牙语' }
        ];
        
        languages.forEach(lang => {
            content += `
                <div class="form-group">
                    <label for="${lang.code}">${lang.name}:</label>
                    <textarea id="${lang.code}" name="${lang.code}" rows="2">${this.escapeHtml(entry[lang.code as keyof TranslationEntry] as string || '')}</textarea>
                </div>
            `;
        });
        
        content += `
                    <div class="form-actions">
                        <button type="submit" class="btn">保存</button>
                        <button type="button" class="btn btn-cancel">取消</button>
                    </div>
                </form>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // 关闭模态框
        const closeBtn = modal.querySelector('.close') as HTMLElement;
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 取消按钮
        const cancelBtn = modal.querySelector('.btn-cancel') as HTMLElement;
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 提交表单
        const form = document.getElementById('editEntryForm') as HTMLFormElement;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const updatedEntry: Partial<TranslationEntry> = {};
            languages.forEach(lang => {
                const textarea = document.getElementById(lang.code) as HTMLTextAreaElement;
                updatedEntry[lang.code as keyof TranslationEntry] = textarea.value as any;
            });
            
            try {
                const success = await databaseService.updateEntry(entry.id!, updatedEntry);
                if (success) {
                    this.log(`成功更新ID为 ${entry.id} 的记录`);
                    document.body.removeChild(modal);
                    await this.loadEntries();
                } else {
                    this.log(`更新ID为 ${entry.id} 的记录失败`, 'error');
                }
            } catch (error) {
                this.log(`更新失败: ${(error as Error).message}`, 'error');
            }
        });
        
        // 点击模态框外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    private showAddEntryForm(): void {
        // 创建模态框
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>添加新条目</h2>
                <form id="addEntryForm">
        `;
        
        // 添加所有语言的输入框
        const languages = [
            { code: 'Chinese', name: '中文' },
            { code: 'English', name: '英语' },
            { code: 'Japanese', name: '日语' },
            { code: 'Korean', name: '韩语' },
            { code: 'Spanish', name: '西班牙语' },
            { code: 'French', name: '法语' },
            { code: 'German', name: '德语' },
            { code: 'Russian', name: '俄语' },
            { code: 'Thai', name: '泰语' },
            { code: 'Italian', name: '意大利语' },
            { code: 'Indonesian', name: '印尼语' },
            { code: 'Portuguese', name: '葡萄牙语' }
        ];
        
        languages.forEach(lang => {
            content += `
                <div class="form-group">
                    <label for="${lang.code}">${lang.name}:</label>
                    <textarea id="${lang.code}" name="${lang.code}" rows="2"></textarea>
                </div>
            `;
        });
        
        content += `
                    <div class="form-actions">
                        <button type="submit" class="btn">保存</button>
                        <button type="button" class="btn btn-cancel">取消</button>
                    </div>
                </form>
            </div>
        `;
        
        modal.innerHTML = content;
        document.body.appendChild(modal);
        
        // 关闭模态框
        const closeBtn = modal.querySelector('.close') as HTMLElement;
        closeBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 取消按钮
        const cancelBtn = modal.querySelector('.btn-cancel') as HTMLElement;
        cancelBtn.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        // 提交表单
        const form = document.getElementById('addEntryForm') as HTMLFormElement;
        form.addEventListener('submit', async (event) => {
            event.preventDefault();
            
            const newEntry: any = {};
            languages.forEach(lang => {
                const textarea = document.getElementById(lang.code) as HTMLTextAreaElement;
                newEntry[lang.code] = textarea.value;
            });
            
            try {
                const id = await databaseService.addEntry(newEntry as TranslationEntry);
                this.log(`成功添加新记录，ID: ${id}`);
                document.body.removeChild(modal);
                await this.loadEntries();
            } catch (error) {
                this.log(`添加失败: ${(error as Error).message}`, 'error');
            }
        });
        
        // 点击模态框外部关闭
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    private getSelectedEntryIds(): number[] {
        const selectedIds: number[] = [];
        const checkboxes = document.querySelectorAll('.entry-checkbox:checked') as NodeListOf<HTMLInputElement>;
        
        checkboxes.forEach(checkbox => {
            const row = checkbox.closest('tr');
            if (row) {
                const id = Number(row.getAttribute('data-id'));
                if (!isNaN(id)) {
                    selectedIds.push(id);
                }
            }
        });
        
        return selectedIds;
    }

    private log(message: string, type: 'info' | 'error' | 'warning' = 'info'): void {
        const timestamp = new Date().toLocaleTimeString();
        const logItem = document.createElement('div');
        logItem.className = `log-item log-${type}`;
        logItem.innerHTML = `<span class="log-time">[${timestamp}]</span> ${message}`;
        this.logOutput.appendChild(logItem);
        this.logOutput.scrollTop = this.logOutput.scrollHeight;
        
        console.log(`[${type.toUpperCase()}] ${message}`);
    }

    private showProgress(percent: number): void {
        this.progressFill.style.width = `${percent}%`;
        this.progressText.textContent = `${percent}%`;
    }

    private escapeHtml(text: string): string {
        if (!text) return '';
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
}

// 当DOM加载完成后初始化应用
document.addEventListener('DOMContentLoaded', () => {
    new KnowledgeBaseManager();
});
