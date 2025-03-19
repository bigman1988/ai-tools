import fetch from 'node-fetch';
import { QdrantClient } from '@qdrant/qdrant-js';

export interface EmbeddingService {
    generateEmbedding(text: string): Promise<number[]>;
    storeEmbedding(id: string, text: string, metadata: any): Promise<boolean>;
    searchSimilar(text: string, limit?: number): Promise<Array<{id: string, score: number, metadata: any}>>;
}

export class OllamaEmbeddingService implements EmbeddingService {
    private ollamaUrl: string;
    private modelName: string;
    private qdrantClient: QdrantClient;
    private collectionName: string;
    private vectorSize: number;

    constructor(
        ollamaUrl: string = 'http://localhost:11434',
        modelName: string = 'nomic-embed-text',
        qdrantUrl: string = 'http://localhost:6333',
        collectionName: string = 'translation_embeddings',
        vectorSize: number = 768
    ) {
        this.ollamaUrl = ollamaUrl;
        this.modelName = modelName;
        this.collectionName = collectionName;
        this.vectorSize = vectorSize;
        
        // 初始化Qdrant客户端
        this.qdrantClient = new QdrantClient({ url: qdrantUrl });
    }

    /**
     * 初始化向量数据库集合
     */
    public async initializeCollection(): Promise<void> {
        try {
            // 检查集合是否存在
            const collections = await this.qdrantClient.getCollections();
            const collectionExists = collections.collections.some(c => c.name === this.collectionName);

            if (!collectionExists) {
                // 创建新集合
                await this.qdrantClient.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine'
                    }
                });
                console.log(`创建集合: ${this.collectionName}`);
            }
        } catch (error) {
            console.error('初始化向量数据库集合失败:', error);
            throw error;
        }
    }

    /**
     * 使用Ollama生成文本嵌入向量
     */
    public async generateEmbedding(text: string): Promise<number[]> {
        try {
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: text
                })
            });

            if (!response.ok) {
                throw new Error(`Ollama API错误: ${response.status} ${response.statusText}`);
            }

            const data = await response.json() as { embedding: number[] };
            return data.embedding;
        } catch (error) {
            console.error('生成嵌入向量失败:', error);
            throw error;
        }
    }

    /**
     * 存储嵌入向量到Qdrant
     */
    public async storeEmbedding(id: string, text: string, metadata: any): Promise<boolean> {
        try {
            const embedding = await this.generateEmbedding(text);
            
            await this.qdrantClient.upsert(this.collectionName, {
                wait: true,
                points: [
                    {
                        id,
                        vector: embedding,
                        payload: {
                            text,
                            ...metadata
                        }
                    }
                ]
            });
            
            return true;
        } catch (error) {
            console.error('存储嵌入向量失败:', error);
            return false;
        }
    }

    /**
     * 搜索相似文本
     */
    public async searchSimilar(text: string, limit: number = 5): Promise<Array<{id: string, score: number, metadata: any}>> {
        try {
            const embedding = await this.generateEmbedding(text);
            
            const searchResults = await this.qdrantClient.search(this.collectionName, {
                vector: embedding,
                limit,
                with_payload: true
            });
            
            return searchResults.map(result => ({
                id: result.id as string,
                score: result.score,
                metadata: result.payload
            }));
        } catch (error) {
            console.error('搜索相似文本失败:', error);
            return [];
        }
    }

    /**
     * 删除嵌入向量
     */
    public async deleteEmbedding(id: string): Promise<boolean> {
        try {
            await this.qdrantClient.delete(this.collectionName, {
                wait: true,
                points: [id]
            });
            
            return true;
        } catch (error) {
            console.error('删除嵌入向量失败:', error);
            return false;
        }
    }
}

// 导出默认实例
export const embeddingService = new OllamaEmbeddingService();
