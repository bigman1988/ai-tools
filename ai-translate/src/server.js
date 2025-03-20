import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { initializeDatabase } from './config/database.js';
import { router as apiRouter, setVectorServiceStatus } from './routes/index.js';
import { embeddingService } from './services/embedding.js';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// 静态文件服务
// 确保可以访问到src目录下的所有静态资源
app.use(express.static(path.join(__dirname, '..')));
// 确保可以访问到dist目录下的打包后的JS文件
app.use(express.static(path.join(__dirname, '..', 'dist')));

// 添加调试中间件
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    if (req.method === 'POST' && req.headers['content-type'] && req.headers['content-type'].includes('multipart/form-data')) {
        console.log('检测到文件上传请求，Content-Type:', req.headers['content-type']);
    }
    next();
});

// 注册API路由
app.use('/api', apiRouter);

// 添加路由处理HTML页面请求
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.get('/knowledge-base', (req, res) => {
    res.sendFile(path.join(__dirname, 'knowledge-base.html'));
});

// 初始化向量存储
async function initializeVectorStorage() {
    try {
        const initResult = await embeddingService.initializeCollection();
        if (initResult) {
            console.log('向量存储初始化成功');
            setVectorServiceStatus(true);
            return true;
        } else {
            console.log('向量存储初始化失败，将使用传统搜索');
            setVectorServiceStatus(false);
            return false;
        }
    } catch (error) {
        console.error('向量存储初始化失败:', error);
        console.log('将使用传统搜索');
        setVectorServiceStatus(false);
        return false;
    }
}

// 启动服务器
async function startServer() {
    try {
        // 初始化数据库
        await initializeDatabase();
        //console.log('数据库初始化成功');
        
        // 初始化向量存储
        await initializeVectorStorage();
        
        // 启动服务器
        app.listen(port, () => {
            console.log(`服务器运行在 http://0.0.0.0:${port}`);
        });
    } catch (error) {
        console.error('服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();
