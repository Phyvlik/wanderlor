import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function POST(request: Request) {
  try {
    const { query } = await request.json();
    if (!query?.trim()) return NextResponse.json({ error: 'No query provided' }, { status: 400 });

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const prompt = `The user searched for "${query}". Identify the real-world landmark or historical site they mean.

Return ONLY a single valid JSON object. No markdown, no code fences, no explanation — just raw JSON:
{
  "name": "Official full landmark name",
  "location": "City, Country",
  "era": "Historical era · Year or century (e.g. Ming Dynasty · 1368 AD)",
  "lat": latitude as a number,
  "lng": longitude as a number,
  "elevationMeters": elevation of this landmark above sea level as a number in meters (e.g. Machu Picchu=2430, Eiffel Tower=35, Everest Base Camp=5364),
  "description": "One dramatic sentence about why this place matters historically",
  "setting": "2-3 vivid sentences: what you see, hear, smell standing here at its most dramatic historical moment. Name one specific real historical figure present.",
  "crisis": "One urgent sentence: a specific crisis happening RIGHT NOW at this location that the player must resolve.",
  "factionColor": "exactly one of these three hex values: #FFB800 or #00E5FF or #FF4040"
}`;

    const result = await model.generateContent(prompt);
    let text = result.response.text().trim();

    // Strip any markdown code fences
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();

    // Extract the first JSON object found
    const start = text.indexOf('{');
    const end   = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('[Gemini] No JSON object found in response:', text);
      return NextResponse.json({ error: 'Gemini did not return valid JSON' }, { status: 502 });
    }

    const json = JSON.parse(text.slice(start, end + 1));

    // Validate required fields
    const required = ['name','location','era','lat','lng','elevationMeters','description','setting','crisis','factionColor'];
    for (const key of required) {
      if (json[key] === undefined) {
        return NextResponse.json({ error: `Missing field: ${key}` }, { status: 502 });
      }
    }

    return NextResponse.json(json);
  } catch (err) {
    console.error('[Gemini route error]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
