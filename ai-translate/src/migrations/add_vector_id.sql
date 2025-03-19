-- 添加vector_id字段到translate表
ALTER TABLE `translate`
ADD COLUMN vector_id VARCHAR(255) DEFAULT NULL,
ADD INDEX idx_vector_id (vector_id);
