const mysql = require('mysql2/promise');
const dotenv = require('dotenv');

// 加载环境变量
dotenv.config();

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
        return true;
    } catch (error) {
        console.error('数据库初始化失败:', error);
        throw error;
    }
}

module.exports = {
    pool,
    initializeDatabase
};
