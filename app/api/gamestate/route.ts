import { NextResponse } from 'next/server';

const BB = 'https://app.backboard.io/api';
const KEY = process.env.BACKBOARD_API_KEY!;
const HEADERS = { 'X-API-Key': KEY, 'Content-Type': 'application/json' };
const PREFIX = 'WANDERLORE_STATE:';

// GET /api/gamestate?threadId=xxx  — returns { factionMap, discoveredLandmarks, threadId }
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const threadId = searchParams.get('threadId');

  if (!threadId) return NextResponse.json({ factionMap: {}, discoveredLandmarks: [] });

  try {
    const res = await fetch(`${BB}/threads/${threadId}`, { headers: HEADERS });
    if (!res.ok) return NextResponse.json({ factionMap: {}, discoveredLandmarks: [] });

    const data = await res.json();
    const messages: any[] = data.messages ?? [];

    // Find the latest user message that contains our state snapshot
    const stateMsg = [...messages]
      .reverse()
      .find((m: any) => m.role === 'user' && typeof m.content === 'string' && m.content.startsWith(PREFIX));

    if (!stateMsg) return NextResponse.json({ factionMap: {}, discoveredLandmarks: [] });

    const state = JSON.parse(stateMsg.content.slice(PREFIX.length));
    return NextResponse.json({ ...state, threadId });
  } catch (e) {
    console.error('[gamestate GET]', e);
    return NextResponse.json({ factionMap: {}, discoveredLandmarks: [] });
  }
}

// POST /api/gamestate  body: { threadId?, factionMap, discoveredLandmarks }
// Returns { threadId }
export async function POST(req: Request) {
  try {
    const { threadId, factionMap, discoveredLandmarks } = await req.json();

    const payload: any = {
      content: PREFIX + JSON.stringify({ factionMap, discoveredLandmarks }),
    };
    if (threadId) payload.thread_id = threadId;

    const res = await fetch(`${BB}/threads/messages`, {
      method: 'POST',
      headers: HEADERS,
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    return NextResponse.json({ threadId: data.thread_id });
  } catch (e) {
    console.error('[gamestate POST]', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
