import * as XLSX from 'xlsx';
import { databaseService } from './database.js';

export class ExcelImporter {
    constructor() {
        this.columnMapping = {
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
            '葡萄牙语': 'Portuguese',
            '越南语': 'Vietnamese',
            '繁体中文': 'TraditionalChinese'
        };
    }

    /**
     * 从Excel文件中读取数据并返回解析后的条目
     * @param {File} file Excel文件
     * @returns {Promise<Array>} 解析后的翻译条目数组
     */
    async parseExcelFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = async (e) => {
                try {
                    const data = new Uint8Array(e.target?.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // 假设第一个工作表包含数据
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // 将工作表转换为JSON对象数组
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        range: 6 // 从第7行开始（索引为6）
                    });
                    
                    // 获取表头（第二行，索引为1）
                    const headerRow = XLSX.utils.sheet_to_json(worksheet, { 
                        header: 1,
                        range: 1 // 第二行
                    })[0];
                    
                    // 创建列索引映射
                    const columnIndices = {};
                    headerRow.forEach((header, index) => {
                        if (this.columnMapping[header]) {
                            columnIndices[this.columnMapping[header]] = index;
                        }
                    });
                    
                    // 解析数据行
                    const entries = [];
                    jsonData.forEach((row) => {
                        if (!row || row.length === 0 || !row[0]) {
                            return; // 跳过空行
                        }
                        
                        const entry = {};
                        Object.keys(this.columnMapping).forEach(chineseHeader => {
                            const englishColumn = this.columnMapping[chineseHeader];
                            const columnIndex = columnIndices[englishColumn];
                            
                            if (columnIndex !== undefined) {
                                entry[englishColumn] = row[columnIndex] || '';
                            } else {
                                entry[englishColumn] = ''; // 如果列不存在，设置为空字符串
                            }
                        });
                        
                        entries.push(entry);
                    });
                    
                    resolve(entries);
                } catch (error) {
                    console.error('解析Excel文件时出错:', error);
                    reject(error);
                }
            };
            
            reader.onerror = (error) => {
                console.error('读取Excel文件时出错:', error);
                reject(error);
            };
            
            reader.readAsArrayBuffer(file);
        });
    }

    /**
     * 将Excel数据导入到数据库
     * @param {File} file Excel文件
     * @returns {Promise<number>} 导入的条目数量
     */
    async importExcelToDatabase(file) {
        try {
            // 初始化数据库（确保表已创建）
            await databaseService.initializeDatabase();
            
            // 解析Excel文件
            const entries = await this.parseExcelFile(file);
            
            if (entries.length === 0) {
                return 0;
            }
            
            // 批量导入数据
            const importedCount = await databaseService.bulkImport(entries);
            return importedCount;
        } catch (error) {
            console.error('导入Excel到数据库时出错:', error);
            throw error;
        }
    }
}

export const excelImporter = new ExcelImporter();
