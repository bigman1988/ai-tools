import { QdrantClient } from '@qdrant/js-client-rest';
import fetch from 'node-fetch';

export interface VectorEntry {
    id: string;  
    vector: number[];
    payload?: Record<string, any>;
}

export class VectorStoreService {
    private client: QdrantClient;
    private collectionName: string = 'translation_kb';
    private vectorSize: number = 768; 
    private ollamaUrl: string;

    constructor() {
        this.client = new QdrantClient({
            url: process.env.QDRANT_URL || 'http://localhost:6333',
        });
        this.ollamaUrl = process.env.OLLAMA_URL || 'http://localhost:11434';
    }

    async initializeCollection(): Promise<void> {
        try {
            const collections = await this.client.getCollections();
            const exists = collections.collections.some(c => c.name === this.collectionName);

            if (!exists) {
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

    async deleteVector(id: string): Promise<void> {
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
        try {
            const response = await fetch(`${this.ollamaUrl}/api/embeddings`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'nomic-embed-text',
                    prompt: text,
                }),
            });

            if (!response.ok) {
                throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            return data.embedding;
        } catch (error) {
            console.error('Error getting text embedding vector:', error);
            throw error;
        }
    }

    async searchSimilarByText(text: string, limit: number = 10): Promise<any[]> {
        try {
            const vector = await this.getEmbeddingFromText(text);
            return await this.searchSimilar(vector, limit);
        } catch (error) {
            console.error('Error searching similar vectors by text:', error);
            throw error;
        }
    }
}

export const vectorStoreService = new VectorStoreService();
