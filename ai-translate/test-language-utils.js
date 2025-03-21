import { LanguageUtils } from './src/utils/LanguageUtils.js';

// 测试语言代码转换
console.log('测试语言代码转换:');
const codes = ['zh', 'en', 'ja', 'ko', 'es', 'fr', 'de', 'ru', 'th', 'it', 'id', 'pt'];
codes.forEach(code => {
    const fullName = LanguageUtils.getApiLanguageCode(code);
    console.log(`${code} -> ${fullName}`);
});

// 测试源语言和目标语言字段确定
function testTranslationFields(sourceLanguage, targetLanguage) {
    const standardSourceLang = LanguageUtils.getApiLanguageCode(sourceLanguage);
    const standardTargetLang = LanguageUtils.getApiLanguageCode(targetLanguage);
    
    // 确定向量搜索的语言类型
    const vectorLanguage = standardSourceLang === 'Chinese' ? 'chinese' : 'english';
    
    console.log(`\n源语言: ${sourceLanguage} -> ${standardSourceLang}`);
    console.log(`目标语言: ${targetLanguage} -> ${standardTargetLang}`);
    console.log(`向量搜索语言: ${vectorLanguage}`);
}

console.log('\n测试翻译字段确定:');
testTranslationFields('zh', 'en');
testTranslationFields('en', 'zh');
testTranslationFields('zh', 'ja');
testTranslationFields('en', 'ja');
