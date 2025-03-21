// 测试嵌入向量生成功能
import { OllamaEmbeddingService } from './src/services/embedding.js';

async function testEmbeddingGeneration() {
    try {
        console.log('开始测试嵌入向量生成功能...');
        
        // 初始化嵌入服务，使用环境变量中的配置
        const embeddingService = new OllamaEmbeddingService(
            process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
            'nomic-embed-text',
            process.env.QDRANT_URL || 'http://172.16.0.78:6333'
        );
        
        // 测试中文文本
        const chineseText = '这是一个测试文本，用于验证向量嵌入生成功能。';
        console.log(`测试中文文本: "${chineseText}"`);
        
        try {
            const cnEmbedding = await embeddingService.generateEmbedding(chineseText);
            console.log('中文嵌入向量生成成功:');
            console.log(`- 类型: ${typeof cnEmbedding}`);
            console.log(`- 是否包含embedding属性: ${cnEmbedding.hasOwnProperty('embedding')}`);
            console.log(`- embedding类型: ${typeof cnEmbedding.embedding}`);
            console.log(`- embedding长度: ${cnEmbedding.embedding.length}`);
        } catch (cnError) {
            console.error('中文嵌入向量生成失败:', cnError);
        }
        
        // 测试英文文本
        const englishText = 'This is a test text for verifying vector embedding generation.';
        console.log(`\n测试英文文本: "${englishText}"`);
        
        try {
            const enEmbedding = await embeddingService.generateEmbedding(englishText);
            console.log('英文嵌入向量生成成功:');
            console.log(`- 类型: ${typeof enEmbedding}`);
            console.log(`- 是否包含embedding属性: ${enEmbedding.hasOwnProperty('embedding')}`);
            console.log(`- embedding类型: ${typeof enEmbedding.embedding}`);
            console.log(`- embedding长度: ${enEmbedding.embedding.length}`);
        } catch (enError) {
            console.error('英文嵌入向量生成失败:', enError);
        }
        
        // 测试条目存储
        console.log('\n测试条目向量存储...');
        const testEntry = {
            Chinese: '测试条目',
            English: 'Test entry'
        };
        
        try {
            const storeResult = await embeddingService.storeEntryVectors(testEntry);
            console.log('条目向量存储结果:', storeResult);
        } catch (storeError) {
            console.error('条目向量存储失败:', storeError);
        }
        
        console.log('\n测试完成!');
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 执行测试
testEmbeddingGeneration();
