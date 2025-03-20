import { databaseService as dbService } from './database.js';
import { embeddingService } from './embedding-instance.js';

export class KnowledgeBaseService {
    /**
     * 初始化知识库服务
     */
    constructor() {
        this.vectorServiceAvailable = false;
    }

    /**
     * 设置向量服务状态
     * @param {boolean} status - 向量服务是否可用
     */
    setVectorServiceStatus(status) {
        this.vectorServiceAvailable = status;
    }

    /**
     * 获取向量服务状态
     * @returns {boolean} - 向量服务是否可用
     */
    getVectorServiceStatus() {
        return this.vectorServiceAvailable;
    }

    /**
     * 添加翻译条目
     * @param {Object} entry - 翻译条目
     * @returns {Promise<Object>} - 添加结果
     */
    async addEntry(entry) {
        // 处理向量数据
        if (this.vectorServiceAvailable) {
            try {
                console.log(`存储翻译条目向量: ${entry.Chinese}`);
                // 使用新的方法存储完整的翻译条目向量
                const vectorResult = await embeddingService.storeEntryVectors(entry);
                
                if (vectorResult.success) {
                    entry.vector_id = vectorResult.id;
                    console.log(`向量ID: ${entry.vector_id}`);
                } else {
                    console.error(`创建向量失败: ${entry.Chinese}`);
                }
            } catch (vectorError) {
                console.error('向量处理失败:', vectorError);
                // 继续执行，即使向量处理失败
            }
        }

        // 添加条目到数据库
        return await dbService.addEntry(entry);
    }

    /**
     * 更新翻译条目
     * @param {string} chinese - 中文关键字
     * @param {Object} entry - 更新的翻译条目
     * @returns {Promise<Object>} - 更新结果
     */
    async updateEntry(chinese, entry) {
        // 更新向量存储
        if (this.vectorServiceAvailable) {
            try {
                // 首先获取当前条目的完整数据
                const currentEntry = await dbService.getEntry(chinese);
                
                if (!currentEntry) {
                    console.log(`未找到要更新的条目: ${chinese}`);
                } else {
                    // 合并当前数据和更新数据
                    const fullEntry = { ...currentEntry, ...entry };
                    
                    // 获取当前的vector_id
                    let currentVectorId = null;
                    if (currentEntry.vector_id) {
                        currentVectorId = currentEntry.vector_id;
                    }
                    
                    console.log(`更新翻译条目向量: ${chinese}, 当前ID: ${currentVectorId}`);
                    
                    // 使用新的方法更新完整的翻译条目向量
                    const vectorResult = await embeddingService.updateEntryVectors(currentVectorId, fullEntry);
                    
                    if (vectorResult.success) {
                        console.log(`向量ID: ${vectorResult.id}`);
                        entry.vector_id = vectorResult.id;
                    } else {
                        console.error(`更新向量失败: ${chinese}`);
                    }
                }
            } catch (vectorError) {
                console.error('向量更新失败:', vectorError);
                // 继续执行，即使向量处理失败
            }
        }

        // 更新数据库中的条目
        return await dbService.updateEntry(chinese, entry);
    }

    /**
     * 删除翻译条目
     * @param {string} chinese - 中文关键字
     * @returns {Promise<Object>} - 删除结果
     */
    async deleteEntry(chinese) {
        try {
            console.log(`尝试删除条目: "${chinese}"`);
            
            // 使用数据库服务删除条目
            const result = await dbService.deleteEntry(chinese);
            
            // 如果成功且有向量ID，尝试删除向量
            if (result.success && result.vectorId && this.vectorServiceAvailable) {
                try {
                    await embeddingService.deleteEmbedding(result.vectorId);
                    console.log(`已删除向量: ${result.vectorId}`);
                    return {
                        ...result,
                        vectorDeleted: true
                    };
                } catch (vectorError) {
                    console.warn(`删除向量失败: ${result.vectorId}`, vectorError);
                    return {
                        ...result,
                        vectorDeleted: false,
                        vectorError: vectorError.message
                    };
                }
            }
            
            return result;
        } catch (error) {
            console.error(`删除失败: "${chinese}"`, error);
            throw error;
        }
    }

