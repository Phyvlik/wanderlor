import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';
import { getLandmarkOwner } from '../../utils/backboard';
import { landmarkRegistry } from '../../data/landmarks';

async function getLiveEnvironment(lat: number, lng: number) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    const timestamp = Math.floor(Date.now() / 1000);
    const [weatherRes, tzRes] = await Promise.allSettled([
      fetch(`https://wttr.in/${lat},${lng}?format=j1`, {
        headers: { 'User-Agent': 'WanderLore/1.0' },
        signal: AbortSignal.timeout(4000),
      }).then(r => r.json()),
      fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`, {
        signal: AbortSignal.timeout(4000),
      }).then(r => r.json()),
    ]);
    let weather = 'unstable atmospheric conditions';
    if (weatherRes.status === 'fulfilled') {
      try { weather = weatherRes.value.current_condition[0].weatherDesc[0].value; } catch {}
    }
    let localTime = 'Unknown Time';
    if (tzRes.status === 'fulfilled' && tzRes.value.status === 'OK') {
      try {
        const tz = tzRes.value;
        const localTs = timestamp + (tz.rawOffset || 0) + (tz.dstOffset || 0);
        const d = new Date(localTs * 1000);
        const h = d.getUTCHours(), m = d.getUTCMinutes();
        localTime = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
      } catch {}
    }
    return { localTime, weather };
  } catch {
    return { localTime: 'Unknown Time', weather: 'unstable' };
  }
}

const generatePrompt = (name: string, faction: string, era: string, setting: string, crisis: string, localTime: string, weather: string) => `
  You are a historical figure or entity caught in a temporal anomaly at ${name}.
  Era: ${era}
  Setting: ${setting}
  Crisis: ${crisis}
  Current time at this location: ${localTime}. Weather: ${weather}.

  Your task is to greet the player (a ${faction} operative) in character.
  Keep it under 3 sentences. React to the crisis, the setting, the time, and weather.

  You MUST output ONLY valid JSON. No markdown formatting. No extra text.

  {
    "characterName": "Your historical name (e.g., Gustave Eiffel, Local Guide)",
    "characterPersona": "Your current mood",
    "puzzleBeginning": "Your dialogue greeting the player",
    "puzzleEnd": "",
    "secretTruth": ""
  }
`;

const generateEncounterWithSnowflake = (name: string, era: string, setting: string, crisis: string, faction: string, localTime: string, weather: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT || '',
      username: process.env.SNOWFLAKE_USERNAME || '',
      password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err) => {
      if (err) return reject(`Connection failed: ${err.message}`);

      const safePrompt = generatePrompt(name, faction, era, setting, crisis, localTime, weather).replace(/'/g, "''");

      const sqlText = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            'llama3-8b',
            [
                {'role': 'system', 'content': '${safePrompt}'},
                {'role': 'user', 'content': 'Generate the JSON encounter.'}
            ],
            {'temperature': 0.7}
        ) as AI_RESPONSE;
      `;

      connection.execute({
        sqlText,
        complete: (err, _stmt, rows) => {
          if (err) return reject(err);
          if (!rows || rows.length === 0) return reject('No data returned from Snowflake.');
          try {
            let rawString = rows[0].AI_RESPONSE;
            if (typeof rawString !== 'string') {
              rawString = rawString?.choices?.[0]?.messages || rawString?.choices?.[0]?.message?.content || JSON.stringify(rawString);
            }
            rawString = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBrace = rawString.indexOf('{');
            const lastBrace = rawString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) rawString = rawString.substring(firstBrace, lastBrace + 1);

            const aiData = JSON.parse(rawString);
            const portraitUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(aiData.characterName || 'Unknown')}`;

            resolve({
              characterName: aiData.characterName || 'Time Warden',
              characterPersona: aiData.characterPersona || 'Cautious',
              puzzleBeginning: aiData.puzzleBeginning || 'Greetings, traveler. The timeline is unstable here, but we will hold the line.',
              puzzleEnd: '',
              secretTruth: '',
              portraitUrl,
            });
          } catch {
            resolve({
              characterName: 'Temporal Glitch',
              characterPersona: 'Corrupted',
              puzzleBeginning: 'ERROR: Anomaly too strong. I cannot hold physical form... but the territory is exposed.',
              puzzleEnd: '',
              secretTruth: '',
              portraitUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=glitch',
            });
          }
        },
      });
    });
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();

    let name = body.landmarkName;
    let era = 'Unknown Era';
    let setting = 'A swirling vortex of time.';
    let crisis = 'The fabric of reality is tearing.';
    let lat = body.lat;
    let lng = body.lng;

    if (body.customContext) {
      era = body.customContext.era || era;
      setting = body.customContext.setting || setting;
      crisis = body.customContext.crisis || crisis;
    } else {
      const landmarkData = landmarkRegistry.find(l => l.id === body.landmarkId);
      if (landmarkData) {
        era = landmarkData.era;
        setting = landmarkData.setting;
        crisis = landmarkData.crisis;
        lat = lat ?? landmarkData.lat;
        lng = lng ?? landmarkData.lng;
      }
    }

    let localTime = 'Unknown Time';
    let weather = 'unstable';
    if (body.atmosphere?.localTime) {
      localTime = body.atmosphere.localTime;
      weather = body.atmosphere.weather || 'clear';
    } else if (lat && lng) {
      const env = await getLiveEnvironment(lat, lng);
      localTime = env.localTime;
      weather = env.weather;
    }

    const aiEncounterData = await generateEncounterWithSnowflake(
      name, era, setting, crisis, body.playerState?.faction || 'Chronoguard', localTime, weather
    );

    const liveFactionOwner = await getLandmarkOwner(body.landmarkId);

    return NextResponse.json({ ...aiEncounterData, factionOwner: liveFactionOwner }, { status: 200 });
  } catch (error) {
    console.error('[Backend Error]:', error);
    return NextResponse.json({ error: 'Failed to process encounter' }, { status: 500 });
  }
}
