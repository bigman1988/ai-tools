/**
 * API服务类
 */
export class ApiService {
    /**
     * 构造函数
     */
    constructor() {
        // 使用相对路径，这样可以自动适应不同的部署环境
        this.baseUrl = '/api';
        this.debug = true; // 启用调试模式
        console.log('ApiService: 初始化，baseUrl =', this.baseUrl);
    }

    /**
     * 设置调试模式
     * @param {boolean} debug - 是否启用调试模式
     */
    setDebug(debug) {
        this.debug = debug;
        console.log('ApiService: 调试模式', debug ? '开启' : '关闭');
    }

    /**
     * 调试日志
     * @param {string} message - 日志消息
     * @param {any} data - 日志数据
     * @private
     */
    logDebug(message, data) {
        if (this.debug) {
            if (data) {
                console.log(`[API] ${message}`, data);
            } else {
                console.log(`[API] ${message}`);
            }
        }
    }

    /**
     * 获取服务器状态
     * @returns {Promise<{status: string, message: string}>} - 服务器状态
     */
    async getStatus() {
        try {
            const response = await fetch(`${this.baseUrl}/status`);
            if (!response.ok) {
                throw new Error(`服务器响应错误: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取服务器状态失败:', error);
            throw error;
        }
    }

    /**
     * 获取翻译条目
     * @param {string} searchTerm - 搜索关键词
     * @returns {Promise<Array>} - 翻译条目数组
     */
    async getEntries(searchTerm) {
        try {
            const response = await fetch(`${this.baseUrl}/entries${searchTerm ? `?search=${searchTerm}` : ''}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取条目失败:', error);
            throw error;
        }
    }

    /**
     * 向量搜索
     * @param {string} text - 搜索文本
     * @param {number} limit - 结果数量限制
     * @returns {Promise<Array>} - 搜索结果数组
     */
    async vectorSearch(text, limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/vector-search`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ text, limit }),
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('向量搜索失败:', error);
            throw error;
        }
    }

    /**
     * 添加翻译条目
     * @param {Object} entry - 翻译条目
     * @returns {Promise<boolean>} - 是否添加成功
     */
    async addEntry(entry) {
        try {
            const response = await fetch(`${this.baseUrl}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry),
            });

            return response.ok;
        } catch (error) {
            console.error('添加条目失败:', error);
            return false;
        }
    }

    /**
     * 更新翻译条目
     * @param {string} chinese - 中文关键字
     * @param {Object} entry - 更新的翻译条目
     * @returns {Promise<boolean>} - 是否更新成功
     */
    async updateEntry(chinese, entry) {
        try {
            const response = await fetch(`${this.baseUrl}/entries/${encodeURIComponent(chinese)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(entry),
            });

            return response.ok;
        } catch (error) {
            console.error('更新条目失败:', error);
            return false;
        }
    }

    /**
     * 删除翻译条目
     * @param {string} chinese - 中文关键字
     * @returns {Promise<boolean>} - 是否删除成功
     */
    async deleteEntry(chinese) {
        try {
            console.log(`API服务 - 删除条目，原始ID: "${chinese}"`);
            const cleanId = chinese.replace(/[\r\n]+/g, ' ').trim();
            console.log(`API服务 - 删除条目，处理后ID: "${cleanId}"`);

            const response = await fetch(`${this.baseUrl}/entries/${encodeURIComponent(cleanId)}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                console.error(`API服务 - 删除条目失败，状态码: ${response.status}`);
                return false;
            }

            console.log('API服务 - 删除条目成功');
            return true;
        } catch (error) {
            console.error('删除条目失败:', error);
            return false;
        }
    }

    /**
     * 导入Excel文件
     * @param {File} file - Excel文件
     * @returns {Promise<{success: boolean, count: number, error?: string}>} - 导入结果
     */
    async importExcel(file) {
        try {
            console.log('ApiService: 开始导入Excel文件', file.name, file.size);
            
            // 检查文件类型
            if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
                console.error('ApiService: 文件格式不支持', file.name);
                return { success: false, count: 0, error: '只支持.xlsx或.xls格式的Excel文件' };
            }
            
            const formData = new FormData();
            formData.append('file', file);
            console.log('ApiService: FormData已创建并添加文件');

            // 打印请求信息
            console.log('ApiService: 请求URL:', `${this.baseUrl}/import`);
            console.log('ApiService: 请求方法:', 'POST');
            console.log('ApiService: 文件类型:', file.type);

            console.log('ApiService: 开始发送请求到', `${this.baseUrl}/import`);
            const response = await fetch(`${this.baseUrl}/import`, {
                method: 'POST',
                body: formData,
            });
            console.log('ApiService: 收到响应', response.status, response.statusText);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('ApiService: 导入失败', response.status, errorText);
                return { success: false, count: 0, error: `导入失败: ${response.status} - ${errorText}` };
            }

            const result = await response.json();
            console.log('ApiService: 导入成功', result);
            return { success: true, count: result.count || 0 };
        } catch (error) {
            console.error('ApiService: 导入Excel失败:', error);
            return { success: false, count: 0, error: error.message };
        }
    }

    /**
     * 导出Excel文件
     * @returns {Promise<Blob>} - Excel文件Blob
     */
    async exportExcel() {
        try {
            const response = await fetch(`${this.baseUrl}/export`);
            if (!response.ok) {
                throw new Error(`导出Excel失败: ${response.status}`);
            }
            return await response.blob();
        } catch (error) {
            console.error('导出Excel失败:', error);
            throw error;
        }
    }

    /**
     * 初始化数据库
     * @returns {Promise<void>}
     */
    async initializeDatabase() {
        try {
            await this.getStatus();
            console.log('API服务器连接成功');
        } catch (error) {
            console.error('API服务器连接失败:', error);
            throw new Error('无法连接到API服务器，请确保服务器已启动');
        }
    }
}

export const apiService = new ApiService();
