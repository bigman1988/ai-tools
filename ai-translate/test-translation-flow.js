import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { translationService } from './src/services/translator.js';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') });

async function testTranslationFlow() {
    console.log('测试翻译流程...');
    
    try {
        // 测试中文到英文翻译
        console.log('\n测试中文到英文翻译:');
        const zhToEnTask = {
            id: 1,
            source: '这是一个测试文本',
            target: '',
            targetLanguage: 'English'
        };
        
        console.log(`源文本: "${zhToEnTask.source}"`);
        console.log(`目标语言: ${zhToEnTask.targetLanguage}`);
        
        // 获取翻译记忆
        console.log('\n获取翻译记忆:');
        const zhToEnTM = await translationService.getTranslationMemory(
            zhToEnTask.source, 
            'zh', 
            'en'
        );
        
        console.log(`找到 ${zhToEnTM.length} 条翻译记忆`);
        if (zhToEnTM.length > 0) {
            zhToEnTM.forEach((tm, index) => {
                console.log(`\n记忆 ${index + 1}:`);
                console.log(`源文本: ${tm.source}`);
                console.log(`目标文本: ${tm.target}`);
            });
        }
        
        // 测试英文到中文翻译
        console.log('\n测试英文到中文翻译:');
        const enToZhTask = {
            id: 2,
            source: 'This is a test text',
            target: '',
            targetLanguage: 'Chinese'
        };
        
        console.log(`源文本: "${enToZhTask.source}"`);
        console.log(`目标语言: ${enToZhTask.targetLanguage}`);
        
        // 获取翻译记忆
        console.log('\n获取翻译记忆:');
        const enToZhTM = await translationService.getTranslationMemory(
            enToZhTask.source, 
            'en', 
            'zh'
        );
        
        console.log(`找到 ${enToZhTM.length} 条翻译记忆`);
        if (enToZhTM.length > 0) {
            enToZhTM.forEach((tm, index) => {
                console.log(`\n记忆 ${index + 1}:`);
                console.log(`源文本: ${tm.source}`);
                console.log(`目标文本: ${tm.target}`);
            });
        }
        
    } catch (error) {
        console.error('测试过程中出错:', error);
    }
}

// 执行测试
testTranslationFlow();
