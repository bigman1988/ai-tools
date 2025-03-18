import { DatabaseService, TranslationEntry, databaseService } from './database';

export interface SearchResult {
    entry: TranslationEntry;
    score?: number;
}

export class KnowledgeBaseService {
    private dbService: DatabaseService;

    constructor(dbService: DatabaseService) {
        this.dbService = dbService;
    }

    async initialize(): Promise<void> {
        try {
            await this.dbService.initializeDatabase();
            console.log('Knowledge base service initialized successfully');
        } catch (error) {
            console.error('Error initializing knowledge base service:', error);
            throw error;
        }
    }

    async addEntry(entry: TranslationEntry): Promise<number> {
        try {
            // Add to database
            const id = await this.dbService.addEntry(entry);
            return id;
        } catch (error) {
            console.error('Error adding entry to knowledge base:', error);
            throw error;
        }
    }

    async bulkImport(entries: TranslationEntry[]): Promise<number> {
        try {
            // Add entries to database
            const affectedRows = await this.dbService.bulkImport(entries);
            return affectedRows;
        } catch (error) {
            console.error('Error bulk importing entries to knowledge base:', error);
            throw error;
        }
    }

    async searchByText(
        text: string, 
        limit: number = 10
    ): Promise<TranslationEntry[]> {
        try {
            // Simple text search in database
            const entries = await this.dbService.getEntries(text, limit);
            return entries;
        } catch (error) {
            console.error('Error searching knowledge base by text:', error);
            throw error;
        }
    }

    async getEntries(
        searchTerm?: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<TranslationEntry[]> {
        return this.dbService.getEntries(searchTerm, limit, offset);
    }

    async updateEntry(id: number, entry: Partial<TranslationEntry>): Promise<boolean> {
        try {
            const updated = await this.dbService.updateEntry(id, entry);
            return updated;
        } catch (error) {
            console.error('Error updating entry in knowledge base:', error);
            throw error;
        }
    }

    async deleteEntry(id: number): Promise<boolean> {
        try {
            const deleted = await this.dbService.deleteEntry(id);
            return deleted;
        } catch (error) {
            console.error('Error deleting entry from knowledge base:', error);
            throw error;
        }
    }
}

export const knowledgeBaseService = new KnowledgeBaseService(databaseService);
