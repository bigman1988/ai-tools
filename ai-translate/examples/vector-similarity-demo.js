// 向量相似度应用示例
import { OllamaEmbeddingService } from '../src/services/embedding.js';
import { SimilarityThresholds, getRecommendedThreshold } from '../src/config/similarity-thresholds.js';

/**
 * 演示如何在实际应用中使用向量相似度
 */
async function demonstrateSimilarityUsage() {
    try {
        console.log('===== 向量相似度应用示例 =====');
        
        // 初始化嵌入服务
        const embeddingService = new OllamaEmbeddingService(
            process.env.OLLAMA_URL || 'http://172.16.1.65:11434',
            'nomic-embed-text',
            process.env.QDRANT_URL || 'http://172.16.0.78:6333'
        );
        
        // 示例文本
        const sourceText = '机器学习是人工智能的一个分支，它使用数据和算法来模仿人类学习的方式。';
        const candidateTexts = [
            // 高度相似（中文）
            '人工智能的一个分支是机器学习，它通过数据和算法来模拟人类的学习过程。',
            // 相关主题（中文）
            '深度学习是机器学习的一种特殊形式，它使用神经网络进行学习。',
            // 不相关（中文）
            '今天天气真好，我想去公园散步。',
            // 相同内容（英文）
            'Machine learning is a branch of artificial intelligence that uses data and algorithms to imitate the way humans learn.',
            // 相关主题（英文）
            'Deep learning is a special form of machine learning that uses neural networks for learning.',
            // 不相关（英文）
            'The weather is nice today, I want to take a walk in the park.'
        ];
        
        // 生成嵌入向量
        console.log('生成嵌入向量...');
        const sourceEmbedding = await embeddingService.generateEmbedding(sourceText);
        
        const candidateEmbeddings = [];
        for (let i = 0; i < candidateTexts.length; i++) {
            const embedding = await embeddingService.generateEmbedding(candidateTexts[i]);
            candidateEmbeddings.push(embedding);
        }
        
        // 计算相似度并应用阈值
        console.log('\n===== 相似度比较与阈值应用 =====');
        
        // 同语言高相似度阈值
        const sameLangHighThreshold = getRecommendedThreshold({
            crossLanguage: false,
            sourceLanguage: 'zh',
            similarityLevel: 'high'
        });
        
        // 同语言中等相似度阈值
        const sameLangMediumThreshold = getRecommendedThreshold({
            crossLanguage: false,
            sourceLanguage: 'zh',
            similarityLevel: 'medium'
        });
        
        // 跨语言相似度阈值
        const crossLangThreshold = getRecommendedThreshold({
            crossLanguage: true,
            sourceLanguage: 'zh',
            targetLanguage: 'en',
            similarityLevel: 'medium'
        });
        
        // 翻译记忆场景阈值
        const translationMemoryThreshold = getRecommendedThreshold({
            crossLanguage: false,
            useCase: 'translation',
            similarityLevel: 'high'
        });
        
        console.log(`同语言高相似度阈值: ${sameLangHighThreshold}`);
        console.log(`同语言中等相似度阈值: ${sameLangMediumThreshold}`);
        console.log(`跨语言相似度阈值: ${crossLangThreshold}`);
        console.log(`翻译记忆场景阈值: ${translationMemoryThreshold}`);
        
        console.log('\n源文本:');
        console.log(sourceText);
        
        console.log('\n候选文本相似度与匹配结果:');
        for (let i = 0; i < candidateTexts.length; i++) {
            const similarity = embeddingService.calculateCosineSimilarity(
                sourceEmbedding.embedding, 
                candidateEmbeddings[i].embedding
            );
            
            // 确定阈值和语言
            const isChinese = i < 3; // 前3个是中文，后3个是英文
            const isHighSimilarity = similarity >= (isChinese ? sameLangHighThreshold : crossLangThreshold);
            const isMediumSimilarity = similarity >= (isChinese ? sameLangMediumThreshold : crossLangThreshold * 0.9);
            const isTranslationMatch = similarity >= translationMemoryThreshold;
            
            console.log(`\n[${i + 1}] ${candidateTexts[i].substring(0, 50)}${candidateTexts[i].length > 50 ? '...' : ''}`);
            console.log(`   相似度: ${similarity.toFixed(4)}`);
            console.log(`   高相似度匹配: ${isHighSimilarity ? '✓' : '✗'}`);
            console.log(`   中等相似度匹配: ${isMediumSimilarity ? '✓' : '✗'}`);
            console.log(`   翻译记忆匹配: ${isTranslationMatch ? '✓' : '✗'}`);
            console.log(`   推荐用途: ${getRecommendedUse(similarity, isChinese)}`);
        }
        
        return true;
    } catch (error) {
        console.error('演示过程中发生错误:', error);
        return false;
    }
}

/**
 * 根据相似度和语言推荐用途
 * @param {number} similarity 相似度值
 * @param {boolean} isChinese 是否中文
 * @returns {string} 推荐用途
 */
function getRecommendedUse(similarity, isChinese) {
    if (isChinese) {
        if (similarity >= SimilarityThresholds.SAME_LANGUAGE.HIGH) {
            return '翻译记忆匹配、精确搜索';
        } else if (similarity >= SimilarityThresholds.SAME_LANGUAGE.MEDIUM) {
            return '内容推荐、相关搜索';
        } else if (similarity >= SimilarityThresholds.LANGUAGE_SPECIFIC.CHINESE.UNRELATED_THRESHOLD) {
            return '广泛搜索、可能相关';
        } else {
            return '不相关';
        }
    } else {
        if (similarity >= SimilarityThresholds.CROSS_LANGUAGE.HIGH) {
            return '跨语言匹配、翻译参考';
        } else if (similarity >= SimilarityThresholds.CROSS_LANGUAGE.MEDIUM) {
            return '跨语言搜索、可能相关';
        } else {
            return '不相关';
        }
    }
}

// 执行演示
demonstrateSimilarityUsage().then(() => {
    console.log('\n演示完成!');
}).catch(error => {
    console.error('演示失败:', error);
});
