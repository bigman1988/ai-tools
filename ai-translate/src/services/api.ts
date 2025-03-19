import { TranslationEntry } from '../types';

export class ApiService {
    private baseUrl: string;

    constructor() {
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

    async getEntries(searchTerm?: string): Promise<TranslationEntry[]> {
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

    async vectorSearch(text: string, limit: number = 10): Promise<Array<{
        id: string;
        score: number;
        payload: TranslationEntry;
    }>> {
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

    async addEntry(entry: TranslationEntry): Promise<boolean> {
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

    async updateEntry(chinese: string, entry: Partial<TranslationEntry>): Promise<boolean> {
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

    async deleteEntry(chinese: string): Promise<boolean> {
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

    async importExcel(file: File): Promise<{ success: boolean; count: number }> {
        try {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch(`${this.baseUrl}/import`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) {
                throw new Error(`导入失败: ${response.status}`);
            }

            const result = await response.json();
            return { success: true, count: result.count || 0 };
        } catch (error) {
            console.error('导入Excel失败:', error);
            return { success: false, count: 0 };
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
