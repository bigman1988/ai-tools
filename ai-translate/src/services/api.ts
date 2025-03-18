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
                throw new Error(`添加条目失败: ${response.status}`);
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

    async deleteEntry(chinese: string): Promise<boolean> {
        try {
            const response = await fetch(`${this.baseUrl}/entries/${encodeURIComponent(chinese)}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                throw new Error(`删除条目失败: ${response.status}`);
            }

            const result = await response.json();
            return result.success;
        } catch (error) {
            console.error('删除条目失败:', error);
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
