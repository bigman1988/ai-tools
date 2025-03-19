-- 添加vector_id字段到translate-cn表
ALTER TABLE `translate-cn`
ADD COLUMN vector_id VARCHAR(255) DEFAULT NULL,
ADD INDEX idx_vector_id (vector_id);
