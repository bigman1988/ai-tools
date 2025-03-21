// 测试翻译记忆功能
import { TranslationService } from './src/services/translator.js';
import { OllamaEmbeddingService } from './src/services/embedding.js';
import { KnowledgeBaseService } from './src/services/knowledge-base.js';

async function testTranslationMemory() {
    try {
        console.log('初始化服务...');
        const embeddingService = new OllamaEmbeddingService();
        const knowledgeBaseService = new KnowledgeBaseService();
        const translationService = new TranslationService(embeddingService, knowledgeBaseService);
        
        // 添加测试条目
        console.log('添加测试翻译条目...');
        const testEntry = {
            Chinese: '你好，世界',
            English: 'Hello, World',
            Japanese: 'こんにちは、世界',
            Korean: '안녕하세요, 세계',
            Spanish: 'Hola, Mundo',
            French: 'Bonjour, le Monde',
            German: 'Hallo, Welt',
            Russian: 'Привет, мир',
            Thai: 'สวัสดี, โลก',
            Italian: 'Ciao, Mondo',
            Indonesian: 'Halo, Dunia',
            Portuguese: 'Olá, Mundo'
        };
        
        // 添加条目到知识库
        const addResult = await knowledgeBaseService.addEntry(testEntry);
        console.log('添加条目结果:', addResult);
        
        // 测试中文到日语的翻译记忆
        console.log('\n测试中文到日语的翻译记忆:');
        const cnToJpMemory = await translationService.getTranslationMemory('你好', 'Chinese', 'Japanese');
        console.log('中文到日语的翻译记忆结果:', cnToJpMemory);
        
        // 测试中文到英语的翻译记忆
        console.log('\n测试中文到英语的翻译记忆:');
        const cnToEnMemory = await translationService.getTranslationMemory('你好', 'Chinese', 'English');
        console.log('中文到英语的翻译记忆结果:', cnToEnMemory);
        
        // 测试英语到中文的翻译记忆
        console.log('\n测试英语到中文的翻译记忆:');
        const enToCnMemory = await translationService.getTranslationMemory('Hello', 'English', 'Chinese');
        console.log('英语到中文的翻译记忆结果:', enToCnMemory);
        
        // 测试英语到日语的翻译记忆
        console.log('\n测试英语到日语的翻译记忆:');
        const enToJpMemory = await translationService.getTranslationMemory('Hello', 'English', 'Japanese');
        console.log('英语到日语的翻译记忆结果:', enToJpMemory);
        
        console.log('\n测试完成!');
    } catch (error) {
        console.error('测试过程中发生错误:', error);
    }
}

// 执行测试
testTranslationMemory();
