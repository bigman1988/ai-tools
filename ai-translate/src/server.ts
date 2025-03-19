import express, { Request, Response } from 'express';
import cors from 'cors';
import mysql from 'mysql2/promise';
import multer from 'multer';
import XLSX from 'xlsx';
import { TranslationEntry } from './services/database';
import { embeddingService } from './services/embedding';

// 声明multer的文件类型
interface MulterRequest extends Request {
    file?: Express.Multer.File;
}

// Excel数据行的类型定义
interface ExcelRow {
    [key: string]: string | number | undefined;
    '简体中文': string | undefined;
    '英语': string | undefined;
    '日语': string | undefined;
    '韩语': string | undefined;
    '西班牙语': string | undefined;
    '法语': string | undefined;
    '德语': string | undefined;
    '俄语': string | undefined;
    '泰语': string | undefined;
    '意大利语': string | undefined;
    '印尼语': string | undefined;
    '葡萄牙语': string | undefined;
}

const app = express();
const port = 3000;

// 配置multer
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 限制5MB
    }
});

// 数据库配置
const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || 'root',
    database: process.env.DB_NAME || 'translation_db'
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// API路由
app.get('/api/entries', async (req: Request, res: Response) => {
    try {
        const searchTerm = req.query.search as string | undefined;
        const connection = await pool.getConnection();

        let entries: TranslationEntry[];
        
        if (!searchTerm) {
            // 如果没有搜索词，返回所有条目
            const [rows] = await connection.query('SELECT * FROM `translate`');
            entries = rows as TranslationEntry[];
        } else {
            // 使用向量搜索
            const results = await embeddingService.searchSimilar(searchTerm);
            if (results && results.length > 0) {
                // 从结果中提取ID并查询数据库
                const ids = results.map(result => result.id).join(',');
                const [rows] = await connection.query(
                    'SELECT * FROM `translate` WHERE id IN (?)',
                    [ids]
                );
                entries = rows as TranslationEntry[];
            } else {
                entries = [];
            }
        }

        connection.release();
        res.json(entries);
    } catch (error) {
        console.error('获取条目时出错:', error);
        res.status(500).json({ error: '获取条目失败' });
    }
});

// 导入Excel文件
app.post('/api/import', upload.single('file'), async (req: MulterRequest, res: Response) => {
    if (!req.file) {
        return res.status(400).json({ error: '未上传文件' });
    }

    try {
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // 从第7行开始读取数据（跳过前6行）
        const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
        range.s.r = 6; // 从第7行开始
        worksheet['!ref'] = XLSX.utils.encode_range(range);
        
        // 获取数据
        const rows = XLSX.utils.sheet_to_json<ExcelRow>(worksheet);
        
        // 字段映射
        const fieldMapping: { [key: string]: keyof TranslationEntry } = {
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

        // 处理每一行数据
        const connection = await pool.getConnection();
        let importedCount = 0;

        for (const row of rows) {
            const entry: Partial<TranslationEntry> = {};
            
            // 映射字段
            for (const [excelField, dbField] of Object.entries(fieldMapping)) {
                const value = row[excelField as keyof ExcelRow];
                if (value !== undefined) {
                    entry[dbField] = String(value);
                }
            }

            // 验证必填字段
            if (!entry.Chinese) {
                continue; // 跳过没有中文的行
            }

            try {
                // 插入数据
                await connection.query(
                    'INSERT INTO `translate` SET ?',
                    entry
                );
                importedCount++;
            } catch (error) {
                console.error('插入数据时出错:', error);
                // 继续处理下一行
            }
        }

        connection.release();
        res.json({ success: true, count: importedCount });
    } catch (error) {
        console.error('导入Excel时出错:', error);
        res.status(500).json({ error: '导入失败' });
    }
});

// 启动服务器
app.listen(port, () => {
    console.log(`服务器运行在 http://localhost:${port}`);
});
