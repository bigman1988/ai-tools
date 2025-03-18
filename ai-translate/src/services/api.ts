import { TranslationEntry } from './database';

class ApiService {
    private baseUrl: string;

    constructor() {
        // 使用相对URL，假设API服务器和前端在同一个域名下的不同端口
        this.baseUrl = 'http://localhost:3000/api';
    }

    async getStatus(): Promise<{ status: string; message: string }> {
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

    async getEntries(searchTerm?: string, limit: number = 100, offset: number = 0): Promise<TranslationEntry[]> {
        try {
            let url = `${this.baseUrl}/entries?limit=${limit}&offset=${offset}`;
            if (searchTerm) {
                url += `&search=${encodeURIComponent(searchTerm)}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`获取条目失败: ${response.status}`);
            }
            return await response.json();
        } catch (error) {
            console.error('获取条目失败:', error);
            throw error;
        }
    }

    async addEntry(entry: Partial<TranslationEntry>): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/entries`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry)
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ error: '未知错误' }));
                throw new Error(`添加条目失败: ${response.status}, 详情: ${errorData.details || errorData.error || '未知错误'}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('添加条目失败:', error);
            throw error;
        }
    }

    async updateEntry(chinese: string, entry: Partial<TranslationEntry>): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/entries/${encodeURIComponent(chinese)}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(entry)
            });

            if (!response.ok) {
                throw new Error(`更新条目失败: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('更新条目失败:', error);
            throw error;
        }
    }

    /**
     * 删除一个翻译条目
     * @param id 条目ID（中文）
     * @returns 是否删除成功
     */
    async deleteEntry(id: string): Promise<boolean> {
        try {
            console.log(`API服务 - 删除条目，原始ID: "${id}"`);
            
            // 使用POST请求发送删除请求，将ID放在请求体中
            // 注意：我们不再对ID进行任何预处理，保留所有原始字符
            const response = await fetch(`${this.baseUrl}/entries/delete`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ id })
            });
            
            if (!response.ok) {
                const errorData = await response.json();
                console.error('删除条目失败:', errorData);
                throw new Error(`删除条目失败: ${response.status}`);
            }
            
            const data = await response.json();
            console.log('删除条目成功:', data);
            return true;
        } catch (error) {
            console.error('删除条目出错:', error);
            throw error;
        }
    }

    async importExcel(file: File): Promise<{ success: boolean; count: number }> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/import`, {
                method: 'POST',
                body: formData
            });

            if (!response.ok) {
                throw new Error(`导入Excel失败: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('导入Excel失败:', error);
            throw error;
        }
    }

    async exportExcel(): Promise<Blob> {
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

    // 初始化数据库连接 - 在客户端这只是一个检查API服务器是否可用的方法
    async initializeDatabase(): Promise<void> {
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
