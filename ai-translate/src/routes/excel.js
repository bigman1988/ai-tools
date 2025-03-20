const express = require('express');
const router = express.Router();
const multer = require('multer');
const excelService = require('../services/excel');

// 配置文件上传
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 限制文件大小为10MB
    }
});

// 全局变量，表示向量服务是否可用
let vectorServiceAvailable = false;

// 设置向量服务状态
function setVectorServiceStatus(status) {
    vectorServiceAvailable = status;
}

// 导入Excel文件
router.post('/import', upload.single('file'), async (req, res) => {
    console.log('收到导入请求');
    console.log('请求头:', JSON.stringify(req.headers, null, 2));
    
    if (!req.file) {
        return res.status(400).json({ error: '未接收到文件' });
    }
    
    console.log('文件信息:', {
        fieldname: req.file.fieldname,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size
    });
    
    try {
        // 使用Excel服务导入数据
        const result = await excelService.importExcel(req.file.buffer, vectorServiceAvailable);
        res.json(result);
    } catch (error) {
        console.error('导入Excel时出错:', error);
        res.status(500).json({ error: '导入失败', details: error.message });
    }
});

// 导出Excel文件
router.get('/export', async (req, res) => {
    try {
        // 使用Excel服务导出数据
        const excelBuffer = await excelService.exportExcel();
        
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

module.exports = {
    router,
    setVectorServiceStatus
};
