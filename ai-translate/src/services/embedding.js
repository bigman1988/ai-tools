import fetch, { Headers } from 'node-fetch';
import { QdrantClient } from '@qdrant/js-client-rest';
import crypto from 'crypto'; // 导入crypto模块
// 不再使用 dotenv/config，在服务器启动时已加载环境变量

// 如果在Node.js环境中，需要全局提供Headers和fetch
if (typeof global !== 'undefined') {
    if (!global.Headers) {
        global.Headers = Headers;
    }
    if (!global.fetch) {
        global.fetch = fetch;
    }
}

// 单例实例
let instance = null;

export class OllamaEmbeddingService {
    constructor(
        ollamaUrl = process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
        modelName = 'bge-m3:latest',
        qdrantUrl = process.env.QDRANT_URL || 'http://172.16.0.78:6333',
        collectionName = 'translation_embeddings',
        vectorSize = 1024
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
                            vector_cn: {
                                size: this.vectorSize,
                                distance: 'Cosine'
                            },
                            vector_en: {
                                size: this.vectorSize,
                                distance: 'Cosine'
                            }
                        }
                    });
                    console.log(`成功创建集合: ${this.collectionName}`);
                } else {
                    console.log(`集合已存在: ${this.collectionName}`);
                    
                    // 检查集合的向量维度是否匹配
                    try {
                        const collectionInfo = await this.qdrantClient.getCollection(this.collectionName);
                        console.log('集合配置:', JSON.stringify(collectionInfo.config, null, 2));
                        
                        // 检查是否需要重新创建集合（向量维度变化或需要命名向量）
                        const needsRecreation = this.checkIfCollectionNeedsRecreation(collectionInfo);
                        
                        if (needsRecreation) {
                            console.log('集合配置不匹配，需要重新创建...');
                            // 删除旧集合
                            await this.qdrantClient.deleteCollection(this.collectionName);
                            console.log(`已删除旧集合: ${this.collectionName}`);
                            
                            // 创建新集合
                            await this.qdrantClient.createCollection(this.collectionName, {
                                vectors: {
                                    vector_cn: {
                                        size: this.vectorSize,
                                        distance: 'Cosine'
                                    },
                                    vector_en: {
                                        size: this.vectorSize,
                                        distance: 'Cosine'
                                    }
                                }
                            });
                            console.log(`成功重新创建集合: ${this.collectionName}`);
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
     * 检查集合是否需要重新创建
     * @param {Object} collectionInfo - 集合信息
     * @returns {boolean} - 是否需要重新创建
     */
    checkIfCollectionNeedsRecreation(collectionInfo) {
        // 检查是否使用命名向量
        const hasNamedVectors = collectionInfo.config?.params?.vectors?.vector_cn && 
                               collectionInfo.config?.params?.vectors?.vector_en;
        
        if (!hasNamedVectors) {
            console.log('集合不使用命名向量，需要重新创建');
            return true;
        }
        
        // 检查向量维度
        const cnVectorSize = collectionInfo.config?.params?.vectors?.vector_cn?.size;
        const enVectorSize = collectionInfo.config?.params?.vectors?.vector_en?.size;
        
        if (cnVectorSize !== this.vectorSize || enVectorSize !== this.vectorSize) {
            console.log(`向量维度不匹配: 当前配置=${this.vectorSize}, 集合中文向量=${cnVectorSize}, 英文向量=${enVectorSize}`);
            return true;
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
                    'Content-Type': 'application/json; charset=UTF-8'
                },
                body: JSON.stringify(requestBody)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`嵌入API错误 - 状态码: ${response.status}, 错误信息:`, errorText);
                throw new Error(`嵌入API错误: ${response.status}`);
            }
            
            const responseText = await response.text();
            //console.log('嵌入API原始响应:', responseText);
            
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
            // 验证输入
            if (!entry || !entry.Chinese) {
                console.error('无效的条目:', entry);
                throw new Error('条目必须包含中文字段');
            }
            
            // 生成唯一ID
            const id = crypto.randomUUID();
            
            // 生成中文嵌入
            let chineseEmbedding = null;
            try {
                chineseEmbedding = await this.generateEmbedding(entry.Chinese);
            } catch (cnError) {
                console.error('生成中文嵌入失败:', cnError.message);
                throw new Error(`生成中文嵌入失败: ${cnError.message}`);
            }
            
            // 生成英文嵌入（如果有英文字段）
            let englishEmbedding = null;
            if (entry.English && entry.English.trim() !== '') {
                try {
                    englishEmbedding = await this.generateEmbedding(entry.English);
                } catch (enError) {
                    console.error('生成英文嵌入失败:', enError.message);
                    // 英文嵌入失败不阻止整个过程，只记录错误
                }
            }
            
            // 构建向量对象
            const vectors = {
                vector_cn: chineseEmbedding.embedding
            };
            
            // 如果有英文嵌入，添加到向量对象
            if (englishEmbedding) {
                vectors.vector_en = englishEmbedding.embedding;
            }
            
            // 构建payload对象
            const payload = {
                Chinese: entry.Chinese,
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
            
            // 存储向量
            await this.qdrantClient.upsert(this.collectionName, {
                points: [
                    {
                        id: id,
                        vectors: vectors,
                        payload: payload
                    }
                ]
            });
            
            console.log(`成功存储向量 ID: ${id}`);
            return {
                success: true,
                id: id
            };
        } catch (error) {
            console.error('存储条目向量失败:', error.message);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * 更新翻译条目的向量
     * @param {Object} entry - 条目对象
     * @param {string} id - 向量ID
     * @returns {Promise<Object>} - 更新结果
     */
    async updateEntryVectors(entry, id) {
        try {
            if (!entry || !id) {
                console.error('更新向量失败: 缺少条目或ID');
                return { success: false, error: '缺少条目或ID' };
            }
            
            console.log(`更新向量 ID: ${id}, 条目: "${entry.Chinese || '未知'}"`);
            
            // 生成中文向量
            let vector_cn = null;
            if (entry.Chinese && entry.Chinese.trim() !== '') {
                try {
                    const cnEmbedding = await this.generateEmbedding(entry.Chinese);
                    vector_cn = cnEmbedding.embedding;
                } catch (cnError) {
                    console.error('生成中文向量失败:', cnError.message);
                }
            }
            
            // 生成英文向量
            let vector_en = null;
            if (entry.English && entry.English.trim() !== '') {
                try {
                    const enEmbedding = await this.generateEmbedding(entry.English);
                    vector_en = enEmbedding.embedding;
                } catch (enError) {
                    console.error('生成英文向量失败:', enError.message);
                }
            }
            
            // 如果没有成功生成任何向量，则返回失败
            if (!vector_cn && !vector_en) {
                console.error('无法为条目生成向量嵌入:', entry.Chinese || entry.English || '未知条目');
                return { success: false, error: '无法生成向量嵌入' };
            }
            
            // 准备payload
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
            
            // 准备向量对象
            const vectors = {};
            if (vector_cn) {
                vectors.vector_cn = vector_cn;
            }
            if (vector_en) {
                vectors.vector_en = vector_en;
            }
            
            // 创建点对象
            const point = {
                id: id,
                vectors: vectors,
                payload: payload
            };

            // 更新Qdrant中的向量
            await this.qdrantClient.upsert(this.collectionName, {
                wait: true,
                points: [point]
            });
            
            console.log(`成功更新向量 ID: ${id}`);
            return { success: true, id: id };
        } catch (error) {
            console.error('更新向量失败:', error.message);
            return { success: false, error: error.message };
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
     * @param {string} language - 文本语言，用于确定使用哪个向量字段
     * @param {number} limit - 返回结果数量限制
     * @returns {Promise<Array>} - 相似条目数组
     */
    async searchSimilar(text, language = 'chinese', limit = 5) {
        try {
            console.log(`开始搜索相似条目 - 文本: "${text}", 语言: ${language}, 限制: ${limit}`);
            
            // 生成文本嵌入
            const embedding = await this.generateEmbedding(text);
            
            if (!embedding || !embedding.embedding) {
                console.error('生成嵌入失败，无法执行搜索');
                return [];
            }
            
            console.log(`成功生成嵌入向量，维度: ${embedding.embedding.length}`);
            
            // 确定使用哪个向量字段
            // 标准化语言参数，忽略大小写，只关注是否是英语
            const isEnglish = typeof language === 'string' && language.toLowerCase().includes('english');
            const vectorName = isEnglish ? 'vector_en' : 'vector_cn';
            
            console.log(`使用向量字段: ${vectorName}, 语言参数: ${language}, 是否英语: ${isEnglish}`);
            
            let searchResults = [];
            
            try {
                // 执行向量搜索
                searchResults = await this.qdrantClient.search(this.collectionName, {
                    vector: {name:vectorName, vector:embedding.embedding},
                    limit: 1,
                    with_payload: true
                });
                
                console.log(`搜索完成，找到 ${searchResults?.length || 0} 个结果`);
            } catch (qdrantError) {
                console.error('Qdrant搜索失败:', qdrantError.message);
                
                // 提供更详细的错误信息
                if (qdrantError.message.includes('ECONNREFUSED')) {
                    console.error(`无法连接到Qdrant服务，请确保Qdrant服务正在运行于: ${this.qdrantUrl}`);
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
                
                if (qdrantError.data && qdrantError.data.status && qdrantError.data.status.error) {
                    console.error('Qdrant搜索失败:', qdrantError.data.status.error);
                }
                return [];
            }
            
            if (!searchResults || searchResults.length === 0) {
                console.log('未找到相似结果');
                return [];
            }
            
            // 处理搜索结果
            const results = searchResults.map(result => {
                const payload = result.payload || {};
                
                // 计算相似度
                let similarity = result.score;
                
                // 返回处理后的结果
                return {
                    id: result.id,
                    Chinese: payload.Chinese || '',
                    English: payload.English || '',
                    Japanese: payload.Japanese || '',
                    Korean: payload.Korean || '',
                    Spanish: payload.Spanish || '',
                    French: payload.French || '',
                    German: payload.German || '',
                    Russian: payload.Russian || '',
                    Thai: payload.Thai || '',
                    Italian: payload.Italian || '',
                    Indonesian: payload.Indonesian || '',
                    Portuguese: payload.Portuguese || '',
                    similarity: similarity
                };
            });
            
            console.log(`返回 ${results.length} 个处理后的结果`);
            return results;
        } catch (error) {
            console.error('搜索相似条目失败:', error.message);
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
