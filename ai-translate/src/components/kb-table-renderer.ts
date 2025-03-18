import { TranslationEntry } from '../services/database';
import { escapeHtml } from '../utils/kb-utils';
import { KnowledgeBaseModals } from './kb-modals';
import { IKnowledgeBaseManager } from '../types/kb-types';

/**
 * 知识库表格渲染类
 */
export class KnowledgeBaseTableRenderer {
    private container: HTMLElement;
    private currentEntries: TranslationEntry[] = [];
    private modals: KnowledgeBaseModals;
    private manager: IKnowledgeBaseManager;
    private deleteEntryCallback: (chinese: string) => Promise<void>;

    constructor(
        container: HTMLElement, 
        manager: IKnowledgeBaseManager,
        deleteEntryCallback: (chinese: string) => Promise<void>
    ) {
        this.container = container;
        this.manager = manager;
        this.modals = new KnowledgeBaseModals(manager);
        this.deleteEntryCallback = deleteEntryCallback;
    }

    /**
     * 渲染翻译条目表格
     */
    public renderTable(entries: TranslationEntry[]): void {
        this.currentEntries = entries;
        
        if (!this.container) return;

        // 创建表格容器
        this.container.innerHTML = `
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
                <td class="content-cell">${escapeHtml(entry.Chinese || '')}</td>
                <td class="content-cell">${escapeHtml(entry.English || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Japanese || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Korean || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Spanish || '')}</td>
                <td class="content-cell">${escapeHtml(entry.French || '')}</td>
                <td class="content-cell">${escapeHtml(entry.German || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Russian || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Thai || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Italian || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Indonesian || '')}</td>
                <td class="content-cell">${escapeHtml(entry.Portuguese || '')}</td>
            `;
            tableBody.appendChild(tr);
        });

        this.initializeTableEvents();
    }

    /**
     * 初始化表格事件
     */
    private initializeTableEvents(): void {
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

        // 为每行添加双击事件，显示详情
        const tableRows = document.querySelectorAll('#entriesTableBody tr');
        tableRows.forEach(row => {
            row.addEventListener('dblclick', () => {
                const checkbox = row.querySelector('.entry-checkbox') as HTMLInputElement;
                if (checkbox) {
                    const chinese = checkbox.getAttribute('data-id') || '';
                    const entry = this.currentEntries.find(e => e.Chinese === chinese);
                    if (entry) {
                        this.modals.showEntryDetails(entry);
                    }
                }
            });
        });
    }

    /**
     * 获取选中的条目ID
     */
    public getSelectedEntryIds(): string[] {
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

    /**
     * 显示添加条目表单
     */
    public showAddEntryForm(): void {
        this.modals.showAddEntryForm();
    }
}
