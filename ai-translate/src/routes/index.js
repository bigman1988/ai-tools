import express from 'express';
import { router as entriesRouter, setVectorServiceStatus as setEntriesVectorStatus } from './entries.js';
import { router as excelRouter, setVectorServiceStatus as setExcelVectorStatus } from './excel.js';
import { router as vectorSearchRouter, setVectorServiceStatus as setVectorSearchStatus } from './vector-search.js';

const router = express.Router();

// 设置向量服务状态
export function setVectorServiceStatus(status) {
    setEntriesVectorStatus(status);
    setExcelVectorStatus(status);
    setVectorSearchStatus(status);
}

// 服务器状态检查
router.get('/status', (req, res) => {
    res.json({ status: 'online' });
});

// 注册路由
router.use('/entries', entriesRouter);
router.use('/', excelRouter);
router.use('/vector-search', vectorSearchRouter);

export { router };
