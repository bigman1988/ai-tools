import { escapeHtml } from '../utils/kb-utils.js';
import { KnowledgeBaseModals } from './kb-modals.js';

/**
 * 知识库表格渲染类
 */
export class KnowledgeBaseTableRenderer {
    /**
     * @param {HTMLElement} container - 表格容器元素
     * @param {Object} manager - 知识库管理器实例
     * @param {Function} deleteEntryCallback - 删除条目的回调函数
     */
    constructor(container, manager, deleteEntryCallback) {
        this.container = container;
        this.manager = manager;
        this.modals = new KnowledgeBaseModals(manager);
        this.deleteEntryCallback = deleteEntryCallback;
        this.currentEntries = [];
    }

    /**
     * 渲染翻译条目表格
     * @param {Array} entries - 翻译条目数组
     */
    renderTable(entries) {
        this.currentEntries = entries;
        
        if (!this.container) return;

        // 创建表格容器
        this.container.innerHTML = `
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
    initializeTableEvents() {
        // 添加全选功能
        const selectAllCheckbox = document.getElementById('selectAll');
        if (selectAllCheckbox) {
            selectAllCheckbox.addEventListener('change', () => {
                const checkboxes = document.querySelectorAll('.entry-checkbox');
                checkboxes.forEach(checkbox => {
                    checkbox.checked = selectAllCheckbox.checked;
                });
            });
        }

        // 为每行添加双击事件，显示详情
        const tableRows = document.querySelectorAll('#entriesTableBody tr');
        tableRows.forEach(row => {
            row.addEventListener('dblclick', () => {
                const checkbox = row.querySelector('.entry-checkbox');
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
     * @returns {Array<string>} 选中的条目ID数组
     */
    getSelectedEntryIds() {
        const selectedIds = [];
        const checkboxes = document.querySelectorAll('.entry-checkbox:checked');
        
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
    showAddEntryForm() {
        this.modals.showAddEntryForm();
    }
}
