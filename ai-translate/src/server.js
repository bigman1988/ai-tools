const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const multer = require('multer');
const XLSX = require('xlsx');
const dotenv = require('dotenv');
const bodyParser = require('body-parser');
const path = require('path');
const { embeddingService } = require('./services/embedding');

// 加载环境变量
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// 配置中间件
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
}));
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname)));

// 配置文件上传
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 限制文件大小为10MB
    }
});

// 添加调试中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST' && req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        console.log('检测到文件上传请求，Content-Type:', req.headers['content-type']);
    }
    next();
});

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
                vector_id VARCHAR(255),
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

// 初始化向量存储
let vectorServiceAvailable = false;
(async () => {
    try {
        const initResult = await embeddingService.initializeCollection();
        vectorServiceAvailable = false;//initResult;
        if (initResult) {
            console.log('向量存储初始化成功');
        } else {
            console.log('向量存储初始化失败，将使用传统搜索');
        }
    } catch (error) {
        console.error('向量存储初始化失败:', error);
        console.log('将使用传统搜索');
    }
})();

// API路由

// 检查服务器状态
app.get('/api/status', (req, res) => {
    res.json({ status: 'ok', message: '服务器正常运行' });
});

// 获取翻译条目
app.get('/api/entries', async (req, res) => {
    try {
        const { search, limit = 100, offset = 0 } = req.query;
        
        if (search) {
            // 使用向量搜索（如果可用）
            if (vectorServiceAvailable) {
                try {
                    const results = await embeddingService.searchSimilar(search, parseInt(limit));
                    
                    // 从结果中提取中文关键字
                    const chineseKeys = results.map(item => item.metadata?.text || '').filter(Boolean);
                    
                    if (chineseKeys.length > 0) {
                        // 构建 IN 查询
                        const placeholders = chineseKeys.map(() => '?').join(',');
                        const [rows] = await pool.execute(
                            `SELECT * FROM \`translate-cn\` WHERE Chinese IN (${placeholders})`,
                            chineseKeys
                        );
                        
                        // 按照向量搜索结果的顺序排序
                        const orderedRows = [];
                        for (const key of chineseKeys) {
                            const match = rows.find(row => row.Chinese === key);
                            if (match) orderedRows.push(match);
                        }
                        
                        return res.json(orderedRows);
                    }
                    
                    return res.json([]);
                } catch (vectorError) {
                    console.error('向量搜索失败，回退到普通搜索:', vectorError);
                    // 如果向量搜索失败，回退到普通搜索
                }
            } else {
                console.log('向量服务不可用，使用传统搜索');
            }
        }
        
        // 普通数据库查询
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
        
        //query += ' LIMIT ? OFFSET ?';
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
        
        // 检查必要字段
        if (!entry.Chinese || entry.Chinese.trim() === '') {
            return res.status(400).json({ 
                error: '添加条目失败', 
                details: '中文字段不能为空' 
            });
        }
        
        // 检查是否已存在相同的中文条目
        const [existingEntries] = await pool.execute(
            'SELECT Chinese FROM `translate-cn` WHERE Chinese = ?',
            [entry.Chinese]
        );
        
        if (existingEntries.length > 0) {
            return res.status(409).json({ 
                error: '添加条目失败', 
                details: `条目已存在: "${entry.Chinese}"` 
            });
        }
        
        // 生成向量并存储到向量数据库
        let vectorId = null;
        if (vectorServiceAvailable) {
            try {
                // 获取文本的向量嵌入
                const vector = await embeddingService.generateEmbedding(entry.Chinese);
                
                // 存储向量到Qdrant
                const success = await embeddingService.storeEmbedding(
                    entry.Chinese,
                    entry.Chinese,
                    { 
                        Chinese: entry.Chinese,
                        English: entry.English || '' 
                    }
                );
                
                if (success) {
                    vectorId = entry.Chinese;
                }
            } catch (vectorError) {
                console.error('向量处理失败:', vectorError);
                // 继续执行，即使向量处理失败
            }
        } else {
            console.log('向量服务不可用，跳过向量处理');
        }
        
        // 插入新条目
        try {
            const [result] = await pool.execute(
                'INSERT INTO `translate-cn` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                    vectorId
                ]
            );
            
            console.log('添加条目成功:', entry.Chinese);
            res.json({ success: true });
        } catch (dbError) {
            console.error('数据库操作失败:', dbError);
            // 提供更详细的数据库错误信息
            let errorDetails = '数据库操作失败';
            if (dbError.code) {
                switch (dbError.code) {
                    case 'ER_DUP_ENTRY':
                        errorDetails = `条目已存在: "${entry.Chinese}"`;
                        break;
                    case 'ER_DATA_TOO_LONG':
                        errorDetails = '数据过长，超出字段限制';
                        break;
                    default:
                        errorDetails = `${dbError.code}: ${dbError.message}`;
                }
            }
            
            res.status(500).json({ 
                error: '添加条目失败', 
                details: errorDetails 
            });
        }
    } catch (error) {
        console.error('添加条目失败:', error);
        res.status(500).json({ 
            error: '添加条目失败', 
            details: error.message || '未知错误' 
        });
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
        
        // 更新向量存储
        if (vectorServiceAvailable) {
            try {
                // 更新向量
                const success = await embeddingService.storeEmbedding(
                    Chinese,
                    Chinese,
                    {
                        Chinese: Chinese,
                        English: entry.English || ''
                    }
                );
                
                // 添加vector_id字段更新
                if (success) {
                    fields.push('vector_id = ?');
                    values.push(Chinese);
                }
            } catch (vectorError) {
                console.error('向量更新失败:', vectorError);
                // 继续执行，即使向量处理失败
            }
        } else {
            console.log('向量服务不可用，跳过向量更新');
        }

        values.push(Chinese); // 添加WHERE条件的值

        const query = `
            UPDATE \`translate-cn\`
            SET ${fields.join(', ')}
            WHERE Chinese = ?
        `;

        const [result] = await pool.execute(query, values);

        if (result.affectedRows === 0) {
            res.status(404).json({ error: '未找到要更新的条目' });
        } else {
            res.json({ success: true });
        }
    } catch (error) {
        console.error('更新条目失败:', error);
        res.status(500).json({ error: '更新条目失败', details: error.message });
    }
});

