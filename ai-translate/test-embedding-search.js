import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { embeddingService } from './src/services/embedding-instance.js';
import { LanguageUtils } from './src/utils/LanguageUtils.js';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') });

async function testEmbeddingSearch() {
    console.log('测试向量搜索功能...');
    
    try {
        // 检查Qdrant连接
        const connected = await embeddingService.checkQdrantConnection();
        if (!connected) {
            console.error('⚠️ Qdrant服务连接失败，测试无法继续');
            return;
        }
        
        // 测试中文搜索
        console.log('\n测试中文搜索:');
        const chineseText = "这是一个测试文本";
        console.log(`搜索文本: "${chineseText}"`);
        
        const chineseResults = await embeddingService.searchSimilar(chineseText, 'chinese', 3);
        console.log(`找到 ${chineseResults.length} 条中文相似结果:`);
        
        if (chineseResults.length > 0) {
            chineseResults.forEach((result, index) => {
                console.log(`\n结果 ${index + 1}:`);
                console.log(`相似度: ${result.score.toFixed(4)}`);
                console.log(`中文: ${result.payload.Chinese}`);
                console.log(`英文: ${result.payload.English}`);
                console.log(`日文: ${result.payload.Japanese || '无'}`);
            });
        }
        
        // 测试英文搜索
        console.log('\n测试英文搜索:');
        const englishText = "This is a test";
        console.log(`搜索文本: "${englishText}"`);
        
        const englishResults = await embeddingService.searchSimilar(englishText, 'english', 3);
        console.log(`找到 ${englishResults.length} 条英文相似结果:`);
        
        if (englishResults.length > 0) {
            englishResults.forEach((result, index) => {
                console.log(`\n结果 ${index + 1}:`);
                console.log(`相似度: ${result.score.toFixed(4)}`);
                console.log(`中文: ${result.payload.Chinese}`);
                console.log(`英文: ${result.payload.English}`);
                console.log(`日文: ${result.payload.Japanese || '无'}`);
            });
        }
        
        // 测试语言代码转换
        console.log('\n测试语言代码转换:');
        const codes = ['zh', 'en', 'ja', 'ko', 'es', 'fr'];
        codes.forEach(code => {
            const fullName = LanguageUtils.getApiLanguageCode(code);
            console.log(`${code} -> ${fullName}`);
        });
        
    } catch (error) {
        console.error('测试过程中出错:', error);
    }
}

// 执行测试
testEmbeddingSearch();
