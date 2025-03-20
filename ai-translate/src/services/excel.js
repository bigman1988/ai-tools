const XLSX = require('xlsx');
const { excel } = require('../config/app');
const dbService = require('./database');
const { pool } = require('../config/database');
const { embeddingService } = require('./embedding');

class ExcelService {
    /**
     * 解析Excel文件
     * @param {Buffer} buffer - Excel文件的buffer
     * @returns {Array} - 解析后的数据
     */
    parseExcel(buffer) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 获取工作表范围
        const range = XLSX.utils.decode_range(worksheet['!ref']);
        
        // 根据配置获取参数
        const startRow = excel.skipRows || 0;  // 数据开始行
        const headerRow = excel.headerRow || 1; // 表头行
        
        // 不再检查表头行和跳过行的关系，而是直接使用配置的值
        
        // 获取表头
        const headers = [];
        for (let c = range.s.c; c <= range.e.c; c++) {
            const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c });
            const cell = worksheet[cellAddress];
            if (cell && cell.v) {
                headers[c] = this.mapHeaderToField(cell.v);
            }
        }
        
        // 解析数据行，从startRow开始
        const entries = [];
        for (let r = startRow; r <= range.e.r; r++) {
            const entry = {};
            let hasData = false;
            
            for (let c = range.s.c; c <= range.e.c; c++) {
                const header = headers[c];
                if (header) {
                    const cellAddress = XLSX.utils.encode_cell({ r, c });
                    const cell = worksheet[cellAddress];
                    const value = cell ? cell.v : '';
                    
                    if (value) {
                        hasData = true;
                    }
                    
                    entry[header] = value || '';
                }
            }
            
            // 只添加有数据的行
            if (hasData && entry.Chinese) {
                entries.push(entry);
            }
        }
        
        return entries;
    }
    
    /**
     * 将Excel表头映射到数据库字段
     * @param {string} header - Excel表头
     * @returns {string} - 数据库字段
     */
    mapHeaderToField(header) {
        const mapping = {
            '简体中文': 'Chinese',
            '英语': 'English',
            '日语': 'Japanese',
            '韩语': 'Korean',
            '西班牙语': 'Spanish',
            '法语': 'French',
            '德语': 'German',
            '俄语': 'Russian',
            '泰语': 'Thai',
            '意大利语': 'Italian',
            '印尼语': 'Indonesian',
            '葡萄牙语': 'Portuguese'
        };
        
        return mapping[header] || header;
    }
    
    /**
     * 导入Excel数据到数据库
     * @param {Buffer} buffer - Excel文件的buffer
     * @param {boolean} vectorServiceAvailable - 向量服务是否可用
     * @returns {Promise<Object>} - 导入结果
     */
    async importExcel(buffer, vectorServiceAvailable) {
        let connection;
        
        try {
            // 解析Excel文件
            const entries = this.parseExcel(buffer);
            
            if (entries.length === 0) {
                throw new Error('Excel文件中没有有效数据');
            }
            
            // 获取数据库连接并开始事务
            connection = await pool.getConnection();
            await connection.beginTransaction();
            
            // 处理所有行数据
            for (const entry of entries) {
                try {
                    // 检查MySQL中是否已存在该条目
                    const [existingEntries] = await connection.query(
                        'SELECT * FROM `translate` WHERE Chinese = ?',
                        [entry.Chinese]
                    );
                    
                    // 如果向量服务可用，则生成向量ID
                    if (vectorServiceAvailable) {
                        try {
                            // 生成向量嵌入
                            const vectorResult = await embeddingService.storeEntryVectors(entry);
                            
                            if (vectorResult && vectorResult.success) {
                                entry.vector_id = vectorResult.id;
                            }
                        } catch (error) {
                            console.error('生成向量嵌入失败:', error);
                            // 继续处理，但不设置向量ID
                        }
                    }
                    
                    if (existingEntries.length > 0) {
                        // 更新现有条目
                        await connection.query(
                            'UPDATE `translate` SET English = ?, Japanese = ?, Korean = ?, Spanish = ?, French = ?, German = ?, Russian = ?, Thai = ?, Italian = ?, Indonesian = ?, Portuguese = ?, vector_id = ? WHERE Chinese = ?',
                            [
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
                                entry.vector_id || null,
                                entry.Chinese
                            ]
                        );
                    } else {
                        // 插入新条目
                        await connection.query(
                            'INSERT INTO `translate` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                            [
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
                            ]
                        );
                    }
                } catch (error) {
                    console.error('处理条目失败:', entry.Chinese, error);
                    throw error;
                }
            }
            
            // 提交事务
            await connection.commit();
            
            return {
                success: true,
                message: `成功导入 ${entries.length} 条数据`,
                count: entries.length
            };
        } catch (error) {
            console.error('导入Excel时出错:', error);
            
            // 如果事务已开始，则回滚
            if (connection) {
                try {
                    await connection.rollback();
                } catch (rollbackError) {
                    console.error('回滚事务失败:', rollbackError);
                }
            }
            
            throw error;
        } finally {
            // 释放连接
            if (connection) {
                connection.release();
            }
        }
    }
    
    /**
     * 导出数据库数据到Excel
     * @returns {Promise<Buffer>} - Excel文件的buffer
     */
    async exportExcel() {
        try {
            // 从数据库获取所有条目
            const entries = await dbService.getEntries({});
            
            if (entries.length === 0) {
                throw new Error('数据库中没有数据可导出');
            }
            
            // 创建工作簿和工作表
            const workbook = XLSX.utils.book_new();
            
            // 定义表头映射
            const headerMapping = {
                'Chinese': '简体中文',
                'English': '英语',
                'Japanese': '日语',
                'Korean': '韩语',
                'Spanish': '西班牙语',
                'French': '法语',
                'German': '德语',
                'Russian': '俄语',
                'Thai': '泰语',
                'Italian': '意大利语',
                'Indonesian': '印尼语',
                'Portuguese': '葡萄牙语'
            };
            
            // 准备数据
            const data = entries.map(entry => {
                const row = {};
                for (const [field, header] of Object.entries(headerMapping)) {
                    row[header] = entry[field] || '';
                }
                return row;
            });
            
            // 创建工作表
            const worksheet = XLSX.utils.json_to_sheet(data, { header: Object.values(headerMapping) });
            
            // 将工作表添加到工作簿
            XLSX.utils.book_append_sheet(workbook, worksheet, '翻译数据');
            
            // 生成Excel文件的buffer
            const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
            
            return buffer;
        } catch (error) {
            console.error('导出Excel时出错:', error);
            throw error;
        }
    }
}

module.exports = new ExcelService();
