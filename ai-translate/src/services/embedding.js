import fetch from 'node-fetch';
import { QdrantClient } from '@qdrant/qdrant-js';
import crypto from 'crypto'; // 导入crypto模块
// 不再使用 dotenv/config，在服务器启动时已加载环境变量

// 单例实例
let instance = null;

export class OllamaEmbeddingService {
    constructor(
        ollamaUrl = process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
        modelName = 'nomic-embed-text',
        qdrantUrl = process.env.QDRANT_URL || 'http://172.16.0.78:6333',
        collectionName = 'translation_embeddings',
        vectorSize = 768
    ) {
        // 如果已经有实例，直接返回
        if (instance) {
            console.log('已经存在 OllamaEmbeddingService 实例，返回现有实例');
            return instance;
        }
        
        console.log('初始化 OllamaEmbeddingService');
        this.ollamaUrl = ollamaUrl;
        this.modelName = modelName;
        this.collectionName = collectionName;
        this.vectorSize = vectorSize;
        this.qdrantUrl = qdrantUrl;
        
        // 初始化Qdrant客户端
        this.qdrantClient = new QdrantClient({
            url: this.qdrantUrl,
            checkCompatibility: false,  // 禁用版本兼容性检查，避免连接问题
            timeout: 15000,  // 增加超时时间到15秒
            retries: 3       // 添加重试次数
        });
        
        console.log(`实际使用的Qdrant URL: ${qdrantUrl}`);
        console.log(`实际使用的Ollama URL: ${ollamaUrl}`);
        
        // 保存实例
        instance = this;
    }

