import { NextRequest, NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function POST(req: NextRequest) {
    try {
        const { meetingCode, roomId } = await req.json();

        if (!meetingCode || !roomId) {
            return NextResponse.json({ error: 'Missing meetingCode or roomId' }, { status: 400 });
        }

        // Ensure table exists on first run (lazy init)
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

        // Insert new meeting record
        const result = await sql.query(
            'INSERT INTO meetings (meeting_code, room_id) VALUES ($1, $2) RETURNING id',
            [meetingCode, roomId]
        );

        return NextResponse.json({ success: true, id: result.rows[0].id });
    } catch (error: any) {
        console.error('Error creating meeting:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function PATCH(req: NextRequest) {
    try {
        const { meetingCode, durationSeconds } = await req.json();

        if (!meetingCode) {
            return NextResponse.json({ error: 'Missing meetingCode' }, { status: 400 });
        }

        // Update the existing meeting record to mark as ended
        // Let's rely on meeting_code for now and assume we close the most recent open one.
        const result = await sql.query(`
      UPDATE meetings 
      SET ended_at = CURRENT_TIMESTAMP, duration_seconds = $2 
      WHERE id = (
        SELECT id FROM meetings 
        WHERE meeting_code = $1 
        ORDER BY created_at DESC 
        LIMIT 1
      )
    `, [meetingCode, durationSeconds || 0]);

        return NextResponse.json({ success: true, updated: result.rowCount });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
