import { pool } from '../config/database.js';

export class DatabaseService {
    constructor() {
        this.pool = pool;
        console.log('数据库服务已初始化');
    }

    /**
     * 获取翻译条目列表
     * @param {Object} options - 查询选项
     * @param {string} options.search - 搜索关键词
     * @param {number} options.limit - 限制结果数量
     * @param {number} options.offset - 结果偏移量
     * @returns {Promise<Array>} - 翻译条目列表
     */
    async getEntries({ search, limit, offset } = {}) {
        try {
            // 确保limit和offset是整数
            const safeLimit = parseInt(limit) || 100;
            const safeOffset = parseInt(offset) || 0;
            
            let sql, params = [];
            
            if (search) {
                // 对于搜索操作，保留LIMIT以避免返回过多结果
                sql = 'SELECT * FROM `translate` WHERE Chinese LIKE ? OR English LIKE ? LIMIT ' + safeLimit + ' OFFSET ' + safeOffset;
                params = [`%${search}%`, `%${search}%`];
            } else {
                // 对于初始加载，获取所有数据（不使用LIMIT）
                sql = 'SELECT * FROM `translate`';
            }
            
            console.log('执行SQL查询:', sql);
            const [rows] = await this.pool.query(sql, params);
            return rows;
        } catch (error) {
            console.error('获取条目失败:', error);
            throw error;
        }
    }

    /**
     * 获取单个翻译条目
     * @param {string} chinese - 中文关键字
     * @returns {Promise<Object>} - 翻译条目
     */
    async getEntry(chinese) {
        try {
            const sql = 'SELECT * FROM `translate` WHERE Chinese = ?';
            const [rows] = await this.pool.query(sql, [chinese]);
            
            if (rows.length === 0) {
                return null;
            }
            
            return rows[0];
        } catch (error) {
            console.error('获取条目失败:', error);
            throw error;
        }
    }

    /**
     * 获取向量ID
     * @param {string} chinese - 中文关键字
     * @returns {Promise<string|null>} - 向量ID
     */
    async getVectorId(chinese) {
        try {
            const sql = 'SELECT vector_id FROM `translate` WHERE Chinese = ?';
            const [rows] = await this.pool.query(sql, [chinese]);
            
            if (rows.length === 0 || !rows[0].vector_id) {
                return null;
            }
            
            return rows[0].vector_id;
        } catch (error) {
            console.error('获取向量ID失败:', error);
            throw error;
        }
    }

    /**
     * 添加翻译条目
     * @param {Object} entry - 翻译条目
     * @returns {Promise<void>}
     */
    async addEntry(entry) {
        try {
            const sql = 'INSERT INTO `translate` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
            const params = [
                entry.Chinese || '',
                entry.English || '',
                entry.Japanese || '',
                entry.Korean || '',
                entry.Spanish || '',
                entry.French || '',
                entry.German || '',
                entry.Russian || '',
                entry.Thai || '',
                entry.Italian || '',
                entry.Indonesian || '',
                entry.Portuguese || '',
                entry.vector_id || null
            ];
            
            await this.pool.query(sql, params);
        } catch (error) {
            console.error('添加条目失败:', error);
            throw error;
        }
    }

    /**
     * 更新翻译条目
     * @param {string} chinese - 中文关键字
     * @param {Object} entry - 更新的翻译条目
     * @returns {Promise<void>}
     */
    async updateEntry(chinese, entry) {
        try {
            // 首先检查条目是否存在
            const existingEntry = await this.getEntry(chinese);
            
            if (!existingEntry) {
                throw new Error('未找到要更新的条目');
            }
            
            // 构建更新语句
            const fields = [
                'Chinese', 'English', 'Japanese', 'Korean', 
                'Spanish', 'French', 'German', 'Russian', 
                'Thai', 'Italian', 'Indonesian', 'Portuguese',
                'vector_id'
            ];
            
            const updates = [];
            const params = [];
            
            for (const field of fields) {
                if (field in entry) {
                    updates.push(`${field} = ?`);
                    params.push(entry[field] || '');
                }
            }
            
            if (updates.length === 0) {
                console.log('没有字段需要更新');
                return;
            }
            
            const sql = `UPDATE \`translate\` SET ${updates.join(', ')} WHERE Chinese = ?`;
            params.push(chinese);
            
            await this.pool.query(sql, params);
        } catch (error) {
            console.error('更新条目失败:', error);
            throw error;
        }
    }

