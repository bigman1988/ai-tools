const fetch = require('node-fetch');
const { QdrantClient } = require('@qdrant/qdrant-js');
require('dotenv').config();  // 确保加载环境变量

class OllamaEmbeddingService {
    constructor(
        ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434',
        modelName = 'nomic-embed-text',
        qdrantUrl = process.env.QDRANT_URL || 'http://localhost:6333',
        collectionName = 'translation_embeddings',
        vectorSize = 768
    ) {
        this.ollamaUrl = ollamaUrl;
        this.modelName = modelName;
        this.collectionName = collectionName;
        this.vectorSize = vectorSize;
        
        // 初始化Qdrant客户端，启用版本兼容性检查
        this.qdrantClient = new QdrantClient({ 
            url: qdrantUrl,
            checkCompatibility: true,  // 启用版本兼容性检查
            timeout: 10000  // 增加超时时间到10秒
        });
        
        console.log(`实际使用的Qdrant URL: ${qdrantUrl}`);
        console.log(`实际使用的Ollama URL: ${ollamaUrl}`);
    }

    /**
     * 初始化向量数据库集合
     */
    async initializeCollection() {
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
            } else {
                console.log(`集合已存在: ${this.collectionName}`);
            }
            return true;
        } catch (error) {
            console.error('初始化向量数据库集合失败:', error);
            // 不抛出错误，而是返回失败状态
            return false;
        }
    }

    /**
     * 使用Ollama生成文本嵌入向量
     */
    async generateEmbedding(text) {
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

            const data = await response.json();
            return data.embedding;
        } catch (error) {
            console.error('生成嵌入向量失败:', error);
            // 不抛出错误，而是返回null
            return null;
        }
    }

    /**
     * 存储嵌入向量到Qdrant
     */
    async storeEmbedding(id, text, metadata) {
        try {
            const embedding = await this.generateEmbedding(text);
            
            if (embedding === null) {
                console.error('生成嵌入向量失败，无法存储');
                return false;
            }
            
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
            // 不抛出错误，而是返回失败状态
            return false;
        }
    }

    /**
     * 搜索相似文本
     */
    async searchSimilar(text, limit = 5) {
        try {
            const embedding = await this.generateEmbedding(text);
            
            if (embedding === null) {
                console.error('生成嵌入向量失败，无法搜索');
                return [];
            }
            
            const searchResults = await this.qdrantClient.search(this.collectionName, {
                vector: embedding,
                limit,
                with_payload: true
            });
            
            return searchResults.map(result => ({
                id: result.id,
                score: result.score,
                metadata: result.payload
            }));
        } catch (error) {
            console.error('搜索相似文本失败:', error);
            // 不抛出错误，而是返回空数组
            return [];
        }
    }

    /**
     * 删除嵌入向量
     */
    async deleteEmbedding(id) {
        try {
            await this.qdrantClient.delete(this.collectionName, {
                wait: true,
                points: [id]
            });
            
            return true;
        } catch (error) {
            console.error('删除嵌入向量失败:', error);
            // 不抛出错误，而是返回失败状态
            return false;
        }
    }
}

// 导出默认实例
const embeddingService = new OllamaEmbeddingService();

module.exports = { embeddingService, OllamaEmbeddingService };
