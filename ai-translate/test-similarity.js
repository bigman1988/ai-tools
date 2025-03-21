// 测试向量相似度计算功能
import { OllamaEmbeddingService } from './src/services/embedding.js';

/**
 * 测试不同文本之间的相似度
 */
async function testTextSimilarity() {
    try {
        console.log('===== 测试文本相似度计算 =====');
        
        // 初始化嵌入服务
        const embeddingService = new OllamaEmbeddingService(
            process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
            'nomic-embed-text',
            process.env.QDRANT_URL || 'http://172.16.0.78:6333'
        );
        
        // 测试文本集合
        const texts = {
            // 中文测试文本
            cn1: '机器学习是人工智能的一个分支，它使用数据和算法来模仿人类学习的方式。',
            cn2: '人工智能的一个分支是机器学习，它通过数据和算法来模拟人类的学习过程。', // 与cn1相似
            cn3: '深度学习是机器学习的一种特殊形式，它使用神经网络进行学习。', // 相关但不同
            cn4: '今天天气真好，我想去公园散步。', // 完全不相关
            
            // 英文测试文本
            en1: 'Machine learning is a branch of artificial intelligence that uses data and algorithms to imitate the way humans learn.',
            en2: 'A branch of artificial intelligence is machine learning, which simulates human learning through data and algorithms.', // 与en1相似
            en3: 'Deep learning is a special form of machine learning that uses neural networks for learning.', // 相关但不同
            en4: 'The weather is nice today, I want to take a walk in the park.', // 完全不相关
            
            // 中英文对应文本
            cn_tech: '向量数据库是专门设计用于存储和检索向量嵌入的数据库系统。',
            en_tech: 'Vector databases are database systems specifically designed for storing and retrieving vector embeddings.',
            
            cn_daily: '我喜欢在周末去咖啡店看书和写作。',
            en_daily: 'I like to go to coffee shops to read and write on weekends.'
        };
        
        // 生成所有文本的嵌入向量
        console.log('生成文本嵌入向量...');
        const embeddings = {};
        
        for (const [key, text] of Object.entries(texts)) {
            console.log(`处理文本: ${key}`);
            embeddings[key] = await embeddingService.generateEmbedding(text);
        }
        
        // 计算并显示相似度矩阵
        console.log('\n===== 相似度矩阵 =====');
        console.log('格式: [文本1, 文本2] = 相似度');
        
        // 中文文本相似度
        console.log('\n----- 中文文本相似度 -----');
        console.log(`[cn1, cn2] = ${embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.cn2.embedding).toFixed(4)} (相似内容)`);
        console.log(`[cn1, cn3] = ${embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.cn3.embedding).toFixed(4)} (相关主题)`);
        console.log(`[cn1, cn4] = ${embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.cn4.embedding).toFixed(4)} (不相关)`);
        
        // 英文文本相似度
        console.log('\n----- 英文文本相似度 -----');
        console.log(`[en1, en2] = ${embeddingService.calculateCosineSimilarity(embeddings.en1.embedding, embeddings.en2.embedding).toFixed(4)} (相似内容)`);
        console.log(`[en1, en3] = ${embeddingService.calculateCosineSimilarity(embeddings.en1.embedding, embeddings.en3.embedding).toFixed(4)} (相关主题)`);
        console.log(`[en1, en4] = ${embeddingService.calculateCosineSimilarity(embeddings.en1.embedding, embeddings.en4.embedding).toFixed(4)} (不相关)`);
        
        // 中英文对应文本相似度
        console.log('\n----- 中英文对应文本相似度 -----');
        console.log(`[cn_tech, en_tech] = ${embeddingService.calculateCosineSimilarity(embeddings.cn_tech.embedding, embeddings.en_tech.embedding).toFixed(4)} (技术主题)`);
        console.log(`[cn_daily, en_daily] = ${embeddingService.calculateCosineSimilarity(embeddings.cn_daily.embedding, embeddings.en_daily.embedding).toFixed(4)} (日常主题)`);
        
        // 跨语言相似度比较
        console.log('\n----- 跨语言相似度比较 -----');
        console.log(`[cn1, en1] = ${embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.en1.embedding).toFixed(4)} (相同内容不同语言)`);
        console.log(`[cn3, en3] = ${embeddingService.calculateCosineSimilarity(embeddings.cn3.embedding, embeddings.en3.embedding).toFixed(4)} (相同内容不同语言)`);
        console.log(`[cn4, en4] = ${embeddingService.calculateCosineSimilarity(embeddings.cn4.embedding, embeddings.en4.embedding).toFixed(4)} (相同内容不同语言)`);
        
        // 计算平均相似度
        const sameLangSimilar = (
            embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.cn2.embedding) +
            embeddingService.calculateCosineSimilarity(embeddings.en1.embedding, embeddings.en2.embedding)
        ) / 2;
        
        const crossLangSame = (
            embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.en1.embedding) +
            embeddingService.calculateCosineSimilarity(embeddings.cn3.embedding, embeddings.en3.embedding) +
            embeddingService.calculateCosineSimilarity(embeddings.cn4.embedding, embeddings.en4.embedding) +
            embeddingService.calculateCosineSimilarity(embeddings.cn_tech.embedding, embeddings.en_tech.embedding) +
            embeddingService.calculateCosineSimilarity(embeddings.cn_daily.embedding, embeddings.en_daily.embedding)
        ) / 5;
        
        const unrelatedTexts = (
            embeddingService.calculateCosineSimilarity(embeddings.cn1.embedding, embeddings.cn4.embedding) +
            embeddingService.calculateCosineSimilarity(embeddings.en1.embedding, embeddings.en4.embedding)
        ) / 2;
        
        console.log('\n===== 平均相似度统计 =====');
        console.log(`同语言相似内容平均相似度: ${sameLangSimilar.toFixed(4)}`);
        console.log(`跨语言相同内容平均相似度: ${crossLangSame.toFixed(4)}`);
        console.log(`不相关内容平均相似度: ${unrelatedTexts.toFixed(4)}`);
        
        return true;
    } catch (error) {
        console.error('测试过程中发生错误:', error);
        return false;
    }
}

// 执行测试
testTextSimilarity().then(() => {
    console.log('\n测试完成!');
}).catch(error => {
    console.error('测试失败:', error);
});
