// 更新向量数据库中的字段名，从首字母小写改为首字母大写
import { OllamaEmbeddingService } from './src/services/embedding.js';
import { QdrantClient } from '@qdrant/qdrant-js';
import dotenv from 'dotenv';

// 加载环境变量
dotenv.config();

const COLLECTION_NAME = 'translation_embeddings';
const BATCH_SIZE = 100;

async function updateVectorFields() {
    try {
        console.log('开始更新向量数据库字段名...');
        
        // 初始化Qdrant客户端
        const qdrantUrl = process.env.QDRANT_URL || 'http://172.16.0.78:6333';
        const qdrantClient = new QdrantClient({
            url: qdrantUrl,
            checkCompatibility: false,
            timeout: 15000,
            retries: 3
        });
        
        console.log(`连接到Qdrant服务: ${qdrantUrl}`);
        
        // 检查集合是否存在
        try {
            const collections = await qdrantClient.getCollections();
            const collectionExists = collections.collections.some(c => c.name === COLLECTION_NAME);
            
            if (!collectionExists) {
                console.error(`集合 ${COLLECTION_NAME} 不存在`);
                return;
            }
            
            console.log(`找到集合: ${COLLECTION_NAME}`);
        } catch (error) {
            console.error('检查集合时出错:', error);
            return;
        }
        
        // 获取所有向量点
        let offset = 0;
        let hasMore = true;
        let totalUpdated = 0;
        
        while (hasMore) {
            console.log(`获取向量点，偏移量: ${offset}, 批次大小: ${BATCH_SIZE}`);
            
            try {
                const scrollResponse = await qdrantClient.scroll(COLLECTION_NAME, {
                    limit: BATCH_SIZE,
                    offset: offset,
                    with_payload: true,
                    with_vector: false
                });
                
                const points = scrollResponse.points;
                
                if (points.length === 0) {
                    hasMore = false;
                    console.log('没有更多向量点');
                    break;
                }
                
                console.log(`获取到 ${points.length} 个向量点`);
                
                // 处理每个点
                for (const point of points) {
                    const id = point.id;
                    const payload = point.payload;
                    
                    if (!payload) {
                        console.log(`跳过点 ${id}: 没有payload`);
                        continue;
                    }
                    
                    // 创建新的payload，使用首字母大写的字段名
                    const newPayload = {};
                    let needsUpdate = false;
                    
                    // 检查并转换字段
                    const fieldMappings = [
                        { lower: 'chinese', upper: 'Chinese' },
                        { lower: 'english', upper: 'English' },
                        { lower: 'japanese', upper: 'Japanese' },
                        { lower: 'korean', upper: 'Korean' },
                        { lower: 'spanish', upper: 'Spanish' },
                        { lower: 'french', upper: 'French' },
                        { lower: 'german', upper: 'German' },
                        { lower: 'russian', upper: 'Russian' },
                        { lower: 'thai', upper: 'Thai' },
                        { lower: 'italian', upper: 'Italian' },
                        { lower: 'indonesian', upper: 'Indonesian' },
                        { lower: 'portuguese', upper: 'Portuguese' }
                    ];
                    
                    for (const mapping of fieldMappings) {
                        if (payload[mapping.lower] !== undefined) {
                            newPayload[mapping.upper] = payload[mapping.lower];
                            needsUpdate = true;
                        } else if (payload[mapping.upper] !== undefined) {
                            newPayload[mapping.upper] = payload[mapping.upper];
                        }
                    }
                    
                    // 保留其他字段
                    for (const key in payload) {
                        if (!fieldMappings.some(m => m.lower === key || m.upper === key)) {
                            newPayload[key] = payload[key];
                        }
                    }
                    
                    // 如果需要更新，则更新点
                    if (needsUpdate) {
                        console.log(`更新点 ${id}`);
                        
                        try {
                            await qdrantClient.updatePayload(COLLECTION_NAME, {
                                wait: true,
                                points: [id],
                                payload: newPayload
                            });
                            
                            totalUpdated++;
                        } catch (updateError) {
                            console.error(`更新点 ${id} 失败:`, updateError);
                        }
                    } else {
                        console.log(`点 ${id} 不需要更新`);
                    }
                }
                
                // 更新偏移量
                offset += points.length;
                
            } catch (scrollError) {
                console.error('获取向量点失败:', scrollError);
                hasMore = false;
            }
        }
        
        console.log(`更新完成，共更新了 ${totalUpdated} 个向量点`);
        
    } catch (error) {
        console.error('更新向量字段失败:', error);
    }
}

// 执行更新
updateVectorFields()
    .then(() => {
        console.log('更新向量字段脚本执行完毕');
        process.exit(0);
    })
    .catch(error => {
        console.error('更新向量字段脚本执行失败:', error);
        process.exit(1);
    });
