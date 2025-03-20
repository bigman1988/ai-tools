const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

module.exports = {
    port: process.env.PORT || 3000,
    cors: {
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    },
    upload: {
        limits: {
            fileSize: 10 * 1024 * 1024 // 限制文件大小为10MB
        }
    },
    excel: {
        skipRows: 6, // 跳过前6行
        headerRow: 1, // 第2行为表头（索引从0开始）
        fieldMapping: {
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
        }
    },
    // 数据库配置
    DB_HOST: process.env.DB_HOST || 'localhost',
    DB_PORT: process.env.DB_PORT || 3306,
    DB_USER: process.env.DB_USER || 'root',
    DB_PASSWORD: process.env.DB_PASSWORD || '',
    DB_NAME: process.env.DB_NAME || 'translate-knowledge',
    
    // 向量数据库配置
    QDRANT_URL: process.env.QDRANT_URL || 'http://localhost:6333',
    OLLAMA_URL: process.env.OLLAMA_URL || 'http://localhost:11434'
};
