/**
 * @typedef {Object} SheetData
 * @property {string[][]} headerRows - 表头行
 * @property {string[][]} rows - 数据行
 */

/**
 * @typedef {Object} TranslationTask
 * @property {string} text - 要翻译的文本
 * @property {string} targetLang - 目标语言代码
 * @property {number} rowIndex - 行索引
 * @property {number} columnIndex - 列索引
 * @property {number} targetColumnIndex - 目标列索引
 * @property {string} langDisplay - 语言显示名称
 */

/**
 * @typedef {Object} TranslationBatch
 * @property {TranslationTask[]} tasks - 翻译任务列表
 * @property {number} batchId - 批次ID
 * @property {number} totalCharCount - 总字符数
 * @property {number} [completed] - 已完成任务数
 * @property {number} [retries] - 重试次数
 * @property {string} [targetLang] - 目标语言代码
 * @property {string} [langDisplay] - 语言显示名称
 * @property {boolean} [success] - 是否成功
 */

/**
 * @typedef {Object} BatchProgress
 * @property {number} completedBatches - 已完成批次数
 * @property {number} totalBatches - 总批次数
 * @property {number} currentBatchId - 当前批次ID
 * @property {number} completedTasksInCurrentBatch - 当前批次已完成任务数
 * @property {number} totalTasksInCurrentBatch - 当前批次总任务数
 */

/**
 * @typedef {Object} LanguageMapping
 * @property {string} columnHeader - 列表头
 * @property {string} targetLang - 目标语言代码
 */

/**
 * @typedef {Object} SourceLanguageConfig
 * @property {Object} [key: string] - 语言配置
 * @property {string} [key: string].label - 语言标签
 * @property {string} [key: string].apiCode - API代码
 */

/**
 * @typedef {Object} TranslationResponse
 * @property {Array<{message: {content: string}}>} choices - 翻译结果
 */

/**
 * @typedef {Object} ProgressData
 * @property {number} current - 当前进度
 * @property {number} total - 总进度
 * @property {string} [text] - 进度文本
 */
