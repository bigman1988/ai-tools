export interface SheetData {
    headerRows: string[][];
    rows: string[][];
}

export interface TranslationTask {
    text: string;
    targetLang: string;
    rowIndex: number;
    columnIndex: number;
    targetColumnIndex: number;
    langDisplay: string;
}

export interface TranslationBatch {
    tasks: TranslationTask[];
    batchId: number;
    totalCharCount: number;
    completed?: number;
    retries?: number;
    targetLang?: string;
    langDisplay?: string;
    success?: boolean;
}

export interface BatchProgress {
    completedBatches: number;
    totalBatches: number;
    currentBatchId: number;
    completedTasksInCurrentBatch: number;
    totalTasksInCurrentBatch: number;
}

export interface LanguageMapping {
    columnHeader: string;
    targetLang: string;
}

export interface SourceLanguageConfig {
    [key: string]: {
        label: string;
        apiCode: string;
    };
}

export interface TranslationResponse {
    choices: Array<{
        message: {
            content: string;
        };
    }>;
}

export interface ProgressData {
    current: number;
    total: number;
    text?: string;
}
