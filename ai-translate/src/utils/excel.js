import * as XLSX from 'xlsx';

/**
 * 读取Excel文件并解析内容
 * @param {File} file - Excel文件
 * @returns {Promise<Object>} - 解析后的数据，按工作表名称组织
 */
export function readExcelFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const result = {};

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    
                    // 分离表头行和数据行
                    const headerRows = jsonData.slice(0, 2);
                    const rows = jsonData.slice(2);

                    result[sheetName] = {
                        headerRows,
                        rows
                    };
                });

                resolve(result);
            } catch (error) {
                reject(error);
            }
        };

        reader.onerror = () => {
            reject(new Error('文件读取失败'));
        };

        reader.readAsBinaryString(file);
    });
}

/**
 * 创建Excel工作簿
 * @param {Object} data - 数据对象，按工作表名称组织
 * @returns {XLSX.WorkBook} - 创建的工作簿
 */
export function createExcelWorkbook(data) {
    const workbook = XLSX.utils.book_new();

    Object.entries(data).forEach(([sheetName, sheetData]) => {
        const allRows = [...sheetData.headerRows, ...sheetData.rows];
        const worksheet = XLSX.utils.aoa_to_sheet(allRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    return workbook;
}

/**
 * 获取Excel列名
 * @param {number} index - 列索引
 * @returns {string} - 列名（如A, B, AA等）
 */
export function getExcelColumnName(index) {
    let columnName = '';
    while (index >= 0) {
        columnName = String.fromCharCode(65 + (index % 26)) + columnName;
        index = Math.floor(index / 26) - 1;
    }
    return columnName;
}
