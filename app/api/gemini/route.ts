import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function geocode(landmarkName: string): Promise<{ lat: number; lng: number; elevationMeters: number; formattedAddress: string } | null> {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
  if (!key) return null;
  try {
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(landmarkName)}&key=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const geoData = await geoRes.json();
    if (geoData.status !== 'OK' || !geoData.results?.[0]) return null;

    const { lat, lng } = geoData.results[0].geometry.location;
    const formattedAddress = geoData.results[0].formatted_address;

    const elevRes = await fetch(
      `https://maps.googleapis.com/maps/api/elevation/json?locations=${lat},${lng}&key=${key}`,
      { signal: AbortSignal.timeout(5000) }
    );
    const elevData = await elevRes.json();
    const elevationMeters = elevData.results?.[0]?.elevation ?? 50;

    return { lat, lng, elevationMeters: Math.round(elevationMeters), formattedAddress };
  } catch {
    return null;
  }
}

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
  "lat": latitude as a precise number (e.g. 48.8584),
  "lng": longitude as a precise number (e.g. 2.2945),
  "elevationMeters": ground elevation above sea level in meters (e.g. Machu Picchu=2430, Eiffel Tower=35, Everest Base Camp=5364),
  "description": "One dramatic sentence about why this place matters historically",
  "setting": "2-3 vivid sentences: what you see, hear, smell standing here at its most dramatic historical moment. Name one specific real historical figure present.",
  "crisis": "One urgent sentence: a specific crisis happening RIGHT NOW at this location that the player must resolve.",
  "factionColor": "exactly one of these three hex values: #FFB800 or #00E5FF or #FF4040"
}`;

    const [geminiResult, geocodeResult] = await Promise.all([
      model.generateContent(prompt),
      geocode(query.trim()),
    ]);

    let text = geminiResult.response.text().trim();
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const start = text.indexOf('{'), end = text.lastIndexOf('}');
    if (start === -1 || end === -1) {
      console.error('[Gemini] No JSON object found:', text);
      return NextResponse.json({ error: 'Gemini did not return valid JSON' }, { status: 502 });
    }
    const json = JSON.parse(text.slice(start, end + 1));

    const required = ['name', 'location', 'era', 'lat', 'lng', 'elevationMeters', 'description', 'setting', 'crisis', 'factionColor'];
    for (const key of required) {
      if (json[key] === undefined) {
        return NextResponse.json({ error: `Missing field: ${key}` }, { status: 502 });
      }
    }

    if (geocodeResult) {
      json.lat             = geocodeResult.lat;
      json.lng             = geocodeResult.lng;
      json.elevationMeters = geocodeResult.elevationMeters;
      json.location        = geocodeResult.formattedAddress;
      console.log(`[gemini] Coords verified by Google: ${geocodeResult.lat}, ${geocodeResult.lng}`);
    } else {
      console.log(`[gemini] Google geocoding unavailable, using Gemini coords: ${json.lat}, ${json.lng}`);
    }

    return NextResponse.json(json);
  } catch (err) {
    console.error('[Gemini route error]', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
