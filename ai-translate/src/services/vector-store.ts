import { QdrantClient } from '@qdrant/js-client-rest';

export interface VectorEntry {
    id: number;
    vector: number[];
    payload?: Record<string, any>;
}

export class VectorStoreService {
    private client: QdrantClient;
    private collectionName: string = 'translation_kb';
    private vectorSize: number = 384; // Default for many embedding models

    constructor() {
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
        });
    }

    async initializeCollection(): Promise<void> {
        try {
            // Check if collection exists
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === this.collectionName);

            if (!exists) {
                // Create collection if it doesn't exist
                await this.client.createCollection(this.collectionName, {
                    vectors: {
                        size: this.vectorSize,
                        distance: 'Cosine',
                    },
                });
                console.log(`Collection ${this.collectionName} created successfully`);
            } else {
                console.log(`Collection ${this.collectionName} already exists`);
            }
        } catch (error) {
            console.error('Error initializing vector collection:', error);
            throw error;
        }
    }

    async addVector(entry: VectorEntry): Promise<void> {
        try {
            await this.client.upsert(this.collectionName, {
                points: [
                    {
                        id: entry.id,
                        vector: entry.vector,
                        payload: entry.payload || {},
                    },
                ],
            });
        } catch (error) {
            console.error('Error adding vector to collection:', error);
            throw error;
        }
    }

    async bulkAddVectors(entries: VectorEntry[]): Promise<void> {
        try {
            if (entries.length === 0) return;

            await this.client.upsert(this.collectionName, {
                points: entries.map(entry => ({
                    id: entry.id,
                    vector: entry.vector,
                    payload: entry.payload || {},
                })),
            });
        } catch (error) {
            console.error('Error bulk adding vectors to collection:', error);
            throw error;
        }
    }

    async searchSimilar(vector: number[], limit: number = 10): Promise<any[]> {
        try {
            const result = await this.client.search(this.collectionName, {
                vector: vector,
                limit: limit,
                with_payload: true,
            });
            
            return result.map(hit => ({
                id: hit.id,
                score: hit.score,
                payload: hit.payload,
            }));
        } catch (error) {
            console.error('Error searching similar vectors:', error);
            throw error;
        }
    }

    async deleteVector(id: number): Promise<void> {
        try {
            await this.client.delete(this.collectionName, {
                points: [id],
            });
        } catch (error) {
            console.error('Error deleting vector from collection:', error);
            throw error;
        }
    }

    async getEmbeddingFromText(text: string): Promise<number[]> {
        // This is a placeholder. In a real application, you would use an embedding model
        // like OpenAI's text-embedding-ada-002 or a local model to generate embeddings.
        // For now, we'll just return a random vector of the correct size
        return Array.from({ length: this.vectorSize }, () => Math.random() - 0.5);
    }
}

export const vectorStoreService = new VectorStoreService();
