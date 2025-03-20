/**
 * 语言工具类
 */
export class LanguageUtils {
    /**
     * 获取语言映射
     * @returns {Object} - 语言映射对象
     */
    static getLanguageMappings() {
        return {
            'zh': { name: '简体中文', apiCode: 'zh-CN', columnHeaders: ['简体中文', '中文'] },
            'en': { name: '英语', apiCode: 'en-US', columnHeaders: ['英语', '英文', 'English'] },
            'ja': { name: '日语', apiCode: 'ja-JP', columnHeaders: ['日语', '日文', 'Japanese'] },
            'ko': { name: '韩语', apiCode: 'ko-KR', columnHeaders: ['韩语', '韩文', 'Korean'] },
            'es': { name: '西班牙语', apiCode: 'es-ES', columnHeaders: ['西班牙语', 'Spanish'] },
            'fr': { name: '法语', apiCode: 'fr-FR', columnHeaders: ['法语', '法文', 'French'] },
            'de': { name: '德语', apiCode: 'de-DE', columnHeaders: ['德语', '德文', 'German'] },
            'ru': { name: '俄语', apiCode: 'ru-RU', columnHeaders: ['俄语', '俄文', 'Russian'] },
            'th': { name: '泰语', apiCode: 'th-TH', columnHeaders: ['泰语', '泰文', 'Thai'] },
            'it': { name: '意大利语', apiCode: 'it-IT', columnHeaders: ['意大利语', 'Italian'] },
            'id': { name: '印尼语', apiCode: 'id-ID', columnHeaders: ['印尼语', '印度尼西亚语', 'Indonesian'] },
            'pt': { name: '葡萄牙语', apiCode: 'pt-PT', columnHeaders: ['葡萄牙语', 'Portuguese'] }
        };
    }

    /**
     * 获取语言选项
     * @returns {Array} - 语言选项数组
     */
    static getLanguageOptions() {
        const mappings = this.getLanguageMappings();
        return Object.entries(mappings).map(([code, info]) => ({
            code,
            name: info.name,
            apiCode: info.apiCode
        }));
    }

    /**
     * 获取语言显示名称
     * @param {string} langCode - 语言代码
     * @returns {string} - 语言显示名称
     */
    static getLanguageDisplayName(langCode) {
        const mappings = this.getLanguageMappings();
        return mappings[langCode]?.name || langCode;
    }

    /**
     * 获取API语言代码
     * @param {string} langCode - 语言代码
     * @returns {string} - API语言代码
     */
    static getApiLanguageCode(langCode) {
        const mappings = this.getLanguageMappings();
        return mappings[langCode]?.apiCode || langCode;
    }

    /**
     * 根据列标题猜测语言
     * @param {string} columnHeader - 列标题
     * @returns {Object|null} - 语言信息或null
     */
    static guessLanguageFromColumnHeader(columnHeader) {
        if (!columnHeader) return null;
        
        const mappings = this.getLanguageMappings();
        
        // 转换为小写进行比较
        const normalizedHeader = columnHeader.trim().toLowerCase();
        
        for (const [langCode, info] of Object.entries(mappings)) {
            // 检查列标题是否匹配任何已知语言的列标题
            const matchesHeader = info.columnHeaders.some(header => 
                normalizedHeader === header.toLowerCase()
            );
            
            if (matchesHeader) {
                return {
                    langCode,
                    apiCode: info.apiCode,
                    name: info.name
                };
            }
        }
        
        return null;
    }
}
