import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import path from 'path';
import { translationService } from './src/services/translator.js';
import { embeddingService } from './src/services/embedding-instance.js';
import { knowledgeBaseService } from './src/services/knowledge-base.js';

// 获取当前文件的目录路径
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config({ path: path.join(__dirname, '.env') });

async function testTranslator() {
    console.log('创建翻译服务实例...');
    try {
        // 检查Qdrant连接（可选，仅用于信息显示）
        try {
            const connected = await embeddingService.checkQdrantConnection();
            if (!connected) {
                console.log('⚠️ Qdrant服务连接失败，翻译记忆功能将不可用');
                console.log('但翻译功能仍然可以正常工作');
            }
        } catch (error) {
            console.log('⚠️ Qdrant连接检查失败，翻译记忆功能将不可用');
        }
        
        // 测试单个翻译
        console.log('测试单个翻译...');
        const singleText = "这是一个测试文本，用于验证翻译服务是否正常工作。";
        console.log(`翻译文本: "${singleText}"`);
        
        const singleTask = {
            id: 1,
            text: singleText,
            targetLanguage: 'English'  // 使用全拼语言名称
        };
        
        const singleResult = await translationService.translateSingle(singleTask, 'Chinese');
        console.log('单个翻译结果:');
        console.log(singleResult);
        
        // 测试使用简写语言代码
        console.log('\n测试使用简写语言代码...');
        const codeText = "蕾蒂";
        console.log(`翻译文本: "${codeText}"`);
        
        const codeTask = {
            id: 2,
            text: codeText,
            targetLanguage: 'English'  // 使用全拼语言名称
        };
        
        const codeResult = await translationService.translateSingle(codeTask, 'Chinese');  // 使用全拼语言名称
        console.log('简写语言代码翻译结果:');
        console.log(codeResult);
        
        // 测试批量翻译
        console.log('\n测试批量翻译...');
        const batchTexts = [
            "这是第一个测试文本。",
            "这是第二个测试文本。",
            "这是第三个测试文本。"
        ];
        
        console.log('批量翻译文本:');
        batchTexts.forEach((text, index) => {
            console.log(`${index + 1}: "${text}"`);
        });
        
        const batch = {
            id: 'test-batch',
            tasks: batchTexts.map((text, index) => ({
                id: index + 1,
                text,
                targetLanguage: 'English'  // 使用全拼语言名称
            })),
            startLine: 3,
            endLine: 5,
            totalLines: 5
        };
        
        const batchResult = await translationService.translateBatch(batch, 'Chinese');
        
        console.log('批量翻译结果:');
        if (batch.tasks && batch.tasks.length > 0) {
            batch.tasks.forEach((task, index) => {
                if (task.translation) {
                    console.log(`${index + 1}: "${task.translation}"`);
                } else {
                    console.log(`${index + 1}: 翻译失败`);
                }
            });
        } else {
            console.log('批量翻译失败，没有返回任何结果');
        }
        
        // 测试翻译服务和向量嵌入功能
        console.log('\n测试翻译服务和向量嵌入功能...');
        
        // 测试数据
        const testEntries = [
            { Chinese: '这是第一个测试句子。', English: 'This is the first test sentence.' },
            { Chinese: '我喜欢编程和人工智能。', English: 'I like programming and artificial intelligence.' },
            { Chinese: '向量数据库可以存储和检索向量嵌入。', English: 'Vector databases can store and retrieve vector embeddings.' }
        ];
        
        // 测试添加条目
        console.log('\n测试添加翻译条目...');
        const ids = [];
        for (const entry of testEntries) {
            const result = await knowledgeBaseService.addEntry(entry);
            if (result.success) {
                ids.push(result.id);
                console.log(`成功添加条目: ${entry.Chinese} -> ${entry.English}`);
            } else {
                console.error(`添加条目失败: ${entry.Chinese}`, result.error);
            }
        }
        
        // 测试相似度搜索
        console.log('\n测试相似度搜索...');
        const searchText = '我对编程很感兴趣';
        console.log(`搜索文本: "${searchText}"`);
        
        const searchResults = await embeddingService.searchSimilar(searchText, 5, 'chinese');
        console.log('搜索结果:');
        for (const result of searchResults) {
            console.log(`- 相似度: ${result.score.toFixed(4)}, 中文: ${result.payload.Chinese}, 英文: ${result.payload.English}`);
        }
        
        // 测试翻译
        console.log('\n测试翻译功能...');
        const textToTranslate = '人工智能正在改变我们的生活方式';
        console.log(`翻译文本: "${textToTranslate}"`);
        
        const translationTask = {
            text: textToTranslate,
            rowIndex: 0,
            columnIndex: 0
        };
        
        const success = await translationService.translateSingle(translationTask, 'zh');
        if (success) {
            console.log(`翻译结果: "${translationTask.text}"`);
        } else {
            console.error('翻译失败');
        }
        
        // 清理测试数据
        console.log('\n清理测试数据...');
        for (const id of ids) {
            const deleteResult = await knowledgeBaseService.deleteEntry(id);
            if (deleteResult.success) {
                console.log(`删除条目: ${id}`);
            } else {
                console.error(`删除条目失败: ${id}`, deleteResult.error);
            }
        }
        
        console.log('\n测试完成!');
    } catch (error) {
        console.error('翻译测试失败:', error);
    }
}

// 执行测试
testTranslator();
