// app/api/encounter/route.ts
import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';
import { getLandmarkOwner } from '../../utils/backboard';
import { landmarkRegistry } from '../../data/landmarks';

// Unified Prompt Engine for both Default and Gemini-Searched locations
const generatePrompt = (name: string, faction: string, era: string, setting: string, crisis: string) => `
  You are a historical figure or entity caught in a temporal anomaly at ${name}.
  Era: ${era}
  Setting: ${setting}
  Crisis: ${crisis}
  
  Your task is to greet the player (a ${faction} operative) in character.
  Keep it under 3 sentences. React to the crisis and the setting.
  
  You MUST output ONLY valid JSON. No markdown formatting. No extra text.
  
  {
    "characterName": "Your historical name (e.g., Gustave Eiffel, Local Guide)",
    "characterPersona": "Your current mood",
    "puzzleBeginning": "Your dialogue greeting the player",
    "puzzleEnd": "",
    "secretTruth": ""
  }
`;

const generateEncounterWithSnowflake = (name: string, era: string, setting: string, crisis: string, faction: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT || '',
        username: process.env.SNOWFLAKE_USERNAME || '',
        password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err, conn) => {
      if (err) return reject(`Connection failed: ${err.message}`);

      const safePrompt = generatePrompt(name, faction, era, setting, crisis).replace(/'/g, "''");

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
        complete: (err, stmt, rows) => {
          if (err) return reject(err);
          if (!rows || rows.length === 0) return reject("No data returned from Snowflake.");
          try {
            let rawString = rows[0].AI_RESPONSE;
            if (typeof rawString !== 'string') {
              rawString = rawString?.choices?.[0]?.messages || rawString?.choices?.[0]?.message?.content || JSON.stringify(rawString);
            }
            
            // Aggressively strip markdown out of Llama-3's response
            rawString = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();
            const firstBrace = rawString.indexOf('{');
            const lastBrace = rawString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                rawString = rawString.substring(firstBrace, lastBrace + 1);
            }

            const aiData = JSON.parse(rawString);
            
            // Generate dynamic portrait based on the AI's chosen character name
            const portraitUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(aiData.characterName || 'Unknown')}`;

            resolve({
                characterName: aiData.characterName || "Time Warden",
                characterPersona: aiData.characterPersona || "Cautious",
                puzzleBeginning: aiData.puzzleBeginning || "Greetings, traveler. The timeline is unstable here, but we will hold the line.",
                puzzleEnd: "",
                secretTruth: "",
                portraitUrl: portraitUrl
            });
          } catch (error) {
            console.error("JSON Parse Error. AI output was too messy to parse.");
            resolve({
                characterName: "Temporal Glitch",
                characterPersona: "Corrupted",
                puzzleBeginning: "ERROR: Anomaly too strong. I cannot hold physical form... but the territory is exposed.",
                puzzleEnd: "",
                secretTruth: "",
                portraitUrl: "https://api.dicebear.com/7.x/bottts/svg?seed=glitch"
            });
          }
        }
      });
    });
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    let name = body.landmarkName;
    let era = "Unknown Era";
    let setting = "A swirling vortex of time.";
    let crisis = "The fabric of reality is tearing.";

    // Unify data handling: Use Gemini context if it exists, otherwise use Registry
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
        }
    }

    const aiEncounterData = await generateEncounterWithSnowflake(
        name, era, setting, crisis, body.playerState?.faction || "Chronoguard"
    );
    
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