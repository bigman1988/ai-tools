/**
 * 语言工具类
 */
export class LanguageUtils {
    /**
     * 获取源语言列表
     * @returns {Array} - 源语言列表
     */
    static getSourceLanguages() {
        return ['Chinese', 'English'];
    }

    /**
     * 获取源语言配置
     * @returns {Object} - 源语言配置对象
     */
    static getSourceLanguageConfig() {
        return {
            'Chinese': 'Chinese',
            'English': 'English'
        };
    }

    /**
     * 获取语言映射
     * @returns {Array} - 语言映射数组
     */
    static getLanguageMappings() {
        return [
            { columnHeader: '英语', targetLang: 'English' },
            { columnHeader: '日语', targetLang: 'Japanese' },
            { columnHeader: '韩语', targetLang: 'Korean' },
            { columnHeader: '西班牙语', targetLang: 'Spanish' },
            { columnHeader: '法语', targetLang: 'French' },
            { columnHeader: '德语', targetLang: 'German' },
            { columnHeader: '俄语', targetLang: 'Russian' },
            { columnHeader: '泰语', targetLang: 'Thai' },
            { columnHeader: '意大利语', targetLang: 'Italian' },
            { columnHeader: '印尼语', targetLang: 'Indonesian' },
            { columnHeader: '葡萄牙语', targetLang: 'Portuguese' },
            { columnHeader: '越南语', targetLang: 'Vietnamese' }

        ];
    }

    /**
     * 获取语言显示名称
     * @param {string} langCode - 语言代码
     * @returns {string} - 语言显示名称
     */
    static getLanguageDisplayName(langCode) {
        // 简单返回语言代码，因为我们不再使用详细的映射
        return langCode;
    }

    /**
     * 获取API语言代码
     * @param {string} langCode - 语言代码
     * @returns {string} - API语言代码
     */
    static getApiLanguageCode(langCode) {
        // 将简写语言代码转换为API需要的全拼语言名称
        if (!langCode) return '';
        
        const languageCodeMap = {
            'zh': 'Chinese',
            'en': 'English',
            'ja': 'Japanese',
            'ko': 'Korean',
            'es': 'Spanish',
            'fr': 'French',
            'de': 'German',
            'ru': 'Russian',
            'th': 'Thai',
            'it': 'Italian',
            'id': 'Indonesian',
            'pt': 'Portuguese'
        };
        
        return languageCodeMap[langCode] || langCode;
    }

    /**
     * 根据列标题查找语言
     * @param {string} columnHeader - 列标题
     * @returns {string|null} - 语言代码或null
     */
    static findLanguageByColumnHeader(columnHeader) {
        if (!columnHeader) return null;
        
        const mappings = this.getLanguageMappings();
        for (const mapping of mappings) {
            if (mapping.columnHeader === columnHeader) {
                return mapping.targetLang;
            }
        }
        
        // 特殊处理源语言
        if (columnHeader === '简体中文' || columnHeader === '中文') {
            return 'Chinese';
        }
        
        return null;
    }
}
