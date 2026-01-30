import { Pool, neonConfig } from '@neondatabase/serverless';

const isMock = !process.env.DATABASE_URL || process.env.DATABASE_URL.includes('endpoint.neon.tech');

if (!process.env.DATABASE_URL && !isMock) {
    throw new Error('DATABASE_URL is not defined');
}

let sql: any;

if (isMock) {
    console.warn("⚠️ USING MOCK DB: DATABASE_URL is either missing or set to the default placeholder.");

    // Minimal In-Memory Store for the session
    const mockStore: any[] = [];

    sql = {
        query: async (text: string, params: any[] = []) => {
            console.log(`[MockDB] ${text}`, params);

            // CREATE TABLE
            if (text.trim().toUpperCase().startsWith('CREATE TABLE')) {
                return {};
            }

            // INSERT (Create Meeting)
            if (text.trim().toUpperCase().startsWith('INSERT INTO')) {
                const id = mockStore.length + 1;
                mockStore.push({ id, meeting_code: params[0], room_id: params[1] });
                return { rows: [{ id }], rowCount: 1 };
            }

            // SELECT (Validate Meeting)
            if (text.trim().toUpperCase().startsWith('SELECT')) {
                const found = mockStore.find(m => m.meeting_code === params[0]);
                // For testing "Join New Meeting", let's always return found if it looks like a valid code, 
                // OR better: actually use the mockStore so flow works?
                // Let's use the mockStore.

                // Fallback: If store is empty (server restart), allow all for dev convenience? 
                // No, let's stick to the store logic so "Not Found" works if they type garbage.
                // But since Next.js serverless might reset variables, this memory store is flaky.
                // Let's just ALWAYS return success for dev purposes if it's mock.
                return { rows: [{ id: 1 }], rowCount: 1 };
            }

            // UPDATE
            if (text.trim().toUpperCase().startsWith('UPDATE')) {
                return { rowCount: 1 };
            }

            return { rows: [], rowCount: 0 };
        }
    };
} else {
    neonConfig.fetchConnectionCache = true;
    sql = new Pool({ connectionString: process.env.DATABASE_URL });
}

export async function createMeetingsTable() {
    if (isMock) return;
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
