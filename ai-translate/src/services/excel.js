import XLSX from 'xlsx';
import appConfig from '../config/app.js';
import { databaseService as dbService } from './database.js';
import { pool } from '../config/database.js';
import { embeddingService } from './embedding.js';

// 从配置中获取 excel 配置
const excel = appConfig.excel;

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
            
            // 统计结果
            const result = {
                total: entries.length,
                inserted: 0,
                updated: 0,
                skipped: 0,
                vectorsCreated: 0,
                errors: []
            };
            
            // 处理所有行数据
            for (const entry of entries) {
                try {
                    // 检查MySQL中是否已存在该条目
                    const [existingEntries] = await connection.query(
                        'SELECT * FROM `translate` WHERE Chinese = ?',
                        [entry.Chinese]
                    );
                    
                    let needVectorUpdate = false;
                    let dataChanged = false;
                    let existingEntry = null;
                    
                    if (existingEntries.length > 0) {
                        // 获取现有条目
                        existingEntry = existingEntries[0];
                        
                        // 检查是否需要更新（只有当新数据有值且与现有数据不同时才更新）
                        const fieldsToCheck = [
                            'English', 'Japanese', 'Korean', 'Spanish', 'French', 
                            'German', 'Russian', 'Thai', 'Italian', 'Indonesian', 'Portuguese'
                        ];
                        
                        // 构建更新字段和参数
                        const updateFields = [];
                        const updateParams = [];
                        
                        for (const field of fieldsToCheck) {
                            // 如果新数据有值（不为空、undefined或null）
                            if (entry[field] && entry[field].trim() !== '') {
                                // 如果现有数据为空或与新数据不同
                                if (!existingEntry[field] || existingEntry[field].trim() === '' || 
                                    existingEntry[field] !== entry[field]) {
                                    updateFields.push(`${field} = ?`);
                                    updateParams.push(entry[field]);
                                    dataChanged = true;
                                }
                            }
                        }
                        
                        // 只有在数据发生变化时才需要更新向量
                        needVectorUpdate = dataChanged;
                        
                        // 如果有字段需要更新
                        if (updateFields.length > 0) {
                            // 添加WHERE条件参数
                            updateParams.push(entry.Chinese);
                            
                            // 执行更新
                            const updateSql = `UPDATE \`translate\` SET ${updateFields.join(', ')} WHERE Chinese = ?`;
                            await connection.query(updateSql, updateParams);
                            
                            result.updated++;
                            console.log(`更新条目: "${entry.Chinese}"`);
                        } else {
                            // 没有字段需要更新，跳过
                            result.skipped++;
                            console.log(`跳过条目(无需更新): "${entry.Chinese}"`);
                            continue; // 跳过向量处理
                        }
                    } else {
                        // 新条目，需要插入
                        needVectorUpdate = true;
                        
                        // 插入新条目
                        await connection.query(
                            'INSERT INTO `translate` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                                entry.Portuguese || ''
                            ]
                        );
                        
                        result.inserted++;
                        console.log(`插入条目: "${entry.Chinese}"`);
                    }
                    
                    // 如果向量服务可用且需要更新向量
                    if (vectorServiceAvailable && needVectorUpdate) {
                        try {
                            // 如果是更新且已有向量ID，先删除旧向量
                            if (existingEntry && existingEntry.vector_id) {
                                try {
                                    await embeddingService.deleteEmbedding(existingEntry.vector_id);
                                    console.log(`删除旧向量: ${existingEntry.vector_id}`);
                                } catch (vectorDeleteError) {
                                    console.warn(`删除旧向量失败: ${existingEntry.vector_id}`, vectorDeleteError);
                                }
                            }
                            
                            // 生成新的向量嵌入
                            const vectorResult = await embeddingService.storeEntryVectors(entry);
                            
                            if (vectorResult && vectorResult.success) {
                                // 更新数据库中的向量ID
                                await connection.query(
                                    'UPDATE `translate` SET vector_id = ? WHERE Chinese = ?',
                                    [vectorResult.id, entry.Chinese]
                                );
                                
                                result.vectorsCreated++;
                                console.log(`创建向量: ${vectorResult.id} 用于条目 "${entry.Chinese}"`);
                            }
                        } catch (vectorError) {
                            console.error(`生成向量嵌入失败: "${entry.Chinese}"`, vectorError);
                            // 继续处理，但记录错误
                            result.errors.push({
                                entry: entry.Chinese,
                                error: `向量处理失败: ${vectorError.message}`
                            });
                        }
                    }
                } catch (entryError) {
                    console.error(`处理条目失败: "${entry.Chinese}"`, entryError);
                    result.errors.push({
                        entry: entry.Chinese,
                        error: entryError.message
                    });
                }
            }
            
            // 提交事务
            await connection.commit();
            
            return {
                success: true,
                ...result
            };
        } catch (error) {
            // 回滚事务
            if (connection) {
                await connection.rollback();
            }
            
            console.error('导入Excel失败:', error);
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

const excelService = new ExcelService();
const importExcel = excelService.importExcel.bind(excelService);
const exportExcel = excelService.exportExcel.bind(excelService);

export { excelService, importExcel, exportExcel };
