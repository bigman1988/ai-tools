/**
 * 表格渲染器组件
 */
export class TableRenderer {
    /**
     * 创建表格渲染器
     * @param {HTMLElement} container - 表格容器元素
     */
    constructor(container) {
        this.container = container;
    }

    /**
     * 获取Excel列名
     * @param {number} index - 列索引
     * @returns {string} - 列名（如A, B, AA等）
     */
    getExcelColumnName(index) {
        let columnName = '';
        while (index >= 0) {
            columnName = String.fromCharCode(65 + (index % 26)) + columnName;
            index = Math.floor(index / 26) - 1;
        }
        return columnName;
    }

    /**
     * 直接更新DOM中的单元格内容，而不重新渲染整个表格
     * @param {number} rowIndex 行索引
     * @param {number} colIndex 列索引
     * @param {string} text 新的单元格内容
     * @param {number} headerRowsCount 头部行数量
     */
    updateCellInDOM(rowIndex, colIndex, text, headerRowsCount) {
        if (!this.container) return;
        
        const tableWrapper = this.container.querySelector('.table-wrapper');
        if (!tableWrapper) return;
        
        const table = tableWrapper.querySelector('table');
        if (!table) return;
        
        // 如果是头部行，不进行更新
        if (rowIndex < headerRowsCount) return;
        
        // 遍历所有行，找到对应的行
        const rows = table.querySelectorAll('tr');
        let targetRow = undefined;
        
        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            const rowNumberCell = row.querySelector('.row-number');
            if (rowNumberCell && rowNumberCell.textContent === (rowIndex + 1).toString()) {
                targetRow = row;
                break;
            }
        }
        
        if (!targetRow) return;
        
        // 找到对应的单元格，注意第一列是行号，所以需要+1
        if (colIndex + 1 < targetRow.children.length) {
            const cell = targetRow.children[colIndex + 1];
            if (cell) {
                cell.textContent = text;
            }
        }
    }

    /**
     * 渲染表格
     * @param {Object} sheetData - 工作表数据
     * @param {Array} sheetData.headerRows - 头部行
     * @param {Array} sheetData.rows - 数据行
     * @param {Function} onCellEdit - 单元格编辑回调
     */
    renderTable(sheetData, onCellEdit) {
        if (!this.container) return;

        // 清空现有内容
        this.container.innerHTML = '';
        
        // 创建表格容器，使用固定头的布局
        const tableWrapper = document.createElement('div');
        tableWrapper.className = 'table-wrapper';

        const table = document.createElement('table');
        table.className = 'excel-table';

        const { headerRows, rows } = sheetData;
        const allRows = [...headerRows, ...rows];

        // 计算最大列数
        const maxColumns = Math.max(
            ...headerRows.map(row => row.length),
            ...rows.map(row => row.length)
        );

        // 创建列号行
        const colNumberRow = document.createElement('tr');
        const emptyTh = document.createElement('th'); // 左上角空单元格
        colNumberRow.appendChild(emptyTh);
        
        for (let i = 0; i < maxColumns; i++) {
            const th = document.createElement('th');
            th.textContent = this.getExcelColumnName(i);
            th.className = 'column-header';
            colNumberRow.appendChild(th);
        }
        table.appendChild(colNumberRow);

        // 创建表格内容
        allRows.forEach((row, rowIndex) => {
            const tr = document.createElement('tr');
            
            // 如果不是第二行（索引为1），并且是在前6行内，则隐藏
            if (rowIndex !== 1 && rowIndex < 6) {
                tr.style.display = 'none';
                return;
            }

            // 添加行号
            const rowNumberCell = document.createElement('td');
            rowNumberCell.textContent = (rowIndex + 1).toString();
            rowNumberCell.className = 'row-number';
            tr.appendChild(rowNumberCell);

            // 添加数据单元格
            for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
                const td = document.createElement(rowIndex < headerRows.length ? 'th' : 'td');
                td.textContent = row[colIndex] || '';
                
                // 设置单元格可编辑
                if (rowIndex >= headerRows.length) {
                    td.contentEditable = 'true';
                }
                
                // 添加单元格编辑事件
                td.addEventListener('input', () => {
                    onCellEdit(rowIndex, colIndex, td.textContent || '');
                });

                tr.appendChild(td);
            }

            table.appendChild(tr);
        });

        tableWrapper.appendChild(table);
        this.container.appendChild(tableWrapper);
        
        // 添加CSS样式使行号和列头固定
        this.addTableStyles();
    }

    /**
     * 添加表格样式
     */
    addTableStyles() {
        const styleId = 'fixed-table-style';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.textContent = `
                .table-wrapper {
                    position: relative;
                    overflow: auto;
                    height: 99vh;
                    max-width: 100%;
                    border: 1px solid #ccc;
                    margin: 1px;
                    scroll-padding-top: 40px; /* 添加滚动填充，防止内容被固定头部遮挡 */
                }
                
                .excel-table {
                    border-collapse: collapse;
                }
                
                .excel-table th, .excel-table td {
                    border: 1px solid #ddd;
                    padding: 8px;
                    min-width: 100px;
                }
                
                .excel-table th:first-child {
                    position: sticky;
                    left: 0;
                    z-index: 3;
                    background-color: #f2f2f2;
                }
                
                .excel-table thead th {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background-color: #f2f2f2;
                    box-shadow: 0 1px 0 rgba(0,0,0,0.1); /* 添加底部阴影，增强视觉效果 */
                }
                
                .excel-table tr:first-child th {
                    position: sticky;
                    top: 0;
                    z-index: 2;
                    background-color: #f2f2f2;
                    box-shadow: 0 1px 0 rgba(0,0,0,0.1); /* 添加底部阴影，增强视觉效果 */
                }
                
                /* 处理左上角单元格，同时固定在顶部和左侧 */
                .excel-table tr:first-child th:first-child {
                    position: sticky;
                    top: 0;
                    left: 0;
                    z-index: 4; /* 最高层级，确保始终显示在最上层 */
                    background-color: #f2f2f2;
                    box-shadow: 1px 1px 0 rgba(0,0,0,0.1); /* 添加右侧和底部阴影 */
                }
                
                .excel-table .row-number {
                    position: sticky;
                    left: 0;
                    z-index: 1;
                    background-color: #f2f2f2;
                }
            `;
            document.head.appendChild(style);
        }
    }
}
