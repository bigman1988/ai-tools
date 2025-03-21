// 测试嵌入向量生成功能
import { OllamaEmbeddingService } from './src/services/embedding.js';

// 计算两个向量之间的余弦相似度
function calculateCosineSimilarity(vec1, vec2) {
    if (!Array.isArray(vec1) || !Array.isArray(vec2) || vec1.length !== vec2.length) {
        throw new Error('输入必须是相同长度的数组');
    }
    
    // 计算点积
    let dotProduct = 0;
    for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
    }
    
    // 计算向量模长
    let vec1Magnitude = 0;
    let vec2Magnitude = 0;
    for (let i = 0; i < vec1.length; i++) {
        vec1Magnitude += vec1[i] * vec1[i];
        vec2Magnitude += vec2[i] * vec2[i];
    }
    vec1Magnitude = Math.sqrt(vec1Magnitude);
    vec2Magnitude = Math.sqrt(vec2Magnitude);
    
    // 计算余弦相似度
    if (vec1Magnitude === 0 || vec2Magnitude === 0) {
        return 0; // 避免除以零
    }
    
    return dotProduct / (vec1Magnitude * vec2Magnitude);
}

// 单独测试相似度计算功能
async function testSimilarityCalculation() {
    console.log('\n===== 测试向量相似度计算 =====');
    
    try {
        // 初始化嵌入服务
        const embeddingService = new OllamaEmbeddingService(
            process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
            'bge-m3:latest',
            process.env.QDRANT_URL || 'http://172.16.0.78:6333'
        );
        
        // 测试文本
        const text1 = 'Lady';
        const text2 = 'Decision';
        const text3 = 'Vanish'; //
        
        console.log('生成文本1的向量嵌入...');
        const embedding1 = await embeddingService.generateEmbedding(text1);
        
        console.log('生成文本2的向量嵌入...');
        const embedding2 = await embeddingService.generateEmbedding(text2);
        
        console.log('生成文本3的向量嵌入...');
        const embedding3 = await embeddingService.generateEmbedding(text3);
        
        // 计算相似度
        console.log('\n计算相似度结果:');
        
        // 中英文相似度（应该较低）
        const similarity12 = calculateCosineSimilarity(embedding1.embedding, embedding2.embedding);
        console.log(` ${text1} - ${text2}相似度: ${similarity12.toFixed(6)}`);
        
        // 相似中文相似度（应该较高）
        const similarity13 = calculateCosineSimilarity(embedding1.embedding, embedding3.embedding);
        console.log(` ${text1} - ${text3}相似度: ${similarity13.toFixed(6)}`);
        

        // 相似中文相似度（应该最高）
        const similarity11 = calculateCosineSimilarity(embedding1.embedding, embedding1.embedding);
        console.log(` ${text1} - ${text1}相似度: ${similarity11.toFixed(6)}`);
        // // 使用服务中的方法计算
        // const serviceSimilarity12 = embeddingService.calculateCosineSimilarity(
        //     embedding1.embedding, 
        //     embedding2.embedding
        // );
        // console.log(`中英文相似度 (服务方法): ${serviceSimilarity12.toFixed(6)}`);
        
        // const serviceSimilarity13 = embeddingService.calculateCosineSimilarity(
        //     embedding1.embedding, 
        //     embedding3.embedding
        // );
        // console.log(`相似中文相似度 (服务方法): ${serviceSimilarity13.toFixed(6)}`);
        
        // // 比较两种实现的结果
        // console.log('\n比较两种实现的结果:');
        // console.log(`中英文相似度差异: ${Math.abs(similarity12 - serviceSimilarity12).toFixed(10)}`);
        // console.log(`相似中文相似度差异: ${Math.abs(similarity13 - serviceSimilarity13).toFixed(10)}`);
        
        // // 创建一些测试向量进行验证
        // console.log('\n使用简单向量验证相似度计算:');
        
        // // 完全相同的向量（相似度应为1）
        // const vecA = [1, 2, 3];
        // const vecB = [1, 2, 3];
        // console.log(`相同向量相似度 (自定义函数): ${calculateCosineSimilarity(vecA, vecB).toFixed(6)}`);
        // console.log(`相同向量相似度 (服务方法): ${embeddingService.calculateCosineSimilarity(vecA, vecB).toFixed(6)}`);
        
        // // 正交向量（相似度应为0）
        // const vecC = [1, 0, 0];
        // const vecD = [0, 1, 0];
        // console.log(`正交向量相似度 (自定义函数): ${calculateCosineSimilarity(vecC, vecD).toFixed(6)}`);
        // console.log(`正交向量相似度 (服务方法): ${embeddingService.calculateCosineSimilarity(vecC, vecD).toFixed(6)}`);
        
        // // 方向相反的向量（相似度应为-1）
        // const vecE = [1, 2, 3];
        // const vecF = [-1, -2, -3];
        // console.log(`方向相反向量相似度 (自定义函数): ${calculateCosineSimilarity(vecE, vecF).toFixed(6)}`);
        // console.log(`方向相反向量相似度 (服务方法): ${embeddingService.calculateCosineSimilarity(vecE, vecF).toFixed(6)}`);
        
        return true;
    } catch (error) {
        console.error('相似度计算测试失败:', error);
        return false;
    }
}

// 主测试函数
async function testEmbeddingGeneration() {
    try {
        console.log('开始测试嵌入向量生成功能...');
        
        // 初始化嵌入服务，使用环境变量中的配置
        // const embeddingService = new OllamaEmbeddingService(
        //     process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
        //     'nomic-embed-text',
        //     process.env.QDRANT_URL || 'http://172.16.0.78:6333'
        // );
        
        // // 测试中文文本
        // const chineseText = '这是一个测试文本，用于验证向量嵌入生成功能。';
        // console.log(`测试中文文本: "${chineseText}"`);
        
        // let cnEmbedding;
        // try {
        //     cnEmbedding = await embeddingService.generateEmbedding(chineseText);
        //     console.log('中文嵌入向量生成成功:');
        //     console.log(`- 类型: ${typeof cnEmbedding}`);
        //     console.log(`- 是否包含embedding属性: ${cnEmbedding.hasOwnProperty('embedding')}`);
        //     console.log(`- embedding类型: ${typeof cnEmbedding.embedding}`);
        //     console.log(`- embedding长度: ${cnEmbedding.embedding.length}`);
        // } catch (cnError) {
        //     console.error('中文嵌入向量生成失败:', cnError);
        // }
        
        // // 测试条目存储
        // console.log('\n测试条目向量存储...');
        // const testEntry = {
        //     Chinese: '测试条目',
        //     English: 'Test entry'
        // };
        
        // try {
        //     const storeResult = await embeddingService.storeEntryVectors(testEntry);
        //     console.log('条目向量存储结果:', storeResult);
        // } catch (storeError) {
        //     console.error('条目向量存储失败:', storeError);
        // }
        
        // 运行相似度计算测试
        await testSimilarityCalculation();
        
        console.log('\n测试完成!');
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 执行测试
testEmbeddingGeneration();
