import fetch from 'node-fetch';
import { QdrantClient } from '@qdrant/qdrant-js';
import crypto from 'crypto'; // 导入crypto模块
import 'dotenv/config';  // 确保加载环境变量

export class OllamaEmbeddingService {
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
            if (!text || text.trim() === '') {
                console.log('文本为空，无法生成向量');
                return null;
            }
            
            console.log(`正在为文本生成向量: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
            
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: this.modelName,
                    prompt: text
                }),
                timeout: 30000 // 增加超时时间到30秒
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Ollama API错误: ${response.status} ${response.statusText} - ${errorText}`);
            }

            const data = await response.json();
            
            // 检查返回的数据结构
            if (!data || !data.embedding) {
                console.error('Ollama API返回的数据结构不正确:', JSON.stringify(data).substring(0, 200));
                return null;
            }
            
            console.log(`成功生成向量，维度: ${data.embedding.length}`);
            return data;
        } catch (error) {
            console.error('生成嵌入向量失败:', error);
            // 不抛出错误，而是返回null
            return null;
        }
    }

    /**
     * 存储嵌入向量到Qdrant
     */
    async storeEmbedding(text, metadata) {
        try {
            const embedding = await this.generateEmbedding(text);
            
            if (embedding === null) {
                console.error('生成嵌入向量失败，无法存储');
                return { success: false, id: null };
            }
            
            // 使用UUID作为ID
            const uuid = crypto.randomUUID();
            
            await this.qdrantClient.upsert(this.collectionName, {
                wait: true,
                points: [
                    {
                        id: uuid,
                        vector: embedding.embedding,
                        payload: {
                            text,
                            ...metadata
                        }
                    }
                ]
            });
            
            console.log(`成功存储嵌入向量: ${uuid}, 类型: ${metadata.type || '未指定'}`);
            return { success: true, id: uuid };
        } catch (error) {
            console.error('存储嵌入向量失败:', error);
            // 不抛出错误，而是返回失败状态
            return { success: false, id: null };
        }
    }

    /**
     * 存储完整翻译条目的向量（包含中文和英文向量）
     * @param {Object} entry - 完整的翻译条目，包含所有语言
     * @returns {Object} - 包含操作结果和向量ID的对象
     */
    async storeEntryVectors(entry) {
        try {
            // 检查集合是否存在，如果不存在则初始化
            try {
                const collections = await this.qdrantClient.getCollections();
                const collectionExists = collections.collections.some(c => c.name === this.collectionName);
                
                if (!collectionExists) {
                    console.log(`集合不存在，正在创建: ${this.collectionName}`);
                    await this.initializeCollection();
                }
            } catch (collectionError) {
                console.error('检查集合时出错:', collectionError);
                await this.initializeCollection();
            }
            
            // 生成UUID作为向量ID
            const uuid = crypto.randomUUID();
            
            // 准备元数据
            const payload = {
                chinese: entry.Chinese || '',
                english: entry.English || '',
                japanese: entry.Japanese || '',
                korean: entry.Korean || '',
                spanish: entry.Spanish || '',
                french: entry.French || '',
                german: entry.German || '',
                russian: entry.Russian || '',
                thai: entry.Thai || '',
                italian: entry.Italian || '',
                indonesian: entry.Indonesian || '',
                portuguese: entry.Portuguese || ''
            };
            
            // 生成中文和英文的向量嵌入
            let vector_cn = null;
            let vector_en = null;
            
            if (entry.Chinese && entry.Chinese.trim() !== '') {
                try {
                    const cnEmbedding = await this.generateEmbedding(entry.Chinese);
                    if (cnEmbedding && cnEmbedding.embedding) {
                        vector_cn = cnEmbedding.embedding;
                    }
                } catch (cnError) {
                    console.error('生成中文向量失败:', cnError);
                }
            }
            
            if (entry.English && entry.English.trim() !== '') {
                try {
                    const enEmbedding = await this.generateEmbedding(entry.English);
                    if (enEmbedding && enEmbedding.embedding) {
                        vector_en = enEmbedding.embedding;
                    }
                } catch (enError) {
                    console.error('生成英文向量失败:', enError);
                }
            }
            
            // 如果没有成功生成任何向量，则返回失败
            if (!vector_cn && !vector_en) {
                console.error('无法为条目生成向量嵌入:', entry.Chinese);
                return { success: false, id: null, error: '无法生成向量嵌入' };
            }
            
            const point = {
                id: uuid,
                // 如果中文向量存在则使用中文向量，否则使用英文向量
                vector: vector_cn || vector_en,
                payload: payload
            };

            // 如果同时存在中文和英文向量，则添加到payload中
            if (vector_cn && vector_en) {
                point.payload.vector_cn = vector_cn;
                point.payload.vector_en = vector_en;
            }

            // 存储到Qdrant
            try {
                await this.qdrantClient.upsert(this.collectionName, {
                    wait: true,
                    points: [point]
                });
                
                console.log(`成功存储翻译条目向量: ${uuid}`);
                return { success: true, id: uuid };
            } catch (upsertError) {
                console.error('向Qdrant存储向量失败:', upsertError);
                
                // 尝试再次初始化集合并重试
                try {
                    console.log('尝试重新初始化集合并重试...');
                    await this.initializeCollection();
                    
                    await this.qdrantClient.upsert(this.collectionName, {
                        wait: true,
                        points: [point]
                    });
                    
                    console.log(`重试成功，已存储翻译条目向量: ${uuid}`);
                    return { success: true, id: uuid };
                } catch (retryError) {
                    console.error('重试存储向量失败:', retryError);
                    return { success: false, id: null, error: retryError.message };
                }
            }
        } catch (error) {
            console.error('存储翻译条目向量失败:', error);
            return { success: false, id: null, error: error.message };
        }
    }

    /**
     * 更新翻译条目的向量
     * @param {string} id - 要更新的向量ID
     * @param {Object} entry - 完整的翻译条目，包含所有语言
     * @returns {Object} - 包含操作结果和向量ID的对象
     */
    async updateEntryVectors(id, entry) {
        try {
            if (!id) {
                // 如果没有ID，则创建新的向量
                return await this.storeEntryVectors(entry);
            }

            if (!entry.Chinese && !entry.English) {
                console.error('中文和英文内容均为空，无法更新向量');
                return { success: false, id: null };
            }

            // 生成中文向量（如果有中文内容）
            let vector_cn = null;
            if (entry.Chinese) {
                vector_cn = await this.generateEmbedding(entry.Chinese);
                if (vector_cn === null) {
                    console.error('生成中文嵌入向量失败');
                }
            }

            // 生成英文向量（如果有英文内容）
            let vector_en = null;
            if (entry.English) {
                vector_en = await this.generateEmbedding(entry.English);
                if (vector_en === null) {
                    console.error('生成英文嵌入向量失败');
                }
            }

            // 如果两个向量都生成失败，则返回失败
            if (vector_cn === null && vector_en === null) {
                return { success: false, id: null };
            }

            // 准备完整的payload数据
            const payload = {
                Chinese: entry.Chinese || '',
                English: entry.English || '',
                Japanese: entry.Japanese || '',
                Korean: entry.Korean || '',
                Spanish: entry.Spanish || '',
                French: entry.French || '',
                German: entry.German || '',
                Russian: entry.Russian || '',
                Thai: entry.Thai || '',
                Italian: entry.Italian || '',
                Indonesian: entry.Indonesian || '',
                Portuguese: entry.Portuguese || ''
            };

            // 构建要更新的点
            const point = {
                id: id,
                // 如果中文向量存在则使用中文向量，否则使用英文向量
                vector: vector_cn || vector_en,
                payload: payload
            };

            // 如果同时存在中文和英文向量，则添加到payload中
            if (vector_cn && vector_en) {
                point.payload.vector_cn = vector_cn;
                point.payload.vector_en = vector_en;
            }

            // 更新Qdrant中的向量
            await this.qdrantClient.upsert(this.collectionName, {
                wait: true,
                points: [point]
            });
            
            console.log(`成功更新翻译条目向量: ${id}`);
            return { success: true, id: id };
        } catch (error) {
            console.error('更新翻译条目向量失败:', error);
            return { success: false, id: null };
        }
    }

    /**
     * 搜索相似文本
     * @param {string} text - 要搜索的文本
     * @param {string} language - 搜索语言，可以是 'chinese' 或 'english'
     * @param {number} limit - 返回结果数量限制
     */
    async searchSimilar(text, language = 'chinese', limit = 5) {
        try {
            const embedding = await this.generateEmbedding(text);
            
            if (embedding === null) {
                console.error('生成嵌入向量失败，无法搜索');
                return [];
            }
            
            console.log(`开始搜索相似文本，语言: ${language}, 限制: ${limit}`);
            
            // 根据语言选择不同的搜索策略
            let searchResults;
            
            if (language === 'english') {
                // 如果是英文搜索，优先使用vector_en字段
                searchResults = await this.qdrantClient.search(this.collectionName, {
                    vector: embedding.embedding,
                    limit,
                    with_payload: true,
                    with_vectors: true  // 获取向量数据
                });
                
                // 对结果进行后处理，使用vector_en进行重新排序（如果存在）
                searchResults = searchResults.map(result => {
                    // 如果存在英文向量，计算与查询向量的相似度
                    if (result.payload && result.payload.vector_en) {
                        const similarity = this.calculateCosineSimilarity(embedding.embedding, result.payload.vector_en);
                        return { ...result, score: similarity };
                    }
                    return result;
                });
            } else {
                // 如果是中文搜索，优先使用vector_cn字段
                searchResults = await this.qdrantClient.search(this.collectionName, {
                    vector: embedding.embedding,
                    limit,
                    with_payload: true,
                    with_vectors: true  // 获取向量数据
                });
                
                // 对结果进行后处理，使用vector_cn进行重新排序（如果存在）
                searchResults = searchResults.map(result => {
                    // 如果存在中文向量，计算与查询向量的相似度
                    if (result.payload && result.payload.vector_cn) {
                        const similarity = this.calculateCosineSimilarity(embedding.embedding, result.payload.vector_cn);
                        return { ...result, score: similarity };
                    }
                    return result;
                });
            }
            
            // 按相似度排序
            searchResults.sort((a, b) => b.score - a.score);
            
            console.log(`搜索完成，找到 ${searchResults.length} 条结果`);
            return searchResults.map(result => ({
                id: result.id,
                score: result.score,
                metadata: {
                    Chinese: result.payload.Chinese,
                    English: result.payload.English,
                    Japanese: result.payload.Japanese,
                    Korean: result.payload.Korean,
                    Spanish: result.payload.Spanish,
                    French: result.payload.French,
                    German: result.payload.German,
                    Russian: result.payload.Russian,
                    Thai: result.payload.Thai,
                    Italian: result.payload.Italian,
                    Indonesian: result.payload.Indonesian,
                    Portuguese: result.payload.Portuguese
                }
            }));
        } catch (error) {
            console.error('搜索相似文本失败:', error);
            // 不抛出错误，而是返回空数组
            return [];
        }
    }
    
    /**
     * 计算两个向量之间的余弦相似度
     * @param {Array} vec1 - 第一个向量
     * @param {Array} vec2 - 第二个向量
     * @returns {number} - 余弦相似度，范围在-1到1之间
     */
    calculateCosineSimilarity(vec1, vec2) {
        if (!vec1 || !vec2 || vec1.length !== vec2.length) {
            return 0;
        }
        
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        
        for (let i = 0; i < vec1.length; i++) {
            dotProduct += vec1[i] * vec2[i];
            norm1 += vec1[i] * vec1[i];
            norm2 += vec2[i] * vec2[i];
        }
        
        norm1 = Math.sqrt(norm1);
        norm2 = Math.sqrt(norm2);
        
        if (norm1 === 0 || norm2 === 0) {
            return 0;
        }
        
        return dotProduct / (norm1 * norm2);
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
export const embeddingService = new OllamaEmbeddingService();
