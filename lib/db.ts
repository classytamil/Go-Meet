import { Pool, neonConfig } from '@neondatabase/serverless';

if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not defined');
}

neonConfig.fetchConnectionCache = true;

const sql = new Pool({ connectionString: process.env.DATABASE_URL });

export async function createMeetingsTable() {
    try {
        await sql.query(`
      CREATE TABLE IF NOT EXISTS meetings (
        id SERIAL PRIMARY KEY,
        meeting_code VARCHAR(255) NOT NULL,
        room_id VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        ended_at TIMESTAMP,
        duration_seconds INTEGER DEFAULT 0
      );
    `);
        console.log('Meetings table ensured.');
    } catch (error) {
        console.error('Error creating meetings table:', error);
    }
}

export { sql };
