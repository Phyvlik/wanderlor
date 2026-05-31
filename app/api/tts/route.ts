// app/api/tts/route.ts
import { NextResponse } from 'next/server';

// Adam — deep professional male voice, works for most historical characters
const VOICE_ID = 'pNInz6obpgDQGcFmaJgB';

export async function POST(request: Request) {
  try {
    const { text } = await request.json();
    if (!text?.trim()) return NextResponse.json({ error: 'No text' }, { status: 400 });

    const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICE_ID}`, {
      method: 'POST',
      headers: {
        'Accept': 'audio/mpeg',
        'Content-Type': 'application/json',
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
      },
      body: JSON.stringify({
        text: text.slice(0, 500),
        model_id: 'eleven_turbo_v2_5',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.0,
          use_speaker_boost: true,
        },
      }),
    });

    if (!res.ok) {
      console.error('[ElevenLabs]', res.status, await res.text());
      return NextResponse.json({ error: 'TTS failed' }, { status: 502 });
    }

    const audio = await res.arrayBuffer();
    return new NextResponse(audio, {
      headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('[TTS route]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
