import { AccessToken } from 'livekit-server-sdk';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
    const room = req.nextUrl.searchParams.get('room');
    const username = req.nextUrl.searchParams.get('username');

    if (!room) {
        return NextResponse.json({ error: 'Missing "room" query parameter' }, { status: 400 });
    }
    if (!username) {
        return NextResponse.json({ error: 'Missing "username" query parameter' }, { status: 400 });
    }

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;
    const wsUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

    if (!apiKey || !apiSecret || !wsUrl) {
        return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
    }

    // Validate meeting exists in DB
    try {
        const { sql } = await import('@/lib/db');
        const result = await sql.query('SELECT id FROM meetings WHERE meeting_code = $1', [room]);
        if (result.rowCount === 0) {
            return NextResponse.json({ error: 'Meeting not found' }, { status: 404 });
        }
    } catch (e) {
        console.error("Error validating meeting:", e);
        // Fallback: In case DB is down, we might want to fail or allow.
        // For strict "must be saved on db", we fail.
        return NextResponse.json({ error: 'Database error validating meeting' }, { status: 500 });
    }

    const at = new AccessToken(apiKey, apiSecret, { identity: username });
    at.addGrant({ roomJoin: true, room: room, canPublish: true, canSubscribe: true });

    return NextResponse.json({ token: await at.toJwt() });
}
