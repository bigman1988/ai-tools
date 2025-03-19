import { TranslationEntry } from '../services/database';

// 语言字段类型定义
export interface LanguageField {
    key: string;
    label: string;
}

// 模态框配置类型
export interface ModalConfig {
    title: string;
    isEditing: boolean;
    entry?: TranslationEntry;
}

/**
 * 知识库管理器接口
 */
export interface IKnowledgeBaseManager {
    /**
     * 记录日志
     * @param message 日志消息
     * @param type 日志类型
     */
    log(message: string, type?: 'info' | 'warning' | 'error'): void;

    /**
     * 加载翻译条目
     */
    loadEntries(): Promise<void>;

    /**
     * 导入Excel文件
     * @param file Excel文件
     */
    importFile(file: File): Promise<void>;

    /**
     * 搜索翻译条目
     * @param searchTerm 搜索关键词
     */
    searchEntries(searchTerm: string): Promise<TranslationEntry[]>;
}
