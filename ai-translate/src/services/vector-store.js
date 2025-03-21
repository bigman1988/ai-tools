import { QdrantClient } from '@qdrant/js-client-rest';
import fetch from 'node-fetch';

export class VectorStoreService {
    constructor() {
        this.collectionName = 'translation_kb';
        this.vectorSize = 768; 
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
        });
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    }

    async initializeCollection() {
        try {
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === this.collectionName);

            if (!exists) {
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine',
                    },
                });
                console.log(`Collection ${this.collectionName} created successfully`);
            } else {
                console.log(`Collection ${this.collectionName} already exists`);
            }
        } catch (error) {
            console.error('Error initializing vector collection:', error);
            throw error;
        }
    }

    /**
     * 添加向量到存储
     * @param {Object} entry - 向量条目
     * @param {string} entry.id - 条目ID
     * @param {Array<number>} entry.vector - 向量数据
     * @param {Object} [entry.payload] - 附加数据
     */
    async addVector(entry) {
        try {
            await this.client.upsert(this.collectionName, {
                points: [
                    {
                        id: entry.id,
                        vector: entry.vector,
                        payload: entry.payload || {},
                    },
                ],
            });
        } catch (error) {
            console.error('Error adding vector to collection:', error);
            throw error;
        }
    }

    /**
     * 批量添加向量
     * @param {Array<Object>} entries - 向量条目数组
     */
    async bulkAddVectors(entries) {
        try {
            if (entries.length === 0) return;

            await this.client.upsert(this.collectionName, {
                points: entries.map(entry => ({
                    id: entry.id,
                    vector: entry.vector,
                    payload: entry.payload || {},
                })),
            });
        } catch (error) {
            console.error('Error bulk adding vectors to collection:', error);
            throw error;
        }
    }

    /**
     * 搜索相似向量
     * @param {Array<number>} vector - 查询向量
     * @param {number} [limit=10] - 返回结果数量限制
     * @returns {Promise<Array<Object>>} - 搜索结果
     */
    async searchSimilar(vector, limit = 10) {
        try {
            const result = await this.client.search(this.collectionName, {
                vector: vector,
                limit: limit,
                with_payload: true,
            });
            
            return result.map(hit => ({
                id: hit.id,
                score: hit.score,
                payload: hit.payload,
            }));
        } catch (error) {
            console.error('Error searching similar vectors:', error);
            throw error;
        }
    }

    /**
     * 删除向量
     * @param {string} id - 要删除的向量ID
     */
    async deleteVector(id) {
        try {
            await this.client.delete(this.collectionName, {
                points: [id],
            });
        } catch (error) {
            console.error('Error deleting vector from collection:', error);
            throw error;
        }
    }

    /**
     * 从文本生成嵌入向量
     * @param {string} text - 输入文本
     * @returns {Promise<Array<number>>} - 嵌入向量
     */
    async getEmbeddingFromText(text) {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'bge-m3:latest',
                    prompt: text,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.embedding;
        } catch (error) {
            console.error('Error getting text embedding vector:', error);
            throw error;
        }
    }

    /**
     * 通过文本搜索相似条目
     * @param {string} text - 查询文本
     * @param {number} [limit=10] - 返回结果数量限制
     * @returns {Promise<Array<Object>>} - 搜索结果
     */
    async searchSimilarByText(text, limit = 10) {
        try {
            const vector = await this.getEmbeddingFromText(text);
            return await this.searchSimilar(vector, limit);
        } catch (error) {
            console.error('Error searching similar vectors by text:', error);
            throw error;
        }
    }
}

export const vectorStoreService = new VectorStoreService();
