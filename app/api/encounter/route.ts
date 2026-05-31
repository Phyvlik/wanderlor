// app/api/encounter/route.ts
import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';
import { getLandmarkOwner } from '../../utils/backboard';
import { buildSnowflakePrompt } from '../../utils/prompts';
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
        const ampm = h >= 12 ? 'PM' : 'AM';
        localTime = `${h % 12 || 12}:${String(m).padStart(2, '0')} ${ampm}`;
      } catch {}
    }

    return { localTime, weather };
  } catch {
    return { localTime: 'Unknown Time', weather: 'unstable' };
  }
}

const generateEncounterWithSnowflake = (landmark: any, faction: string, environment: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
      account: process.env.SNOWFLAKE_ACCOUNT || '',
      username: process.env.SNOWFLAKE_USERNAME || '',
      password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err, conn) => {
      if (err) return reject(`Connection failed: ${err.message}`);

      const systemPrompt = buildSnowflakePrompt(
        landmark.name, faction, landmark.era, landmark.setting, landmark.figures || [], landmark.crisis, environment
      );
      const safePrompt = systemPrompt.replace(/'/g, "''");

      const sqlText = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            'llama3-8b',
            [
                {'role': 'system', 'content': '${safePrompt}'},
                {'role': 'user', 'content': 'Generate the lateral thinking puzzle.'}
            ],
            {'temperature': 0.7}
        ) as AI_RESPONSE;
      `;

      connection.execute({
        sqlText,
        complete: (err, stmt, rows) => {
          if (err) return reject(`Query failed: ${err.message}`);
          if (!rows || rows.length === 0) return reject("No data returned.");

          try {
            const cortexResponse = rows[0].AI_RESPONSE;
            let rawString = typeof cortexResponse === 'string' ? cortexResponse : JSON.stringify(cortexResponse);
            rawString = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBrace = rawString.indexOf('{');
            const lastBrace = rawString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
              rawString = rawString.substring(firstBrace, lastBrace + 1);
            }
            const aiData = JSON.parse(rawString);
            const portraitUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(aiData.characterName || 'Unknown')}`;
            resolve({
              characterName: aiData.characterName || "Unknown Entity",
              characterPersona: aiData.characterPersona || "Glitching",
              puzzleBeginning: aiData.puzzleBeginning || "The timeline is fractured.",
              puzzleEnd: aiData.puzzleEnd || "You must repair it.",
              secretTruth: aiData.secretTruth || "You need to guess the password.",
              portraitUrl,
            });
          } catch (error) {
            reject(error);
          }
        }
      });
    });
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log(`[Backend Ping]: Generating puzzle for ${body.landmarkName}...`);

    // Build a landmark object — either from the static registry or from Gemini custom context
    let landmarkObj: any;
    const registryEntry = landmarkRegistry.find(l => l.id === body.landmarkId);

    if (registryEntry) {
      landmarkObj = registryEntry;
    } else if (body.customContext) {
      // Gemini-discovered landmark: construct a compatible object
      landmarkObj = {
        name: body.landmarkName,
        era: body.customContext.era,
        setting: body.customContext.setting,
        figures: body.customContext.figures || [],
        crisis: body.customContext.crisis,
        lat: body.lat,
        lng: body.lng,
      };
    } else {
      return NextResponse.json({ error: 'Landmark not found' }, { status: 404 });
    }

    // Use pre-fetched atmosphere from client if available, otherwise fetch live
    let environment: { localTime: string; weather: string };
    if (body.atmosphere?.localTime) {
      environment = { localTime: body.atmosphere.localTime, weather: body.atmosphere.weather || 'clear' };
    } else if (landmarkObj.lat && landmarkObj.lng) {
      environment = await getLiveEnvironment(landmarkObj.lat, landmarkObj.lng);
    } else {
      environment = { localTime: "Unknown Time", weather: "unstable" };
    }

    const aiEncounterData = await generateEncounterWithSnowflake(landmarkObj, body.playerState?.faction || "Chronoguard", environment);
    const liveFactionOwner = await getLandmarkOwner(body.landmarkId);

    return NextResponse.json({
      ...aiEncounterData,
      factionOwner: liveFactionOwner,
    }, { status: 200 });

  } catch (error) {
    console.error("[Backend Error]:", error);
    return NextResponse.json({ error: "Failed to process encounter" }, { status: 500 });
  }
}
