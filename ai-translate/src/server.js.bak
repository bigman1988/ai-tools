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
        // 创建translate表（如果不存在）
        await pool.execute(`
            CREATE TABLE IF NOT EXISTS \`translate\` (
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
                vector_id JSON,
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
        vectorServiceAvailable = initResult;
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
                            `SELECT * FROM \`translate\` WHERE Chinese IN (${placeholders})`,
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
        let query = 'SELECT * FROM `translate` WHERE 1=1';
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
            'SELECT Chinese FROM `translate` WHERE Chinese = ?',
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
                console.log(`存储翻译条目向量: ${entry.Chinese}`);
                // 使用新的方法存储完整的翻译条目向量
                const vectorResult = await embeddingService.storeEntryVectors(entry);
                
                if (vectorResult.success) {
                    vectorId = vectorResult.id;
                    console.log(`向量ID: ${vectorId}`);
                    entry.vector_id = vectorId;
                } else {
                    console.error(`创建向量失败: ${entry.Chinese}`);
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
                    entry.vector_id
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
                // 首先获取当前条目的完整数据
                const [currentEntry] = await pool.execute(
                    'SELECT * FROM `translate` WHERE Chinese = ?',
                    [Chinese]
                );
                
                if (currentEntry.length === 0) {
                    console.log(`未找到要更新的条目: ${Chinese}`);
                } else {
                    // 合并当前数据和更新数据
                    const fullEntry = { ...currentEntry[0], ...entry };
                    
                    // 获取当前的vector_id
                    let currentVectorId = null;
                    if (currentEntry[0].vector_id) {
                        currentVectorId = currentEntry[0].vector_id;
                    }
                    
                    console.log(`更新翻译条目向量: ${Chinese}, 当前ID: ${currentVectorId}`);
                    
                    // 使用新的方法更新完整的翻译条目向量
                    const vectorResult = await embeddingService.updateEntryVectors(currentVectorId, fullEntry);
                    
                    if (vectorResult.success) {
                        console.log(`向量ID: ${vectorResult.id}`);
                        // 添加vector_id字段更新
                        fields.push('vector_id = ?');
                        values.push(vectorResult.id);
                    } else {
                        console.error(`更新向量失败: ${Chinese}`);
                    }
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
            UPDATE \`translate\`
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
                // 从数据库获取向量ID
                const [vectorResult] = await pool.execute(
                    'SELECT vector_id FROM `translate` WHERE Chinese = ?',
                    [Chinese]
                );
                
                if (vectorResult.length > 0 && vectorResult[0].vector_id) {
                    // 直接使用向量ID删除
                    const vectorId = vectorResult[0].vector_id;
                    const deleteResult = await embeddingService.deleteEmbedding(vectorId);
                    console.log(`删除向量${deleteResult ? '成功' : '失败'}: ${vectorId}`);
                } else {
                    console.log('未找到向量ID，跳过向量删除');
                }
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
            'SELECT COUNT(*) as count FROM `translate` WHERE Chinese = ?',
            [encodedChinese]
        );
        
        if (checkResult[0].count === 0) {
            console.log('未找到要删除的条目:', encodedChinese);
            return res.status(404).json({ error: '未找到要删除的条目', value: encodedChinese });
        }

        // 执行删除操作
        const [result] = await pool.execute(
            'DELETE FROM `translate` WHERE Chinese = ?',
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
                // 从数据库获取向量ID
                const [vectorResult] = await pool.execute(
                    'SELECT vector_id FROM `translate` WHERE Chinese = ?',
                    [decodeURIComponent(Chinese)]
                );
                
                if (vectorResult.length > 0 && vectorResult[0].vector_id) {
                    try {
                        const vectorIds = JSON.parse(vectorResult[0].vector_id);
                        
                        // 删除中文向量
                        if (vectorIds.chinese) {
                            const chineseResult = await embeddingService.deleteEmbedding(vectorIds.chinese);
                            console.log(`删除中文向量${chineseResult ? '成功' : '失败'}: ${vectorIds.chinese}`);
                        }
                        
                        // 删除英文向量
                        if (vectorIds.english) {
                            const englishResult = await embeddingService.deleteEmbedding(vectorIds.english);
                            console.log(`删除英文向量${englishResult ? '成功' : '失败'}: ${vectorIds.english}`);
                        }
                    } catch (parseError) {
                        console.error('解析向量ID失败:', parseError);
                    }
                } else {
                    console.log('未找到向量ID，跳过向量删除');
                }
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
            'SELECT COUNT(*) as count FROM `translate` WHERE Chinese = ?',
            [decodedChinese]
        );
        
        if (checkResult[0].count === 0) {
            console.log('未找到要删除的条目:', decodedChinese);
            return res.status(404).json({ error: '未找到要删除的条目', value: decodedChinese });
        }

        // 执行删除操作
        const [result] = await pool.execute(
            'DELETE FROM `translate` WHERE Chinese = ?',
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

    //console.log(`接收到文件: ${req.file.originalname}, 大小: ${req.file.size} 字节, MIME类型: ${req.file.mimetype}`);
    //console.log('文件信息:', JSON.stringify(req.file, null, 2));

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
        
        // 修改：使用更可靠的方式读取Excel数据
        // 首先读取所有数据
        const allRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
        console.log(`Excel总行数: ${allRows.length}`);
        
        // 从第7行开始截取数据（索引从0开始，所以第7行是索引6）
        const dataRows = allRows.slice(6);
        console.log(`有效数据行数: ${dataRows.length}`);
        
        // 获取表头（第2行，索引1）
        const headers = allRows.length > 1 ? allRows[1] : [];
        console.log('表头:', headers);
        
        // 将数据行转换为对象数组
        const rows = dataRows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                if (header && row[index] !== undefined) {
                    obj[header] = row[index];
                }
            });
            return obj;
        }).filter(row => Object.keys(row).length > 0); // 过滤掉空行
        
        console.log(`解析到 ${rows.length} 行有效数据`);
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
        let updatedCount = 0;
        let skippedCount = 0;
        console.log('准备获取数据库连接');
        const connection = await pool.getConnection();
        console.log('成功获取数据库连接');

        try {
            await connection.beginTransaction();
            console.log('开始数据库事务');
            
            // 处理所有行数据
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
                    skippedCount++;
                    continue; // 跳过没有中文的行
                }
                
                try {
                    // 1. 检查MySQL中是否已存在该条目
                    const [existingEntries] = await connection.execute(
                        'SELECT * FROM `translate` WHERE Chinese = ?',
                        [entry.Chinese]
                    );
                    
                    const entryExists = existingEntries.length > 0;
                    const existingEntry = entryExists ? existingEntries[0] : null;
                    
                    // 2. 根据是否存在决定更新策略
                    if (entryExists) {
                        console.log(`条目已存在: ${entry.Chinese}，准备检查字段更新`);
                        
                        // 检查哪些字段需要更新
                        const fieldsToUpdate = [];
                        const updateValues = [];
                        
                        for (const field of Object.values(fieldMapping)) {
                            if (field === 'Chinese') continue; // 中文是主键，不更新
                            
                            // 如果Excel中有值，而数据库中没有值或值不同，则更新
                            if (entry[field] && (!existingEntry[field] || existingEntry[field] !== entry[field])) {
                                fieldsToUpdate.push(`${field} = ?`);
                                updateValues.push(entry[field]);
                            }
                        }
                        
                        // 如果有字段需要更新
                        if (fieldsToUpdate.length > 0) {
                            console.log(`需要更新 ${fieldsToUpdate.length} 个字段: ${entry.Chinese}`);
                            
                            // 先处理向量数据
                            if (vectorServiceAvailable) {
                                // 为中文和英文分别创建向量
                                let chineseVectorId = null;
                                let englishVectorId = null;
                                
                                if (entry.Chinese) {
                                    console.log(`更新中文向量: ${entry.Chinese}`);
                                    const chineseResult = await embeddingService.storeEmbedding(
                                        entry.Chinese,
                                        {
                                            Chinese: entry.Chinese,
                                            English: entry.English || '',
                                            type: 'chinese'
                                        }
                                    );
                                    
                                    if (!chineseResult.success) {
                                        console.error(`更新中文向量失败: ${entry.Chinese}`);
                                        continue;
                                    }
                                    
                                    chineseVectorId = chineseResult.id;
                                    console.log(`中文向量ID: ${chineseVectorId}`);
                                }
                                
                                if (entry.English) {
                                    console.log(`更新英文向量: ${entry.English}`);
                                    const englishResult = await embeddingService.storeEmbedding(
                                        entry.English,
                                        {
                                            Chinese: entry.Chinese,
                                            English: entry.English,
                                            type: 'english'
                                        }
                                    );
                                    
                                    if (!englishResult.success) {
                                        console.error(`更新英文向量失败: ${entry.English}`);
                                        continue;
                                    }
                                    
                                    englishVectorId = englishResult.id;
                                    console.log(`英文向量ID: ${englishVectorId}`);
                                }
                                
                                // 添加向量ID到更新字段
                                if (chineseVectorId || englishVectorId) {
                                    fieldsToUpdate.push(`vector_id = ?`);
                                    // 使用JSON存储两种向量ID
                                    const vectorIds = {
                                        chinese: chineseVectorId,
                                        english: englishVectorId
                                    };
                                    updateValues.push(JSON.stringify(vectorIds));
                                }
                            }
                            
                            // 更新MySQL数据库
                            updateValues.push(entry.Chinese); // 添加WHERE条件的值
                            await connection.execute(
                                `UPDATE \`translate\` SET ${fieldsToUpdate.join(', ')} WHERE Chinese = ?`,
                                updateValues
                            );
                            
                            console.log(`更新条目成功: ${entry.Chinese}`);
                            updatedCount++;
                        } else {
                            console.log(`条目无需更新: ${entry.Chinese}`);
                            skippedCount++;
                        }
                    } else {
                        console.log(`新条目: ${entry.Chinese}，准备插入`);
                        
                        // 处理向量数据
                        if (vectorServiceAvailable) {
                            // 为中文和英文分别创建向量
                            let chineseVectorId = null;
                            let englishVectorId = null;
                            
                            if (entry.Chinese) {
                                console.log(`创建中文向量: ${entry.Chinese}`);
                                const chineseResult = await embeddingService.storeEmbedding(
                                    entry.Chinese,
                                    {
                                        Chinese: entry.Chinese,
                                        English: entry.English || '',
                                        type: 'chinese'
                                    }
                                );
                                
                                if (!chineseResult.success) {
                                    console.error(`创建中文向量失败: ${entry.Chinese}`);
                                    continue;
                                }
                                
                                chineseVectorId = chineseResult.id;
                                console.log(`中文向量ID: ${chineseVectorId}`);
                            }
                            
                            if (entry.English) {
                                console.log(`创建英文向量: ${entry.English}`);
                                const englishResult = await embeddingService.storeEmbedding(
                                    entry.English,
                                    {
                                        Chinese: entry.Chinese,
                                        English: entry.English,
                                        type: 'english'
                                    }
                                );
                                
                                if (!englishResult.success) {
                                    console.error(`创建英文向量失败: ${entry.English}`);
                                    continue;
                                }
                                
                                englishVectorId = englishResult.id;
                                console.log(`英文向量ID: ${englishVectorId}`);
                            }
                            
                            // 添加向量ID到插入字段
                            if (chineseVectorId || englishVectorId) {
                                // 使用JSON存储两种向量ID
                                const vectorIds = {
                                    chinese: chineseVectorId,
                                    english: englishVectorId
                                };
                                entry.vector_id = JSON.stringify(vectorIds);
                            }
                        }
                        
                        // 插入MySQL数据库
                        await connection.execute(
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
                                entry.vector_id
                            ]
                        );
                        
                        console.log(`插入条目成功: ${entry.Chinese}`);
                        importedCount++;
                    }
                } catch (error) {
                    console.error(`处理条目失败 (${entry.Chinese}):`, error);
                    // 继续处理下一条，不中断整个导入过程
                    skippedCount++;
                }
            }
            
            // 提交事务
            console.log('事务处理完成，开始提交');
            await connection.commit();
            console.log('事务提交成功');
            
            // 返回结果
            res.json({
                success: true,
                count: importedCount + updatedCount,
                details: {
                    imported: importedCount,
                    updated: updatedCount,
                    skipped: skippedCount
                }
            });
        } catch (error) {
            // 回滚事务
            console.log('事务处理失败，开始回滚');
            await connection.rollback();
            console.log('事务回滚成功');
            
            throw error; // 重新抛出错误以便外层捕获
        } finally {
            // 释放连接
            connection.release();
            console.log('数据库连接已释放');
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
        const [rows] = await pool.execute('SELECT * FROM `translate`');
        
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

// 增强的向量搜索API，支持按语言类型搜索
app.get('/api/vector-search/advanced', async (req, res) => {
    try {
        const { text, type = 'chinese', limit = 5 } = req.query;
        
        if (!text) {
            return res.status(400).json({ error: '请提供搜索文本' });
        }
        
        if (!['chinese', 'english'].includes(type)) {
            return res.status(400).json({ error: '类型参数无效，必须是 chinese 或 english' });
        }
        
        if (!vectorServiceAvailable) {
            return res.status(503).json({ 
                error: '向量搜索服务不可用',
                message: '请确保Qdrant服务已启动且配置正确'
            });
        }
        
        console.log(`执行高级向量搜索，文本: "${text}", 类型: ${type}, 限制: ${limit}`);
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
            const [entries] = await pool.execute(
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
            
            res.json(enrichedResults);
        } else {
            res.json([]);
        }
    } catch (error) {
        console.error('高级向量搜索失败:', error);
        res.status(500).json({ error: '高级向量搜索失败', message: error.message });
    }
});

// 启动服务器
(async () => {
    try {
        await initializeDatabase();
        app.listen(port, () => {
            console.log(`服务器运行在 http://0.0.0.0:${port}`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
    }
})();
