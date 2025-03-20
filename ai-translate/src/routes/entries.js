const express = require('express');
const router = express.Router();
const knowledgeBaseService = require('../services/knowledge-base');

// 全局变量，表示向量服务是否可用
let vectorServiceAvailable = false;

// 设置向量服务状态
function setVectorServiceStatus(status) {
    vectorServiceAvailable = status;
    knowledgeBaseService.setVectorServiceStatus(status);
}

// 获取翻译条目列表
router.get('/', async (req, res) => {
    try {
        const { search, limit, offset } = req.query;
        
        // 使用知识库服务搜索条目
        const entries = await knowledgeBaseService.searchEntries({ search, limit, offset });
        res.json(entries);
    } catch (error) {
        console.error('获取条目失败:', error);
        res.status(500).json({ error: '获取条目失败', details: error.message });
    }
});

// 添加翻译条目
router.post('/', async (req, res) => {
    try {
        const entry = req.body;
        
        // 检查必要字段
        if (!entry.Chinese || entry.Chinese.trim() === '') {
            return res.status(400).json({ 
                error: '添加条目失败', 
                details: '中文字段不能为空' 
            });
        }
        
        // 使用知识库服务添加条目
        try {
            await knowledgeBaseService.addEntry(entry);
            console.log('添加条目成功:', entry.Chinese);
            res.json({ success: true });
        } catch (dbError) {
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
            } else {
                errorDetails = dbError.message;
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
router.put('/:Chinese', async (req, res) => {
    try {
        const { Chinese } = req.params;
        const entry = req.body;
        
        // 使用知识库服务更新条目
        try {
            await knowledgeBaseService.updateEntry(Chinese, entry);
            res.json({ success: true });
        } catch (error) {
            res.status(error.message === '未找到要更新的条目' ? 404 : 500).json({ 
                error: '更新条目失败', 
                details: error.message 
            });
        }
    } catch (error) {
        console.error('更新条目失败:', error);
        res.status(500).json({ error: '更新条目失败', details: error.message });
    }
});

// 删除翻译条目 (POST方式)
router.post('/delete', async (req, res) => {
    try {
        const { Chinese } = req.body;
        
        if (!Chinese) {
            return res.status(400).json({ error: '未提供要删除的条目' });
        }
        
        console.log('尝试删除条目 (POST方式):', Chinese);
        
        // 使用知识库服务删除条目
        try {
            await knowledgeBaseService.deleteEntry(Chinese);
            res.json({ success: true });
        } catch (error) {
            res.status(error.message === '未找到要删除的条目' ? 404 : 500).json({ 
                error: '删除条目失败', 
                details: error.message 
            });
        }
    } catch (error) {
        console.error('删除条目失败:', error);
        res.status(500).json({ error: '删除条目失败', details: error.message });
    }
});

// 删除翻译条目 (DELETE方式)
router.delete('/:Chinese', async (req, res) => {
    try {
        const { Chinese } = req.params;
        
        if (!Chinese) {
            return res.status(400).json({ error: '未提供要删除的条目' });
        }
        
        // 安全解码URL参数，处理特殊字符
        let decodedChinese;
        try {
            decodedChinese = decodeURIComponent(Chinese);
        } catch (decodeError) {
            // 如果解码失败，直接使用原始值
            console.warn(`URL解码失败，使用原始值: ${Chinese}`, decodeError);
            decodedChinese = Chinese;
        }
        
        console.log(`尝试删除条目 (DELETE方式): "${decodedChinese}"`);
        
        // 使用知识库服务删除条目
        try {
            const result = await knowledgeBaseService.deleteEntry(decodedChinese);
            res.json({ success: true, ...result });
        } catch (error) {
            console.error(`删除失败: "${decodedChinese}"`, error);
            res.status(error.message === '未找到要删除的条目' ? 404 : 500).json({ 
                error: '删除条目失败', 
                details: error.message 
            });
        }
    } catch (error) {
        console.error('删除条目失败:', error);
        res.status(500).json({ error: '删除条目失败', details: error.message });
    }
});

module.exports = {
    router,
    setVectorServiceStatus
};
