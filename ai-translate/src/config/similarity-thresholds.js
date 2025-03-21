/**
 * 向量相似度阈值配置
 * 基于测试结果，提供不同场景下的推荐相似度阈值
 */

export const SimilarityThresholds = {
    // 同语言搜索阈值
    SAME_LANGUAGE: {
        // 高度相似（几乎相同的内容）
        HIGH: 0.90,
        // 中度相似（相关内容）
        MEDIUM: 0.80,
        // 低度相似（可能相关）
        LOW: 0.70
    },
    
    // 跨语言搜索阈值
    CROSS_LANGUAGE: {
        // 高度相似（同一内容的不同语言版本）
        HIGH: 0.45,
        // 中度相似（相关内容的不同语言版本）
        MEDIUM: 0.40,
        // 低度相似（可能相关的不同语言内容）
        LOW: 0.35
    },
    
    // 按语言特定的阈值调整
    LANGUAGE_SPECIFIC: {
        // 中文相似度可能偏高，需要更严格的阈值
        CHINESE: {
            UNRELATED_THRESHOLD: 0.65 // 高于此值才可能相关
        },
        // 英文相似度区分较好
        ENGLISH: {
            UNRELATED_THRESHOLD: 0.40 // 高于此值才可能相关
        }
    },
    
    // 应用场景特定阈值
    USE_CASES: {
        // 翻译记忆匹配（要求较高的相似度）
        TRANSLATION_MEMORY: 0.85,
        // 相似内容推荐
        CONTENT_RECOMMENDATION: 0.75,
        // 语义搜索（较宽松的阈值）
        SEMANTIC_SEARCH: 0.60
    }
};

/**
 * 获取推荐的相似度阈值
 * @param {Object} options 配置选项
 * @param {boolean} options.crossLanguage 是否跨语言搜索
 * @param {string} options.sourceLanguage 源语言 ('zh', 'en', 等)
 * @param {string} options.targetLanguage 目标语言 ('zh', 'en', 等)
 * @param {string} options.useCase 使用场景 ('translation', 'search', 'recommendation')
 * @param {string} options.similarityLevel 相似度级别 ('high', 'medium', 'low')
 * @returns {number} 推荐的相似度阈值
 */
export function getRecommendedThreshold(options) {
    const {
        crossLanguage = false,
        sourceLanguage = 'zh',
        targetLanguage = 'en',
        useCase = 'search',
        similarityLevel = 'medium'
    } = options;
    
    // 默认阈值
    let threshold = 0.70;
    
    // 根据语言和使用场景调整阈值
    if (crossLanguage) {
        // 跨语言搜索
        switch (similarityLevel.toLowerCase()) {
            case 'high':
                threshold = SimilarityThresholds.CROSS_LANGUAGE.HIGH;
                break;
            case 'medium':
                threshold = SimilarityThresholds.CROSS_LANGUAGE.MEDIUM;
                break;
            case 'low':
                threshold = SimilarityThresholds.CROSS_LANGUAGE.LOW;
                break;
        }
    } else {
        // 同语言搜索
        switch (similarityLevel.toLowerCase()) {
            case 'high':
                threshold = SimilarityThresholds.SAME_LANGUAGE.HIGH;
                break;
            case 'medium':
                threshold = SimilarityThresholds.SAME_LANGUAGE.MEDIUM;
                break;
            case 'low':
                threshold = SimilarityThresholds.SAME_LANGUAGE.LOW;
                break;
        }
    }
    
    // 根据使用场景进一步调整
    switch (useCase.toLowerCase()) {
        case 'translation':
            threshold = Math.max(threshold, SimilarityThresholds.USE_CASES.TRANSLATION_MEMORY);
            break;
        case 'recommendation':
            threshold = Math.min(threshold, SimilarityThresholds.USE_CASES.CONTENT_RECOMMENDATION);
            break;
        case 'search':
            threshold = Math.min(threshold, SimilarityThresholds.USE_CASES.SEMANTIC_SEARCH);
            break;
    }
    
    return threshold;
}

export default SimilarityThresholds;