    /**
     * 删除翻译条目
     * @param {string} chinese - 中文关键字
     * @returns {Promise<Object>} - 删除结果
     */
    async deleteEntry(chinese) {
        let connection;
        try {
            console.log(`尝试删除条目，Chinese值: "${chinese}"`);
            
            // 首先获取条目以确认它存在
            const [entries] = await this.pool.query(
                'SELECT * FROM `translate` WHERE Chinese = ?',
                [chinese]
            );
            
            console.log(`查询结果: 找到 ${entries.length} 条记录`);
            
            // 如果没有找到精确匹配的条目，尝试获取所有条目进行比较
            if (entries.length === 0) {
                console.log('尝试获取所有条目进行比较...');
                
                // 获取所有条目（限制数量以避免性能问题）
                const [allEntries] = await this.pool.query(
                    'SELECT * FROM `translate` LIMIT 1000'
                );
                
                console.log(`获取到 ${allEntries.length} 条记录进行比较`);
                
                // 标准化输入字符串（移除空格、换行符等）
                const normalizedInput = chinese
                    .replace(/\s+/g, '')
                    .replace(/\\n/g, '')
                    .replace(/<[^>]*>/g, '');
                
                console.log(`标准化后的输入: "${normalizedInput}"`);
                
                // 查找可能匹配的条目
                const matchingEntries = allEntries.filter(entry => {
                    // 标准化数据库中的字符串
                    const normalizedEntry = entry.Chinese
                        .replace(/\s+/g, '')
                        .replace(/\\n/g, '')
                        .replace(/<[^>]*>/g, '');
                    
                    // 检查标准化后的字符串是否匹配
                    return normalizedEntry.includes(normalizedInput) || 
                           normalizedInput.includes(normalizedEntry);
                });
                
                console.log(`找到 ${matchingEntries.length} 条可能匹配的记录`);
                
                if (matchingEntries.length === 0) {
                    throw new Error('未找到要删除的条目');
                }
                
                // 使用第一个匹配的条目进行删除
                const entryToDelete = matchingEntries[0];
                console.log(`将删除条目: "${entryToDelete.Chinese}"`);
                
                // 获取连接并开始事务
                connection = await this.pool.getConnection();
                await connection.beginTransaction();
                
                const [result] = await connection.query(
                    'DELETE FROM `translate` WHERE Chinese = ?',
                    [entryToDelete.Chinese]
                );
                
                console.log(`删除结果: 影响了 ${result.affectedRows} 行`);
                
                if (result.affectedRows === 0) {
                    throw new Error('删除操作未影响任何行');
                }
                
                // 提交事务
                await connection.commit();
                
                return { 
                    success: true, 
                    vectorId: entryToDelete.vector_id,
                    message: `成功删除条目: "${entryToDelete.Chinese}"`
                };
            }
            
            // 获取连接并开始事务
            connection = await this.pool.getConnection();
            await connection.beginTransaction();
            
            // 执行删除操作
            const [result] = await connection.query(
                'DELETE FROM `translate` WHERE Chinese = ?',
                [chinese]
            );
            
            console.log(`删除结果: 影响了 ${result.affectedRows} 行`);
            
            if (result.affectedRows === 0) {
                throw new Error('删除操作未影响任何行');
            }
            
            // 提交事务
            await connection.commit();
            
            return { 
                success: true, 
                vectorId: entries[0].vector_id,
                message: `成功删除条目: "${chinese}"`
            };
        } catch (error) {
            // 回滚事务
            if (connection) {
                await connection.rollback();
            }
            console.error(`删除失败: "${chinese}"`, error);
            throw error;
        } finally {
            // 释放连接
            if (connection) {
                connection.release();
            }
        }
    }

    /**
     * 获取所有条目
     * @returns {Promise<Array>} - 所有条目
     */
    async getAllEntries() {
        try {
            const sql = 'SELECT * FROM `translate`';
            const [rows] = await this.pool.query(sql);
            return rows;
        } catch (error) {
            console.error('获取所有条目失败:', error);
            throw error;
        }
    }
}

export const databaseService = new DatabaseService();
