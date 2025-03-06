import * as XLSX from 'xlsx';
import { SheetData } from '../types/types';

export function readExcelFile(file: File): Promise<{ [key: string]: SheetData }> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const workbook = XLSX.read(data, { type: 'binary' });
                const result: { [key: string]: SheetData } = {};

                workbook.SheetNames.forEach(sheetName => {
                    const worksheet = workbook.Sheets[sheetName];
                    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as string[][];
                    
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

export function createExcelWorkbook(data: { [key: string]: SheetData }): XLSX.WorkBook {
    const workbook = XLSX.utils.book_new();

    Object.entries(data).forEach(([sheetName, sheetData]) => {
        const allRows = [...sheetData.headerRows, ...sheetData.rows];
        const worksheet = XLSX.utils.aoa_to_sheet(allRows);
        XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });

    return workbook;
}

export function getExcelColumnName(index: number): string {
    let columnName = '';
    while (index >= 0) {
        columnName = String.fromCharCode(65 + (index % 26)) + columnName;
        index = Math.floor(index / 26) - 1;
    }
    return columnName;
}