// 删除翻译条目 (POST方式)
app.post('/api/entries/delete', async (req, res) => {
    try {
        const { Chinese } = req.body;
        
        if (!Chinese) {
            return res.status(400).json({ error: '未提供要删除的条目' });
        }
        
        console.log('尝试删除条目 (POST方式):', Chinese);
        
        // 删除向量存储中的向量
        if (vectorServiceAvailable) {
            try {
                await embeddingService.deleteEmbedding(Chinese);
            } catch (vectorError) {
                console.error('删除向量失败:', vectorError);
                // 继续执行，即使向量删除失败
            }
        } else {
            console.log('向量服务不可用，跳过向量删除');
        }

        // 从数据库中删除条目
        const encodedChinese = Chinese; // 使用原始值，不进行额外编码
        
        console.log('执行SQL删除，条目值:', encodedChinese);
        
        // 先检查条目是否存在
        const [checkResult] = await pool.execute(
            'SELECT COUNT(*) as count FROM `translate-cn` WHERE Chinese = ?',
            [encodedChinese]
        );
        
        if (checkResult[0].count === 0) {
            console.log('未找到要删除的条目:', encodedChinese);
            return res.status(404).json({ error: '未找到要删除的条目', value: encodedChinese });
        }

        // 执行删除操作
        const [result] = await pool.execute(
            'DELETE FROM `translate-cn` WHERE Chinese = ?',
            [encodedChinese]
        );

        if (result.affectedRows === 0) {
            console.log('删除失败，未找到条目:', encodedChinese);
            res.status(404).json({ error: '未找到要删除的条目' });
        } else {
            console.log('删除条目成功:', encodedChinese, '影响行数:', result.affectedRows);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('删除条目失败:', error);
        res.status(500).json({ error: '删除条目失败', details: error.message });
    }
});

// 删除翻译条目 (DELETE方式)
app.delete('/api/entries/:Chinese', async (req, res) => {
    try {
        const { Chinese } = req.params;
        
        if (!Chinese) {
            return res.status(400).json({ error: '未提供要删除的条目' });
        }
        
        console.log('尝试删除条目 (DELETE方式):', Chinese);
        
        // 删除向量存储中的向量
        if (vectorServiceAvailable) {
            try {
                await embeddingService.deleteEmbedding(Chinese);
            } catch (vectorError) {
                console.error('删除向量失败:', vectorError);
                // 继续执行，即使向量删除失败
            }
        } else {
            console.log('向量服务不可用，跳过向量删除');
        }

        // 从数据库中删除条目
        const decodedChinese = decodeURIComponent(Chinese); // URL解码
        
        console.log('执行SQL删除，解码后条目值:', decodedChinese);
        
        // 先检查条目是否存在
        const [checkResult] = await pool.execute(
            'SELECT COUNT(*) as count FROM `translate-cn` WHERE Chinese = ?',
            [decodedChinese]
        );
        
        if (checkResult[0].count === 0) {
            console.log('未找到要删除的条目:', decodedChinese);
            return res.status(404).json({ error: '未找到要删除的条目', value: decodedChinese });
        }

        // 执行删除操作
        const [result] = await pool.execute(
            'DELETE FROM `translate-cn` WHERE Chinese = ?',
            [decodedChinese]
        );

        if (result.affectedRows === 0) {
            console.log('删除失败，未找到条目:', decodedChinese);
            res.status(404).json({ error: '未找到要删除的条目' });
        } else {
            console.log('删除条目成功:', decodedChinese, '影响行数:', result.affectedRows);
            res.json({ success: true });
        }
    } catch (error) {
        console.error('删除条目失败:', error);
        res.status(500).json({ error: '删除条目失败', details: error.message });
    }
});

// 导入Excel文件
app.post('/api/import', upload.single('file'), async (req, res) => {
    console.log('收到导入请求');
    console.log('请求头:', JSON.stringify(req.headers, null, 2));
    
    if (!req.file) {
        console.error('没有上传文件');
        return res.status(400).json({ error: '没有上传文件' });
    }

    console.log(`接收到文件: ${req.file.originalname}, 大小: ${req.file.size} 字节, MIME类型: ${req.file.mimetype}`);
    console.log('文件信息:', JSON.stringify(req.file, null, 2));

    try {
        console.log('开始解析Excel文件');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        console.log('Excel工作簿信息:', {
            SheetNames: workbook.SheetNames,
            SheetCount: workbook.SheetNames.length
        });
        
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 从第7行开始读取数据（跳过前6行）
        const originalRange = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        console.log('原始数据范围:', originalRange);
        
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        range.s.r = 6; // 从第7行开始
        worksheet['!ref'] = XLSX.utils.encode_range(range);
        console.log('调整后数据范围:', range);
        
        // 获取数据
        const rows = XLSX.utils.sheet_to_json(worksheet);
        console.log(`解析到 ${rows.length} 行数据`);
        if (rows.length > 0) {
            console.log('第一行数据示例:', JSON.stringify(rows[0], null, 2));
        }
        
        // 字段映射
        const fieldMapping = {
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

        let importedCount = 0;
        console.log('准备获取数据库连接');
        const connection = await pool.getConnection();
        console.log('成功获取数据库连接');
        
        // 准备批量向量处理
        const vectorBatch = [];

        try {
            await connection.beginTransaction();
            console.log('开始数据库事务');
            
            // 准备向量处理
            if (vectorServiceAvailable) {
                console.log('向量服务可用，开始批量处理');
                try {
                    // 使用批量处理而不是单个处理，提高性能
                    const batchSize = 10; // 每批处理的数量
                    const batches = [];
                    
                    // 将条目分组为批次
                    for (let i = 0; i < rows.length; i += batchSize) {
                        batches.push(rows.slice(i, i + batchSize));
                    }
                    console.log(`将数据分为 ${batches.length} 个批次进行处理`);
                    
                    // 逐批处理
                    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                        const batch = batches[batchIndex];
                        console.log(`处理批次 ${batchIndex + 1}/${batches.length}, 包含 ${batch.length} 条数据`);
                        
                        const promises = batch.map(async (row) => {
                            const entry = {};
                            
                            // 映射字段
                            for (const [excelField, dbField] of Object.entries(fieldMapping)) {
                                if (row[excelField] !== undefined) {
                                    entry[dbField] = String(row[excelField]).trim();
                                }
                            }
                            
                            // 验证必填字段
                            if (!entry.Chinese) {
                                console.log('跳过没有中文的行');
                                return null; // 跳过没有中文的行
                            }
                            
                            try {
                                // 存储向量嵌入
                                console.log(`开始处理向量嵌入: ${entry.Chinese}`);
                                await embeddingService.storeEmbedding(
                                    entry.Chinese,
                                    entry.Chinese,
                                    {
                                        Chinese: entry.Chinese,
                                        English: entry.English || ''
                                    }
                                );
                                console.log(`向量嵌入处理成功: ${entry.Chinese}`);
                                
                                // 插入数据库
                                console.log(`开始插入数据库: ${entry.Chinese}`);
                                await connection.execute(
                                    'INSERT INTO `translate-cn` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                                        entry.Chinese // 使用中文作为vector_id
                                    ]
                                );
                                console.log(`数据库插入成功: ${entry.Chinese}`);
                                importedCount++;
                                return entry;
                            } catch (error) {
                                console.error(`处理条目失败 (${entry.Chinese}):`, error);
                                return null; // 跳过错误的条目
                            }
                        });
                        
                        // 等待批次完成
                        console.log(`等待批次 ${batchIndex + 1} 完成处理`);
                        const results = await Promise.all(promises.filter(p => p !== null));
                        console.log(`批次 ${batchIndex + 1} 完成处理，成功处理 ${results.length} 条数据`);
                    }
                } catch (vectorError) {
                    console.error('向量批量处理失败:', vectorError);
                    // 回滚事务
                    console.log('由于向量处理失败，开始回滚事务');
                    await connection.rollback();
                    connection.release();
                    throw new Error(`向量处理失败: ${vectorError.message}`);
                }
            } else {
                console.log('向量服务不可用，仅处理数据库插入');
                // 如果向量服务不可用，只处理数据库插入
                for (const row of rows) {
                    const entry = {};
                    
                    // 映射字段
                    for (const [excelField, dbField] of Object.entries(fieldMapping)) {
                        if (row[excelField] !== undefined) {
                            entry[dbField] = String(row[excelField]).trim();
                        }
                    }
                    
                    // 验证必填字段
                    if (!entry.Chinese) {
                        console.log('跳过没有中文的行');
                        continue; // 跳过没有中文的行
                    }
                    
                    try {
                        // 插入数据
                        console.log(`开始插入数据库: ${entry.Chinese}`);
                        await connection.execute(
                            'INSERT INTO `translate-cn` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
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
                                entry.Chinese // 使用中文作为vector_id
                            ]
                        );
                        console.log(`数据库插入成功: ${entry.Chinese}`);
                        importedCount++;
                    } catch (error) {
                        console.error('插入数据时出错:', error);
                        // 继续处理下一行
                    }
                }
            }
            
            // 提交事务
            console.log('事务处理完成，开始提交');
            await connection.commit();
            console.log('事务提交成功');
            connection.release();
            res.json({ success: true, count: importedCount });
        } catch (error) {
            // 回滚事务
            console.log('事务处理失败，开始回滚');
            await connection.rollback();
            console.log('事务回滚成功');
            connection.release();
            throw error;
        }
    } catch (error) {
        console.error('导入Excel时出错:', error);
        res.status(500).json({ error: '导入失败', details: error.message });
    }
});

