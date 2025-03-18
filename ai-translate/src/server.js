const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const XLSX = require('xlsx');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 配置中间件
app.use(cors());
app.use(bodyParser.json());

// 配置文件上传
const upload = multer({ storage: multer.memoryStorage() });

// 创建数据库连接池
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'translation_kb',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// 初始化数据库
async function initializeDatabase() {
    try {
        // 创建translate-cn表（如果不存在）
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS \`translate-cn\` (
                Chinese VARCHAR(255) PRIMARY KEY,
                English TEXT,
                Japanese TEXT,
                Korean TEXT,
                Spanish TEXT,
                French TEXT,
                German TEXT,
                Russian TEXT,
                Thai TEXT,
                Italian TEXT,
                Indonesian TEXT,
                Portuguese TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
            )
        `);
        console.log('数据库初始化成功');
    } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    }
}

// API路由

// 检查服务器状态
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: '服务器正常运行' });
});

// 获取翻译条目
app.get('/api/entries', async (req, res) => {
    try {
        const { search, limit = 100, offset = 0 } = req.query;
        
        let query = 'SELECT * FROM `translate-cn` WHERE 1=1';
        const params = [];

        if (search) {
            query += ' AND (Chinese LIKE ? OR English LIKE ? OR Japanese LIKE ? OR Korean LIKE ? OR Spanish LIKE ? OR French LIKE ? OR German LIKE ? OR Russian LIKE ? OR Thai LIKE ? OR Italian LIKE ? OR Indonesian LIKE ? OR Portuguese LIKE ?)';
            const searchPattern = `%${search}%`;
            params.push(
                searchPattern, searchPattern, searchPattern, searchPattern,
                searchPattern, searchPattern, searchPattern, searchPattern,
                searchPattern, searchPattern, searchPattern, searchPattern
            );
        }

        //query += ' ORDER BY Chinese DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [rows] = await pool.execute(query, params);
        res.json(rows);
    } catch (error) {
        console.error('获取条目失败:', error);
        res.status(500).json({ error: '获取条目失败', details: error.message });
    }
});

