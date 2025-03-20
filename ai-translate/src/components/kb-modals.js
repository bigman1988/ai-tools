import { ApiService } from '../services/api.js';
import { languageFields } from '../utils/kb-utils.js';

/**
 * 知识库模态框管理类
 */
export class KnowledgeBaseModals {
    /**
     * @param {Object} manager - 知识库管理器实例
     */
    constructor(manager) {
        this.manager = manager;
        this.apiService = new ApiService();
    }

    /**
     * 显示条目详情模态框
     * @param {Object} entry - 翻译条目
     */
    showEntryDetails(entry) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>查看翻译条目</h2>
                <div class="entry-details">
        `;
        
        languageFields.forEach(field => {
            const value = entry[field.key];
            content += `
                <div class="entry-field">
                    <label>${field.label}:</label>
                    <div class="field-value">${value || ''}</div>
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

    /**
     * 显示编辑条目模态框
     * @param {Object} entry - 翻译条目
     */
    showEditEntryForm(entry) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>编辑翻译条目</h2>
                <form id="editEntryForm">
                    <input type="hidden" id="entryChinese" value="${entry.Chinese}">
        `;
        
        // 添加所有可编辑字段
        languageFields.forEach(field => {
            const value = entry[field.key];
            content += `
                <div class="form-group">
                    <label for="${field.key}">${field.label}:</label>
                    <textarea id="${field.key}" class="form-control" rows="2">${value || ''}</textarea>
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
        const form = modal.querySelector('#editEntryForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const entryChinese = document.getElementById('entryChinese').value;
            const updatedEntry = {};
            
            // 收集表单数据
            languageFields.forEach(field => {
                const input = document.getElementById(field.key);
                if (input && input.value) {
                    updatedEntry[field.key] = input.value;
                }
            });
            
            try {
                // 使用API服务更新条目
                await this.apiService.updateEntry(entryChinese, updatedEntry);
                this.manager.log('条目更新成功', 'info');
                document.body.removeChild(modal);
                
                // 刷新数据
                await this.manager.loadEntries();
            } catch (error) {
                this.manager.log(`更新失败: ${error.message}`, 'error');
            }
        });
    }

    /**
     * 显示添加条目模态框
     */
    showAddEntryForm() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        
        let content = `
            <div class="modal-content">
                <span class="close">&times;</span>
                <h2>添加翻译条目</h2>
                <form id="addEntryForm">
        `;
        
        // 添加所有可编辑字段
        languageFields.forEach(field => {
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
        const form = modal.querySelector('#addEntryForm');
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const newEntry = {};
            
            // 收集表单数据
            languageFields.forEach(field => {
                const input = document.getElementById(field.key);
                if (input && input.value) {
                    newEntry[field.key] = input.value;
                }
            });

            // 验证必填字段
            if (!newEntry.Chinese) {
                this.manager.log('中文字段不能为空', 'error');
                return;
            }
            
            try {
                // 使用API服务添加条目
                await this.apiService.addEntry(newEntry);
                this.manager.log('条目添加成功', 'info');
                document.body.removeChild(modal);
                
                // 刷新数据
                await this.manager.loadEntries();
            } catch (error) {
                this.manager.log(`添加失败: ${error.message}`, 'error');
            }
        });
    }
}
