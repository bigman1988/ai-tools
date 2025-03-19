import mysql from 'mysql2/promise';

// 翻译条目的类型定义
export interface TranslationEntry {
    Chinese: string;
    English: string;
    Japanese: string;
    Korean: string;
    Spanish: string;
    French: string;
    German: string;
    Russian: string;
    Thai: string;
    Italian: string;
    Indonesian: string;
    Portuguese: string;
    vector_id?: string;
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
            // Create translate-cn table if it doesn't exist
            await this.pool.execute(`
                CREATE TABLE IF NOT EXISTS \`translate-cn\` (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    Chinese TEXT,
                    English TEXT,
                    Japanese TEXT,
                    Korean TEXT,
                    Spanish TEXT,
                    French TEXT,
                    German TEXT,
                    Russian TEXT,
                    Thai TEXT,
                    Italian TEXT,
                    Indonesian TEXT,
                    Portuguese TEXT,
                    vector_id TEXT,
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

    async addEntry(entry: TranslationEntry): Promise<number> {
        try {
            const [result] = await this.pool.execute(
                'INSERT INTO `translate-cn` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [
                    entry.Chinese,
                    entry.English,
                    entry.Japanese,
                    entry.Korean,
                    entry.Spanish,
                    entry.French,
                    entry.German,
                    entry.Russian,
                    entry.Thai,
                    entry.Italian,
                    entry.Indonesian,
                    entry.Portuguese,
                    entry.vector_id || ''
                ]
            );
            return (result as mysql.ResultSetHeader).insertId;
        } catch (error) {
            console.error('Error adding entry to translation table:', error);
            throw error;
        }
    }

    async getEntries(
        searchTerm?: string,
        limit: number = 100,
        offset: number = 0
    ): Promise<TranslationEntry[]> {
        try {
            let query = 'SELECT * FROM `translate-cn` WHERE 1=1';
            const params: any[] = [];

            if (searchTerm) {
                query += ' AND (Chinese LIKE ? OR English LIKE ? OR Japanese LIKE ? OR Korean LIKE ? OR Spanish LIKE ? OR French LIKE ? OR German LIKE ? OR Russian LIKE ? OR Thai LIKE ? OR Italian LIKE ? OR Indonesian LIKE ? OR Portuguese LIKE ?)';
                const searchPattern = `%${searchTerm}%`;
                params.push(
                    searchPattern, searchPattern, searchPattern, searchPattern,
                    searchPattern, searchPattern, searchPattern, searchPattern,
                    searchPattern, searchPattern, searchPattern, searchPattern
                );
            }

            query += ' ORDER BY id DESC LIMIT ? OFFSET ?';
            params.push(limit, offset);

            const [rows] = await this.pool.execute(query, params);
            return rows as TranslationEntry[];
        } catch (error) {
            console.error('Error getting entries from translation table:', error);
            throw error;
        }
    }

    async updateEntry(id: number, entry: Partial<TranslationEntry>): Promise<boolean> {
        try {
            const fields: string[] = [];
            const values: any[] = [];

            const columns = [
                'Chinese', 'English', 'Japanese', 'Korean', 'Spanish', 'French',
                'German', 'Russian', 'Thai', 'Italian', 'Indonesian', 'Portuguese', 'vector_id'
            ];

            for (const column of columns) {
                if (entry[column as keyof TranslationEntry] !== undefined) {
                    fields.push(`${column} = ?`);
                    values.push(entry[column as keyof TranslationEntry]);
                }
            }

            if (fields.length === 0) {
                return false;
            }

            values.push(id);

            const [result] = await this.pool.execute(
                `UPDATE \`translate-cn\` SET ${fields.join(', ')} WHERE id = ?`,
                values
            );

            return (result as mysql.ResultSetHeader).affectedRows > 0;
        } catch (error) {
            console.error('Error updating entry in translation table:', error);
            throw error;
        }
    }

    async deleteEntry(id: number): Promise<boolean> {
        try {
            const [result] = await this.pool.execute(
                'DELETE FROM `translate-cn` WHERE id = ?',
                [id]
            );
            return (result as mysql.ResultSetHeader).affectedRows > 0;
        } catch (error) {
            console.error('Error deleting entry from translation table:', error);
            throw error;
        }
    }

    async bulkImport(entries: TranslationEntry[]): Promise<number> {
        try {
            if (entries.length === 0) {
                return 0;
            }

            const placeholders = entries.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
            const values = entries.flatMap(entry => [
                entry.Chinese,
                entry.English,
                entry.Japanese,
                entry.Korean,
                entry.Spanish,
                entry.French,
                entry.German,
                entry.Russian,
                entry.Thai,
                entry.Italian,
                entry.Indonesian,
                entry.Portuguese,
                entry.vector_id || ''
            ]);

            const [result] = await this.pool.execute(
                `INSERT INTO \`translate-cn\` (Chinese, English, Japanese, Korean, Spanish, French, German, Russian, Thai, Italian, Indonesian, Portuguese, vector_id) VALUES ${placeholders}`,
                values
            );

            return (result as mysql.ResultSetHeader).affectedRows;
        } catch (error) {
            console.error('Error bulk importing entries to translation table:', error);
            throw error;
        }
    }

    async close(): Promise<void> {
        await this.pool.end();
    }
}

export const databaseService = new DatabaseService();
