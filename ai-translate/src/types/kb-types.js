/**
 * @typedef {Object} LanguageField
 * @property {string} key - 语言字段键名
 * @property {string} label - 语言字段显示名称
 */

/**
 * @typedef {Object} ModalConfig
 * @property {string} title - 模态框标题
 * @property {boolean} isEditing - 是否处于编辑模式
 * @property {Object} [entry] - 翻译条目
 */

/**
 * 知识库管理器接口
 * @interface IKnowledgeBaseManager
 */

/**
 * 记录日志
 * @function
 * @name IKnowledgeBaseManager#log
 * @param {string} message - 日志消息
 * @param {'info'|'warning'|'error'} [type] - 日志类型
 */

/**
 * 加载翻译条目
 * @function
 * @name IKnowledgeBaseManager#loadEntries
 * @returns {Promise<void>}
 */

/**
 * 导入Excel文件
 * @function
 * @name IKnowledgeBaseManager#importFile
 * @param {File} file - Excel文件
 * @returns {Promise<void>}
 */

/**
 * 搜索翻译条目
 * @function
 * @name IKnowledgeBaseManager#searchEntries
 * @param {string} searchTerm - 搜索关键词
 * @returns {Promise<Array<Object>>} - 翻译条目数组
 */

// 注意：这个文件只包含JSDoc类型定义，不包含实际代码
// 在JavaScript中，我们使用JSDoc注释来提供类型信息
