// app/api/encounter/route.ts
import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';
import { getLandmarkOwner } from '../../utils/backboard';
import { buildSnowflakePrompt } from '../../utils/prompts';
import { landmarkRegistry } from '../../data/landmarks';

// --- NEW: Helper to get Live Environment Data ---
async function getLiveEnvironment(lat: number, lng: number) {
  try {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY;
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 1. Fetch exact Time Zone for the landmark
    const timeRes = await fetch(`https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${timestamp}&key=${apiKey}`);
    const timeData = await timeRes.json();
    
    // Calculate local hour (0-23)
    const localTimestamp = timestamp + (timeData.dstOffset || 0) + (timeData.rawOffset || 0);
    const localDate = new Date(localTimestamp * 1000);
    const localTime = localDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'UTC' });

    // 2. Mocking weather for now (Replace with your specific Weather API endpoint if needed)
    const weather = "cloudy with a strange atmospheric pressure"; 

    return { localTime, weather };
  } catch (e) {
    console.error("Environment fetch failed, using fallbacks.");
    return { localTime: "Unknown Time", weather: "unstable" };
  }
}

// --- UPDATED: Pass environment to Snowflake ---
const generateEncounterWithSnowflake = (landmark: any, faction: string, environment: any): Promise<any> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT || '',
        username: process.env.SNOWFLAKE_USERNAME || '',
        password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err, conn) => {
      if (err) return reject(`Connection failed: ${err.message}`);

      // Pass the live environment data into the prompt builder!
      const systemPrompt = buildSnowflakePrompt(
          landmark.name, faction, landmark.era, landmark.setting, landmark.figures, landmark.crisis, environment
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
                portraitUrl: portraitUrl
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

    const landmarkData = landmarkRegistry.find(l => l.id === body.landmarkId);
    if (!landmarkData) throw new Error("Landmark not found in registry.");

    // Fetch the live environment data using the landmark's coordinates!
    const liveEnvironment = await getLiveEnvironment(landmarkData.lat, landmarkData.lng);

    const aiEncounterData = await generateEncounterWithSnowflake(landmarkData, body.playerState?.faction || "Chronoguard", liveEnvironment);
    const liveFactionOwner = await getLandmarkOwner(body.landmarkId);

    return NextResponse.json({
      ...aiEncounterData,
      factionOwner: liveFactionOwner 
    }, { status: 200 });

  } catch (error) {
    console.error("[Backend Error]:", error);
    return NextResponse.json({ error: "Failed to process encounter" }, { status: 500 });
  }
}