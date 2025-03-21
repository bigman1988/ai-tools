import express from 'express';
import { embeddingService } from '../services/embedding-instance.js';

const router = express.Router();

// 全局变量，表示向量服务是否可用
let vectorServiceAvailable = false;

// 设置向量服务状态
export function setVectorServiceStatus(status) {
    vectorServiceAvailable = status;
}

// 基本向量搜索
router.get('/', async (req, res) => {
    try {
        if (!vectorServiceAvailable) {
            return res.status(503).json({ error: '向量搜索服务不可用' });
        }
        
        const { query, limit = 3 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: '搜索查询不能为空' });
        }
        
        // 默认使用中文搜索
        const results = await embeddingService.searchSimilar(query, 'chinese', parseInt(limit));
        res.json(results);
    } catch (error) {
        console.error('向量搜索失败:', error);
        res.status(500).json({ error: '向量搜索失败', details: error.message });
    }
});

// 高级向量搜索（支持语言类型）
router.get('/advanced', async (req, res) => {
    try {
        if (!vectorServiceAvailable) {
            return res.status(503).json({ error: '向量搜索服务不可用' });
        }
        
        const { query, type = 'chinese', limit = 3 } = req.query;
        
        if (!query) {
            return res.status(400).json({ error: '搜索查询不能为空' });
        }
        
        // 验证语言类型
        const validTypes = ['chinese', 'english'];
        if (!validTypes.includes(type.toLowerCase())) {
            return res.status(400).json({ 
                error: '不支持的语言类型', 
                details: `支持的类型: ${validTypes.join(', ')}` 
            });
        }
        
        // 执行向量搜索
        const results = await embeddingService.searchSimilar(
            query, 
            type.toLowerCase(), 
            parseInt(limit)
        );
        
        res.json(results);
    } catch (error) {
        console.error('高级向量搜索失败:', error);
        res.status(500).json({ error: '向量搜索失败', details: error.message });
    }
});

export { router };
