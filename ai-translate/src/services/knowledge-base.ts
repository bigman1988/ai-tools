import { DatabaseService, KnowledgeBaseEntry, databaseService } from './database';
import { VectorStoreService, vectorStoreService } from './vector-store';

export interface SearchResult {
    entry: KnowledgeBaseEntry;
    score?: number;
}

export class KnowledgeBaseService {
    private dbService: DatabaseService;
    private vectorService: VectorStoreService;

    constructor(dbService: DatabaseService, vectorService: VectorStoreService) {
        this.dbService = dbService;
        this.vectorService = vectorService;
    }

    async initialize(): Promise<void> {
        try {
            await this.dbService.initializeDatabase();
            await this.vectorService.initializeCollection();
            console.log('Knowledge base service initialized successfully');
        } catch (error) {
            console.error('Error initializing knowledge base service:', error);
            throw error;
        }
    }

    async addEntry(entry: KnowledgeBaseEntry): Promise<number> {
        try {
            // Add to database first
            const id = await this.dbService.addEntry(entry);
            
            // Generate embedding and add to vector store
            const vector = await this.vectorService.getEmbeddingFromText(entry.source_text);
            await this.vectorService.addVector({
                id,
                vector,
                payload: {
                    source_text: entry.source_text,
                    target_text: entry.target_text,
                    source_language: entry.source_language,
                    target_language: entry.target_language
                }
            });
            
            return id;
        } catch (error) {
            console.error('Error adding entry to knowledge base:', error);
            throw error;
        }
    }

    async bulkImport(entries: KnowledgeBaseEntry[]): Promise<number> {
        try {
            // Add entries to database
            const affectedRows = await this.dbService.bulkImport(entries);
            
            // Get all entries to ensure we have the IDs
            const allEntries = await this.dbService.getEntries(
                entries[0]?.source_language,
                entries[0]?.target_language,
                undefined,
                entries.length * 2
            );
            
            // Generate embeddings and add to vector store
            const vectorEntries = await Promise.all(
                allEntries.map(async (entry) => {
                    const vector = await this.vectorService.getEmbeddingFromText(entry.source_text);
                    return {
                        id: entry.id!,
                        vector,
                        payload: {
                            source_text: entry.source_text,
                            target_text: entry.target_text,
                            source_language: entry.source_language,
                            target_language: entry.target_language
                        }
                    };
                })
            );
            
            await this.vectorService.bulkAddVectors(vectorEntries);
            
            return affectedRows;
        } catch (error) {
            console.error('Error bulk importing entries to knowledge base:', error);
            throw error;
        }
    }

    async searchByText(
        text: string, 
        sourceLang?: string, 
        targetLang?: string,
        limit: number = 10
    ): Promise<SearchResult[]> {
        try {
            // Generate embedding for the search text
            const vector = await this.vectorService.getEmbeddingFromText(text);
            
            // Search in vector store
            const similarResults = await this.vectorService.searchSimilar(vector, limit);
            
            // Get the full entries from the database
            const ids = similarResults.map(result => Number(result.id));
            
            if (ids.length === 0) {
                return [];
            }
            
            // Fetch entries from database based on IDs
            const entries = await this.dbService.getEntries(sourceLang, targetLang);
            const filteredEntries = entries.filter(entry => ids.includes(entry.id!));
            
            // Combine with similarity scores
            return filteredEntries.map(entry => {
                const similarResult = similarResults.find(r => Number(r.id) === entry.id);
                return {
                    entry,
                    score: similarResult?.score
                };
            }).sort((a, b) => (b.score || 0) - (a.score || 0));
        } catch (error) {
            console.error('Error searching knowledge base by text:', error);
            throw error;
        }
    }

    async getEntries(
        sourceLang?: string, 
        targetLang?: string, 
        searchTerm?: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<KnowledgeBaseEntry[]> {
        return this.dbService.getEntries(sourceLang, targetLang, searchTerm, limit, offset);
    }

    async updateEntry(id: number, entry: Partial<KnowledgeBaseEntry>): Promise<boolean> {
        try {
            const updated = await this.dbService.updateEntry(id, entry);
            
            if (updated && (entry.source_text || entry.target_text)) {
                // Get the full entry to update the vector store
                const entries = await this.dbService.getEntries();
                const fullEntry = entries.find(e => e.id === id);
                
                if (fullEntry) {
                    const vector = await this.vectorService.getEmbeddingFromText(fullEntry.source_text);
                    await this.vectorService.addVector({
                        id,
                        vector,
                        payload: {
                            source_text: fullEntry.source_text,
                            target_text: fullEntry.target_text,
                            source_language: fullEntry.source_language,
                            target_language: fullEntry.target_language
                        }
                    });
                }
            }
            
            return updated;
        } catch (error) {
            console.error('Error updating entry in knowledge base:', error);
            throw error;
        }
    }

    async deleteEntry(id: number): Promise<boolean> {
        try {
            const deleted = await this.dbService.deleteEntry(id);
            
            if (deleted) {
                await this.vectorService.deleteVector(id);
            }
            
            return deleted;
        } catch (error) {
            console.error('Error deleting entry from knowledge base:', error);
            throw error;
        }
    }
}

export const knowledgeBaseService = new KnowledgeBaseService(databaseService, vectorStoreService);