// 导出Excel文件
app.get('/api/export', async (req, res) => {
    try {
        // 获取所有条目
        const [rows] = await pool.execute('SELECT * FROM `translate-cn`');
        
        // 创建工作簿
        const workbook = XLSX.utils.book_new();
        
        // 字段映射（与导入相反）
        const fieldMapping = {
            Chinese: '简体中文',
            English: '英语',
            Japanese: '日语',
            Korean: '韩语',
            Spanish: '西班牙语',
            French: '法语',
            German: '德语',
            Russian: '俄语',
            Thai: '泰语',
            Italian: '意大利语',
            Indonesian: '印尼语',
            Portuguese: '葡萄牙语'
        };
        
        // 转换数据
        const data = rows.map(row => {
            const newRow = {};
            for (const [dbField, excelField] of Object.entries(fieldMapping)) {
                newRow[excelField] = row[dbField] || '';
            }
            return newRow;
        });
        
        // 创建工作表
        const worksheet = XLSX.utils.json_to_sheet(data);
        
        // 添加工作表到工作簿
        XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
        
        // 生成Excel文件的buffer
        const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        // 设置响应头
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=translation_data.xlsx');
        
        // 发送文件
        res.send(excelBuffer);
    } catch (error) {
        console.error('导出Excel时出错:', error);
        res.status(500).json({ error: '导出失败', details: error.message });
    }
});

// 向量搜索API
app.get('/api/vector-search', async (req, res) => {
    try {
        const { text, limit = 5 } = req.query;
        
        if (!text) {
            return res.status(400).json({ error: '请提供搜索文本' });
        }
        
        if (!vectorServiceAvailable) {
            return res.status(503).json({ 
                error: '向量搜索服务不可用',
                message: '请确保Qdrant服务已启动且配置正确'
            });
        }
        
        const results = await embeddingService.searchSimilar(text, limit);
        res.json(results);
    } catch (error) {
        console.error('向量搜索失败:', error);
        res.status(500).json({ error: '向量搜索失败', message: error.message });
    }
});

// 启动服务器
(async () => {
    try {
        await initializeDatabase();
        app.listen(port, () => {
            console.log(`服务器运行在 http://localhost:${port}`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
    }
})();