// 添加翻译条目
app.post('/api/entries', async (req, res) => {
    try {
        const entry = req.body;
        
        const [result] = await pool.execute(
            'INSERT INTO `translate-cn` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
        
        res.json({ success: true });
    } catch (error) {
        console.error('添加条目失败:', error);
        res.status(500).json({ error: '添加条目失败', details: error.message });
    }
});

// 更新翻译条目
app.put('/api/entries/:Chinese', async (req, res) => {
    try {
        const { Chinese } = req.params;
        const entry = req.body;
        
        const fields = [];
        const values = [];

        const columns = [
            'English', 'Japanese', 'Korean', 'Spanish', 'French',
            'German', 'Russian', 'Thai', 'Italian', 'Indonesian', 'Portuguese'
        ];

        for (const column of columns) {
            if (entry[column] !== undefined) {
                fields.push(`${column} = ?`);
                values.push(entry[column]);
            }
        }

        if (fields.length === 0) {
            return res.status(400).json({ error: '没有提供要更新的字段' });
        }

        values.push(Chinese);

        const [result] = await pool.execute(
            `UPDATE \`translate-cn\` SET ${fields.join(', ')} WHERE Chinese = ?`,
            values
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '找不到指定的条目' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('更新条目失败:', error);
        res.status(500).json({ error: '更新条目失败', details: error.message });
    }
});

// 删除翻译条目
app.delete('/api/entries/:Chinese', async (req, res) => {
    try {
        const { Chinese } = req.params;
        
        const [result] = await pool.execute(
            'DELETE FROM `translate-cn` WHERE Chinese = ?',
            [Chinese]
        );

        if (result.affectedRows === 0) {
            return res.status(404).json({ error: '找不到指定的条目' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('删除条目失败:', error);
        res.status(500).json({ error: '删除条目失败', details: error.message });
    }
});

// 使用POST请求删除条目（处理特殊字符更可靠）
app.post('/api/entries/delete', async (req, res) => {
    try {
        console.log('收到POST删除请求');
        console.log('请求体:', JSON.stringify(req.body));
        
        const { id } = req.body;
        
        if (!id) {
            console.log('未提供条目ID');
            return res.status(400).json({ error: '未提供条目ID' });
        }
        
        console.log(`尝试删除条目ID: "${id}"`);
        
        // 获取所有条目以进行精确匹配
        const [allRows] = await pool.execute('SELECT * FROM `translate-cn`');
        console.log(`数据库中共有 ${allRows.length} 条记录`);
        
        // 尝试找到匹配的条目
        let matchedRow = null;
        
        for (const row of allRows) {
            const dbId = row.Chinese;
            if (!dbId) continue;
            
            // 打印出数据库中的ID和请求中的ID的十六进制表示，以便比较
            const dbIdHex = Buffer.from(dbId).toString('hex');
            const requestIdHex = Buffer.from(id).toString('hex');
            
            console.log(`数据库ID: "${dbId}"`);
            console.log(`请求ID: "${id}"`);
            console.log(`数据库ID (HEX): ${dbIdHex}`);
            console.log(`请求ID (HEX): ${requestIdHex}`);
            
            // 规范化两个ID进行比较
            const normalizedDbId = dbId.replace(/[\r\n\s]+/g, ' ').trim();
            const normalizedRequestId = id.replace(/[\r\n\s]+/g, ' ').trim();
            
            console.log(`规范化后的数据库ID: "${normalizedDbId}"`);
            console.log(`规范化后的请求ID: "${normalizedRequestId}"`);
            
            // 检查是否匹配
            if (normalizedDbId === normalizedRequestId) {
                console.log('找到完全匹配');
                matchedRow = row;
                break;
            }
            
            // 检查是否部分匹配
            if (normalizedDbId.includes(normalizedRequestId) || normalizedRequestId.includes(normalizedDbId)) {
                console.log('找到部分匹配');
                matchedRow = row;
                break;
            }
            
            // 检查是否匹配前几个字符（对于可能被截断的ID）
            const minLength = Math.min(normalizedDbId.length, normalizedRequestId.length);
            if (minLength > 10 && normalizedDbId.substring(0, minLength) === normalizedRequestId.substring(0, minLength)) {
                console.log('找到前缀匹配');
                matchedRow = row;
                break;
            }
        }
        
        if (!matchedRow) {
            console.log('未找到匹配的条目');
            return res.status(404).json({ error: '找不到指定的条目' });
        }
        
        // 使用找到的条目的实际ID进行删除
        const actualId = matchedRow.Chinese;
        console.log(`使用实际ID删除: "${actualId}"`);
        
        // 执行删除操作
        const [result] = await pool.execute(
            'DELETE FROM `translate-cn` WHERE Chinese = ?',
            [actualId]
        );

        console.log('删除结果:', JSON.stringify(result));

        if (result.affectedRows === 0) {
            console.log(`未删除任何条目`);
            return res.status(404).json({ error: '找不到指定的条目' });
        }

        console.log('删除成功');
        res.json({ success: true });
    } catch (error) {
        console.error('删除条目失败:', error);
        res.status(500).json({ error: '删除条目失败', details: error.message });
    }
});

// 导入Excel文件
app.post('/api/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '没有上传文件' });
        }

        // 读取Excel文件
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 将Excel数据转换为JSON
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        // 处理数据（跳过前6行，第2行是表头）
        const headerRow = jsonData[1];
        const dataRows = jsonData.slice(6);
        
        // 映射表头
        const headerMapping = {
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
        
        // 创建列索引映射
        const columnIndexMap = {};
        headerRow.forEach((header, index) => {
            if (headerMapping[header]) {
                columnIndexMap[headerMapping[header]] = index;
            }
        });
        
        // 准备批量插入的数据
        const entries = [];
        for (const row of dataRows) {
            if (!row || row.length === 0) continue;
            
            const entry = {};
            for (const [dbColumn, excelIndex] of Object.entries(columnIndexMap)) {
                entry[dbColumn] = row[excelIndex] || '';
            }
            
            // 确保至少有一个非空字段
            const hasData = Object.values(entry).some(value => value && value.trim() !== '');
            if (hasData) {
                entries.push(entry);
            }
        }
        
        // 批量插入数据
        if (entries.length === 0) {
            return res.json({ message: '没有找到有效数据', count: 0 });
        }
        
        let insertedCount = 0;
        for (const entry of entries) {
            try {
                await pool.execute(
                    'INSERT INTO `translate-cn` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                insertedCount++;
            } catch (error) {
                console.error('插入条目失败:', error, entry);
            }
        }
        
        res.json({ success: true, count: insertedCount });
    } catch (error) {
        console.error('导入Excel失败:', error);
        res.status(500).json({ error: '导入Excel失败', details: error.message });
    }
});

// 导出数据为Excel
app.get('/api/export', async (req, res) => {
    try {
        // 获取所有条目
        const [rows] = await pool.execute('SELECT * FROM `translate-cn` ORDER BY Chinese DESC');
        
        // 创建工作簿
        const workbook = XLSX.utils.book_new();
        
        // 将数据转换为工作表
        const worksheet = XLSX.utils.json_to_sheet(rows);
        
        // 将工作表添加到工作簿
        XLSX.utils.book_append_sheet(workbook, worksheet, '翻译数据');
        
        // 将工作簿转换为buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=translation_data.xlsx');
        
        // 发送文件
        res.send(excelBuffer);
    } catch (error) {
        console.error('导出数据失败:', error);
        res.status(500).json({ error: '导出数据失败', details: error.message });
    }
});

// 添加一个新的端点来查看所有条目
app.get('/api/debug/entries', async (req, res) => {
    try {
        console.log('收到调试请求，获取所有条目');
        
        const [rows] = await pool.execute(
            'SELECT * FROM `translate-cn`'
        );
        
        console.log(`找到 ${rows.length} 条记录`);
        
        // 为每个条目添加一个特殊标记，以便更容易识别包含特殊字符的条目
        const enhancedRows = rows.map(row => {
            return {
                ...row,
                _chineseLength: row.Chinese ? row.Chinese.length : 0,
                _chineseHasNewline: row.Chinese ? row.Chinese.includes('\n') : false,
                _chineseHasCurlyBraces: row.Chinese ? row.Chinese.includes('{') || row.Chinese.includes('}') : false
            };
        });
        
        res.json(enhancedRows);
    } catch (error) {
        console.error('获取调试条目失败:', error);
        res.status(500).json({ error: '获取调试条目失败', details: error.message });
    }
});

// 添加一个新的端点来查看所有条目（更详细的版本）
app.get('/api/debug/entries/detail', async (req, res) => {
    try {
        console.log('收到详细调试请求，获取所有条目');
        
        const [rows] = await pool.execute(
            'SELECT * FROM `translate-cn`'
        );
        
        console.log(`找到 ${rows.length} 条记录`);
        
        // 为每个条目添加更详细的调试信息
        const enhancedRows = rows.map(row => {
            const chinese = row.Chinese || '';
            return {
                ...row,
                _chineseLength: chinese.length,
                _chineseHasNewline: chinese.includes('\n'),
                _chineseHasCarriageReturn: chinese.includes('\r'),
                _chineseHasCurlyBraces: chinese.includes('{') || chinese.includes('}'),
                _chineseCharCodes: Array.from(chinese).map(char => char.charCodeAt(0)),
                _chineseHexDump: Buffer.from(chinese).toString('hex')
            };
        });
        
        res.json(enhancedRows);
    } catch (error) {
        console.error('获取详细调试条目失败:', error);
        res.status(500).json({ error: '获取详细调试条目失败', details: error.message });
    }
});

// 启动服务器
initializeDatabase()
    .then(() => {
        app.listen(port, () => {
            console.log(`服务器已启动，端口: ${port}`);
        });
    })
    .catch(error => {
        console.error('服务器启动失败:', error);
    });
