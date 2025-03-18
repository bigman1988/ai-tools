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

// 知识库管理器接口
export interface IKnowledgeBaseManager {
    loadEntries(searchTerm?: string): Promise<void>;
    log(message: string, type: 'info' | 'error'): void;
}
