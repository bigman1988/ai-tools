import mysql from 'mysql2/promise';

export interface KnowledgeBaseEntry {
    id?: number;
    source_text: string;
    target_text: string;
    source_language: string;
    target_language: string;
    created_at?: Date;
    updated_at?: Date;
}

export class DatabaseService {
    private pool: mysql.Pool;

    constructor() {
        this.pool = mysql.createPool({
            host: process.env.DB_HOST || 'localhost',
            user: process.env.DB_USER || 'root',
            password: process.env.DB_PASSWORD || '',
            database: process.env.DB_NAME || 'translation_kb',
            waitForConnections: true,
            connectionLimit: 10,
            queueLimit: 0
        });
    }

    async initializeDatabase(): Promise<void> {
        try {
            // Create knowledge_base table if it doesn't exist
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS knowledge_base (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    source_text TEXT NOT NULL,
                    target_text TEXT NOT NULL,
                    source_language VARCHAR(10) NOT NULL,
                    target_language VARCHAR(10) NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                )
            `);
            console.log('Database initialized successfully');
        } catch (error) {
            console.error('Error initializing database:', error);
            throw error;
        }
    }

    async addEntry(entry: KnowledgeBaseEntry): Promise<number> {
        try {
            const [result] = await this.pool.execute(
                'INSERT INTO knowledge_base (source_text, target_text, source_language, target_language) VALUES (?, ?, ?, ?)',
                [entry.source_text, entry.target_text, entry.source_language, entry.target_language]
            );
            return (result as mysql.ResultSetHeader).insertId;
        } catch (error) {
            console.error('Error adding entry to knowledge base:', error);
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
        try {
            let query = 'SELECT * FROM knowledge_base WHERE 1=1';
            const params: any[] = [];

            if (sourceLang) {
                query += ' AND source_language = ?';
                params.push(sourceLang);
            }

            if (targetLang) {
                query += ' AND target_language = ?';
                params.push(targetLang);
            }

            if (searchTerm) {
                query += ' AND (source_text LIKE ? OR target_text LIKE ?)';
                params.push(`%${searchTerm}%`, `%${searchTerm}%`);
            }

            query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const [rows] = await this.pool.execute(query, params);
            return rows as KnowledgeBaseEntry[];
        } catch (error) {
            console.error('Error getting entries from knowledge base:', error);
            throw error;
        }
    }

    async updateEntry(id: number, entry: Partial<KnowledgeBaseEntry>): Promise<boolean> {
        try {
            const fields: string[] = [];
            const values: any[] = [];

            if (entry.source_text !== undefined) {
                fields.push('source_text = ?');
                values.push(entry.source_text);
            }

            if (entry.target_text !== undefined) {
                fields.push('target_text = ?');
                values.push(entry.target_text);
            }

            if (entry.source_language !== undefined) {
                fields.push('source_language = ?');
                values.push(entry.source_language);
            }

            if (entry.target_language !== undefined) {
                fields.push('target_language = ?');
                values.push(entry.target_language);
            }

            if (fields.length === 0) {
                return false;
            }

            values.push(id);

            const [result] = await this.pool.execute(
                `UPDATE knowledge_base SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            return (result as mysql.ResultSetHeader).affectedRows > 0;
        } catch (error) {
            console.error('Error updating entry in knowledge base:', error);
            throw error;
        }
    }

    async deleteEntry(id: number): Promise<boolean> {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM knowledge_base WHERE id = ?',
                [id]
            );
            return (result as mysql.ResultSetHeader).affectedRows > 0;
        } catch (error) {
            console.error('Error deleting entry from knowledge base:', error);
            throw error;
        }
    }

    async bulkImport(entries: KnowledgeBaseEntry[]): Promise<number> {
        try {
            if (entries.length === 0) {
                return 0;
            }

            const placeholders = entries.map(() => '(?, ?, ?, ?)').join(', ');
            const values = entries.flatMap(entry => [
                entry.source_text,
                entry.target_text,
                entry.source_language,
                entry.target_language
            ]);

            const [result] = await this.pool.execute(
                `INSERT INTO knowledge_base (source_text, target_text, source_language, target_language) VALUES ${placeholders}`,
                values
            );

            return (result as mysql.ResultSetHeader).affectedRows;
        } catch (error) {
            console.error('Error bulk importing entries to knowledge base:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

export const databaseService = new DatabaseService();
