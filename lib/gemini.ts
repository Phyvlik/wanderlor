export interface GeminiLandmark {
  name: string;
  location: string;
  era: string;
  lat: number;
  lng: number;
  elevationMeters: number;
  description: string;
  setting: string;
  crisis: string;
  factionColor: string;
}

export async function searchLandmark(query: string): Promise<GeminiLandmark> {
  const res = await fetch('/api/gemini', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  const data = await res.json();

  if (!res.ok) {
    console.error('[searchLandmark] API error:', data);
    throw new Error(data.error || `HTTP ${res.status}`);
  }

  return data as GeminiLandmark;
}
