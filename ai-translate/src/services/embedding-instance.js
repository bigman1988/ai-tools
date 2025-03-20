import { OllamaEmbeddingService } from './embedding.js';

// 创建单例实例
console.log('创建 OllamaEmbeddingService 单例实例');
export const embeddingService = new OllamaEmbeddingService();
console.log('OllamaEmbeddingService 单例实例创建完成');
