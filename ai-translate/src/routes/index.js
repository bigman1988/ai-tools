const express = require('express');
const router = express.Router();
const { router: entriesRouter, setVectorServiceStatus: setEntriesVectorStatus } = require('./entries');
const { router: excelRouter, setVectorServiceStatus: setExcelVectorStatus } = require('./excel');
const { router: vectorSearchRouter, setVectorServiceStatus: setVectorSearchStatus } = require('./vector-search');

// 设置向量服务状态
function setVectorServiceStatus(status) {
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

module.exports = {
    router,
    setVectorServiceStatus
};