    /**
     * 搜索翻译条目
     * @param {Object} options - 搜索选项
     * @param {string} options.search - 搜索关键词
     * @param {number} options.limit - 限制结果数量
     * @param {number} options.offset - 结果偏移量
     * @returns {Promise<Array>} - 搜索结果
     */
    async searchEntries({ search, limit = 100, offset = 0 }) {
        if (search && this.vectorServiceAvailable) {
            try {
                // 使用向量搜索
                const results = await embeddingService.searchSimilar(search, 'chinese', parseInt(limit) || 5);
                
                // 从结果中提取中文关键字
                const chineseKeys = results.map(item => item.metadata?.Chinese || '').filter(Boolean);
                
                if (chineseKeys.length > 0) {
                    // 构建 IN 查询
                    const placeholders = chineseKeys.map(() => '?').join(',');
                    const [rows] = await dbService.pool.execute(
                        `SELECT * FROM \`translate\` WHERE Chinese IN (${placeholders})`,
                        chineseKeys
                    );
                    
                    // 按照向量搜索结果的顺序排序
                    const orderedRows = [];
                    for (const key of chineseKeys) {
                        const match = rows.find(row => row.Chinese === key);
                        if (match) orderedRows.push(match);
                    }
                    
                    return orderedRows;
                }
                
                return [];
            } catch (vectorError) {
                console.error('向量搜索失败，回退到普通搜索:', vectorError);
                // 如果向量搜索失败，回退到普通搜索
            }
        }
        
        // 普通数据库查询
        return await dbService.getEntries({ search, limit, offset });
    }

    /**
     * 向量搜索
     * @param {string} text - 搜索文本
     * @param {string} type - 搜索类型 (chinese 或 english)
     * @param {number} limit - 限制结果数量
     * @returns {Promise<Array>} - 搜索结果
     */
    async vectorSearch(text, type = 'chinese', limit = 5) {
        if (!this.vectorServiceAvailable) {
            throw new Error('向量搜索服务不可用');
        }
        
        return await embeddingService.searchSimilar(text, type, parseInt(limit));
    }

    /**
     * 高级向量搜索，返回完整的翻译条目
     * @param {string} text - 搜索文本
     * @param {string} type - 搜索类型 (chinese 或 english)
     * @param {number} limit - 限制结果数量
     * @returns {Promise<Array>} - 搜索结果
     */
    async advancedVectorSearch(text, type = 'chinese', limit = 5) {
        if (!this.vectorServiceAvailable) {
            throw new Error('向量搜索服务不可用');
        }
        
        const results = await embeddingService.searchSimilar(text, type, parseInt(limit));
        
        // 从数据库获取完整的翻译条目
        if (results.length > 0) {
            const ids = results.map(result => {
                // 从ID中提取Chinese部分（去掉语言后缀）
                const idParts = result.id.split('_');
                return idParts[0]; // 返回不带语言后缀的ID部分
            });
            
            // 构建IN查询的占位符
            const placeholders = ids.map(() => '?').join(',');
            
            // 查询数据库获取完整条目
            const [entries] = await dbService.pool.execute(
                `SELECT * FROM \`translate\` WHERE Chinese IN (${placeholders})`,
                ids
            );
            
            // 将数据库结果与向量搜索结果合并
            const enrichedResults = results.map(result => {
                const idParts = result.id.split('_');
                const chinese = idParts[0];
                const entry = entries.find(e => e.Chinese === chinese) || {};
                
                return {
                    ...result,
                    entry
                };
            });
            
            return enrichedResults;
        }
        
        return [];
    }
}

export const knowledgeBaseService = new KnowledgeBaseService();