    /**
     * 初始化向量数据库集合
     */
    async initializeCollection() {
        let retries = 2; // 重试次数
        let delay = 1000; // 初始延迟时间（毫秒）
        
        while (retries >= 0) {
            try {
                console.log(`尝试初始化Qdrant集合 (剩余重试: ${retries})...`);
                
                // 检查集合是否存在
                const collections = await this.qdrantClient.getCollections();
                const collectionExists = collections.collections.some(c => c.name === this.collectionName);

                if (!collectionExists) {
                    // 创建新集合
                    console.log(`创建新集合: ${this.collectionName}, 向量维度: ${this.vectorSize}`);
                    await this.qdrantClient.createCollection(this.collectionName, {
                        vectors: {
                            size: this.vectorSize,
                            distance: 'Cosine'
                        }
                    });
                    console.log(`成功创建集合: ${this.collectionName}`);
                } else {
                    console.log(`集合已存在: ${this.collectionName}`);
                    
                    // 检查集合的向量维度是否匹配
                    try {
                        const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
                        const vectorSize = collectionInfo.config?.params?.vectors?.size;
                        
                        if (vectorSize && vectorSize !== this.vectorSize) {
                            console.warn(`警告: 集合 ${this.collectionName} 的向量维度 (${vectorSize}) 与当前配置 (${this.vectorSize}) 不匹配`);
                        }
                    } catch (infoError) {
                        console.error('获取集合信息失败:', infoError.message);
                    }
                }
                return true;
            } catch (error) {
                console.error(`初始化向量数据库集合失败 (剩余重试: ${retries}):`, error.message);
                
                // 提供更详细的错误信息
                if (error.message.includes('ECONNREFUSED')) {
                    console.error(`无法连接到Qdrant服务，请确保Qdrant服务正在运行于: ${this.qdrantUrl}`);
                } else if (error.message.includes('fetch failed')) {
                    console.error(`Qdrant服务请求失败，可能是网络问题或服务未启动: ${this.qdrantUrl}`);
                }
                
                if (retries > 0) {
                    console.log(`将在 ${delay/1000} 秒后重试初始化集合...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // 指数退避策略
                    retries--;
                } else {
                    console.error('初始化向量数据库集合失败，已达到最大重试次数');
                    return false;
                }
            }
        }
        return false;
    }

    /**
     * 使用Ollama生成文本嵌入向量
     */
    async generateEmbedding(text) {
        try {
            if (!text || typeof text !== 'string' || text.trim() === '') {
                console.error('无效的文本输入:', text);
                throw new Error('无效的文本输入');
            }
            
            const requestBody = {
                model: this.modelName,
                prompt: text.trim()
            };
            
            console.log(`向Ollama发送嵌入请求 - 模型: ${this.modelName}, 文本长度: ${text.length}`);
            console.log('嵌入请求体:', JSON.stringify(requestBody, null, 2));
            
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`嵌入API错误 - 状态码: ${response.status}, 错误信息:`, errorText);
                throw new Error(`嵌入API错误: ${response.status}`);
            }
            
            const responseText = await response.text();
            console.log('嵌入API原始响应:', responseText);
            
            const data = JSON.parse(responseText);
            console.log(`嵌入响应数据 - 向量长度: ${data.embedding ? data.embedding.length : 'undefined'}`);
            
            if (!data.embedding || !Array.isArray(data.embedding)) {
                console.error('嵌入响应格式错误:', data);
                throw new Error('嵌入响应格式错误');
            }
            
            return { embedding: data.embedding };
        } catch (error) {
            console.error('生成嵌入向量失败:', error);
            throw error;
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
                    vector_cn = cnEmbedding.embedding;
                } catch (cnError) {
                    console.error('生成中文向量失败:', cnError);
                }
            }
            
            if (entry.English && entry.English.trim() !== '') {
                try {
                    const enEmbedding = await this.generateEmbedding(entry.English);
                    vector_en = enEmbedding.embedding;
                } catch (enError) {
                    console.error('生成英文向量失败:', enError);
                }
            }
            
            // 如果没有成功生成任何向量，则返回失败
            if (!vector_cn && !vector_en) {
                console.error('无法为条目生成向量嵌入:', entry.Chinese || entry.English || '未知条目');
                return { success: false, id: null, error: '无法生成向量嵌入' };
            }
            
            const point = {
                id: uuid,
                // 如果中文向量存在则使用中文向量，否则使用英文向量
                vector: vector_cn || vector_en,
                payload: {
                    ...payload
                }
            };
            
            // 如果存在中文和英文向量，则添加到payload中
            if (vector_cn) {
                point.payload.vector_cn = vector_cn;
            }
            if (vector_en) {
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
                try {
                    const cnEmbedding = await this.generateEmbedding(entry.Chinese);
                    vector_cn = cnEmbedding.embedding;
                } catch (cnError) {
                    console.error('生成中文嵌入向量失败:', cnError);
                }
            }

            // 生成英文向量（如果有英文内容）
            let vector_en = null;
            if (entry.English) {
                try {
                    const enEmbedding = await this.generateEmbedding(entry.English);
                    vector_en = enEmbedding.embedding;
                } catch (enError) {
                    console.error('生成英文嵌入向量失败:', enError);
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
     * 测试嵌入服务功能
     * @returns {Promise<Object>} 测试结果
     */
    async testService() {
        try {
            console.log('开始测试嵌入服务...');
            
            // 检查Qdrant连接
            await this.checkQdrantConnection();
            
            // 测试生成嵌入向量
            const testText = "这是一个测试文本，用于验证嵌入服务是否正常工作。";
            console.log(`测试文本: "${testText}"`);
            
            // 生成嵌入向量
            const embedding = await this.generateEmbedding(testText);
            console.log(`成功生成嵌入向量，维度: ${embedding.embedding.length}`);
            
            // 获取集合列表
            const collections = await this.qdrantClient.getCollections();
            console.log('Qdrant集合列表:', JSON.stringify(collections, null, 2));
            
            // 检查集合是否存在
            const collectionExists = collections.collections.some(c => c.name === this.collectionName);
            console.log(`集合 ${this.collectionName} ${collectionExists ? '存在' : '不存在'}`);
            
            console.log('嵌入服务测试成功');
            
            return {
                success: true,
                embeddingDimension: embedding.embedding.length,
                collections: collections.collections.map(c => c.name)
            };
        } catch (error) {
            console.error('嵌入服务测试失败:', error);
            return {
                success: false,
                error: error.message || '未知错误'
            };
        }
    }

    /**
     * 检查Qdrant连接是否可用
     * @returns {Promise<boolean>} 连接是否可用
     */
    async checkQdrantConnection() {
        let retries = 2; // 重试次数
        let delay = 1000; // 初始延迟时间（毫秒）
        
        while (retries >= 0) {
            try {
                console.log(`检查Qdrant连接... (剩余重试次数: ${retries})`);
                // 尝试获取集合列表来验证连接
                const collections = await this.qdrantClient.getCollections();
                console.log('Qdrant连接成功，可用集合:', collections.collections?.map(c => c.name).join(', ') || '无');
                return true;
            } catch (error) {
                console.error(`Qdrant连接尝试失败 (剩余重试: ${retries}):`, error.message);
                
                // 提供更详细的错误信息
                if (error.message.includes('ECONNREFUSED')) {
                    console.error(`无法连接到Qdrant服务，请确保Qdrant服务正在运行于: ${this.qdrantUrl}`);
                } else if (error.message.includes('fetch failed')) {
                    console.error(`Qdrant服务请求失败，可能是网络问题或服务未启动: ${this.qdrantUrl}`);
                }
                
                if (retries > 0) {
                    console.log(`将在 ${delay/1000} 秒后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // 指数退避策略
                    retries--;
                } else {
                    console.error('Qdrant连接失败，已达到最大重试次数');
                    return false;
                }
            }
        }
        return false;
    }

    /**
     * 搜索相似文本
     * @param {string} text - 要搜索的文本
     * @param {number} limit - 返回结果数量限制
     * @param {string} language - 语言类型，'chinese'或'english'
     * @returns {Promise<Array>} - 搜索结果数组
     */
    async searchSimilar(text, limit = 5, language = 'chinese') {
        try {
            if (!text || typeof text !== 'string' || text.trim() === '') {
                console.error('搜索文本为空');
                return [];
            }
            
            console.log(`搜索相似文本: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}"`);
            
            // 生成文本的嵌入向量
            let embedding;
            try {
                embedding = await this.generateEmbedding(text);
                if (!embedding) {
                    console.error('无法为搜索文本生成嵌入向量');
                    return [];
                }
            } catch (embeddingError) {
                console.error('生成嵌入向量失败:', embeddingError.message);
                return [];
            }
            
            // 执行向量搜索
            let searchResults;
            try {
                // 检查Qdrant连接状态
                const isConnected = await this.checkQdrantConnection();
                if (!isConnected) {
                    console.error('Qdrant服务不可用，无法执行向量搜索');
                    return [];
                }
                
                console.log(`执行向量搜索，集合: ${this.collectionName}, 向量维度: ${embedding.embedding.length}`);
                
                // 确定使用哪个向量字段
                const vectorName = typeof language === 'string' && language.toLowerCase() === 'english' ? 'vector_en' : 'vector_cn';
                
                // 执行向量搜索
                searchResults = await this.qdrantClient.search(this.collectionName, {
                    vector: embedding.embedding,
                    limit: 50,
                    with_payload: true,  // 确保返回完整的payload
                    vector_name: vectorName  // 根据源语言选择向量字段
                });
                
                console.log(`搜索完成，找到 ${searchResults?.length || 0} 个结果`);
            } catch (qdrantError) {
                console.error('Qdrant搜索失败:', qdrantError.message);
                
                // 如果是连接错误，提供更详细的错误信息
                if (qdrantError.message.includes('ECONNREFUSED')) {
                    console.error('无法连接到Qdrant服务，请确保Qdrant服务正在运行');
                } else if (qdrantError.message.includes('fetch failed')) {
                    console.error(`Qdrant服务请求失败，可能是网络问题或服务未启动: ${this.qdrantUrl}`);
                } else if (qdrantError.message.includes('collection not found')) {
                    console.error(`集合 "${this.collectionName}" 不存在，请先创建集合`);
                    // 尝试创建集合
                    try {
                        console.log(`尝试创建集合 "${this.collectionName}"...`);
                        await this.initializeCollection();
                    } catch (initError) {
                        console.error('创建集合失败:', initError.message);
                    }
                }
                return [];
            }
            
            if (!searchResults || searchResults.length === 0) {
                console.log('未找到相似结果');
                return [];
            }
            
            // 处理搜索结果，确保包含所需字段
            const processedResults = searchResults.map(result => {
                // 确保payload存在
                const payload = result.payload || {};
                
                // 计算相似度
                let similarity = result.score;
                if (language === 'english' && payload.vector_en) {
                    similarity = this.calculateCosineSimilarity(embedding.embedding, payload.vector_en);
                } else if (language === 'chinese' && payload.vector_cn) {
                    similarity = this.calculateCosineSimilarity(embedding.embedding, payload.vector_cn);
                }
                
                // 返回处理后的结果
                return {
                    ...result,
                    score: similarity,
                    payload: {
                        id: payload.id,
                        Chinese: payload.Chinese || payload.chinese || '',
                        English: payload.English || payload.english || '',
                        Japanese: payload.Japanese || '',
                        Korean: payload.Korean || '',
                        Spanish: payload.Spanish || '',
                        French: payload.French || '',
                        German: payload.German || '',
                        Russian: payload.Russian || '',
                        Thai: payload.Thai || '',
                        Italian: payload.Italian || '',
                        Indonesian: payload.Indonesian || '',
                        Portuguese: payload.Portuguese || ''
                    }
                };
            });
            
            // 按相似度排序
            processedResults.sort((a, b) => b.score - a.score);
            
            console.log(`找到 ${processedResults.length} 条相似结果`);
            return processedResults;
        } catch (error) {
            console.error('搜索相似文本失败:', error);
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

    /**
     * 将文本添加到向量存储
     * @param {string} text - 要添加的文本
     * @param {string} language - 文本语言，'chinese'或'english'
     * @param {Object} metadata - 元数据
     * @returns {Promise<string>} - 添加的记录ID
     */
    async addToVectorStore(text, language = 'chinese', metadata = {}) {
        try {
            if (!text || typeof text !== 'string' || text.trim() === '') {
                console.error('添加到向量存储的文本为空');
                throw new Error('文本为空');
            }
            
            console.log(`添加文本到向量存储: "${text.substring(0, 30)}${text.length > 30 ? '...' : ''}", 语言: ${language}`);
            
            // 生成文本的嵌入向量
            const embedding = await this.generateEmbedding(text);
            if (!embedding) {
                throw new Error('无法生成嵌入向量');
            }
            
            // 生成唯一ID
            const uuid = crypto.randomUUID();
            
            // 将文本和向量添加到Qdrant
            await this.qdrantClient.upsert(this.collectionName, {
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
            
            console.log(`成功添加文本到向量存储，ID: ${uuid}`);
            return uuid;
        } catch (error) {
            console.error('添加文本到向量存储失败:', error);
            throw error;
        }
    }

    /**
     * 删除指定ID的向量
     * @param {string} id - 向量ID
     * @returns {Promise<boolean>} - 删除是否成功
     */
    async deleteVector(id) {
        try {
            if (!id) {
                console.error('删除向量失败: ID为空');
                return false;
            }

            console.log(`删除向量: ${id}`);
            
            // 检查Qdrant连接状态
            const isConnected = await this.checkQdrantConnection();
            if (!isConnected) {
                console.error('Qdrant服务不可用，无法删除向量');
                return false;
            }
            
            // 删除向量
            await this.qdrantClient.delete(this.collectionName, {
                points: [id],
            });
            
            console.log(`成功删除向量: ${id}`);
            return true;
        } catch (error) {
            console.error(`删除向量失败: ${error.message}`);
            return false;
        }
    }
}
