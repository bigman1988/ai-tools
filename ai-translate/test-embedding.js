// 测试嵌入向量生成和搜索功能
import { OllamaEmbeddingService } from './src/services/embedding.js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

async function testEmbedding() {
    try {
        console.log('开始测试嵌入向量生成和搜索功能...');
        
        // 初始化嵌入服务
        const embeddingService = new OllamaEmbeddingService(
            process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
            'nomic-embed-text',
            process.env.QDRANT_URL || 'http://172.16.0.78:6333'
        );
        
        // 测试数据
        const testEntries = [
            { Chinese: '这是第一个测试句子。', English: 'This is the first test sentence.' },
            { Chinese: '我喜欢编程和人工智能。', English: 'I like programming and artificial intelligence.' },
            { Chinese: '向量数据库可以存储和检索向量嵌入。', English: 'Vector databases can store and retrieve vector embeddings.' }
        ];
        
        // 存储测试数据
        console.log('存储测试数据...');
        const ids = [];
        for (const entry of testEntries) {
            const result = await embeddingService.storeEntryVectors(entry);
            if (result.success) {
                ids.push(result.id);
                console.log(`成功存储条目: ${entry.Chinese} -> ${entry.English}`);
            } else {
                console.error(`存储条目失败: ${entry.Chinese}`, result.error);
            }
        }
        
        // 测试相似度搜索
        console.log('\n测试相似度搜索...');
        const searchText = '我对编程很感兴趣';
        console.log(`搜索文本: "${searchText}"`);
        
        const searchResults = await embeddingService.searchSimilar(searchText, 2);
        console.log('搜索结果:');
        for (const result of searchResults) {
            console.log(`- 相似度: ${result.score.toFixed(4)}, 中文: ${result.payload.Chinese}, 英文: ${result.payload.English}`);
        }
        
        // 清理测试数据
        console.log('\n清理测试数据...');
        for (const id of ids) {
            await embeddingService.deleteVector(id);
            console.log(`删除条目: ${id}`);
        }
        
        console.log('\n测试完成!');
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 运行测试
testEmbedding();
