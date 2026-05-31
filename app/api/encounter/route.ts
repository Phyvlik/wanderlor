// app/api/encounter/route.ts
import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';
import type { LandmarkEncounterRequest, LandmarkEncounterResponse } from '../../../types';
import { getLandmarkOwner } from '../../utils/backboard';
import { buildSnowflakePrompt } from '../../utils/prompts';

const generateEncounterWithSnowflake = (landmarkId: string, faction: string): Promise<any> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT || '',
        username: process.env.SNOWFLAKE_USERNAME || '',
        password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err, conn) => {
      if (err) return reject(`Connection failed: ${err.message}`);

      // Generate the dynamic prompt from our utils file
      const systemPrompt = buildSnowflakePrompt(landmarkId, faction);
      const safePrompt = systemPrompt.replace(/'/g, "''");

      const sqlText = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            'llama3-8b', 
            [
                {'role': 'system', 'content': '${safePrompt}'},
                {'role': 'user', 'content': 'Generate the encounter.'}
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
            let rawString = "";
            
            if (typeof cortexResponse === 'string') {
                rawString = cortexResponse;
            } else if (cortexResponse?.choices?.[0]?.messages) {
                rawString = cortexResponse.choices[0].messages;
            } else if (cortexResponse?.choices?.[0]?.message?.content) {
                rawString = cortexResponse.choices[0].message.content;
            } else {
                rawString = JSON.stringify(cortexResponse); 
            }

            rawString = rawString.replace(/```json/gi, '').replace(/```/g, '').trim();

            const firstBrace = rawString.indexOf('{');
            const lastBrace = rawString.lastIndexOf('}');
            if (firstBrace !== -1 && lastBrace !== -1) {
                rawString = rawString.substring(firstBrace, lastBrace + 1);
            }

            const aiData = JSON.parse(rawString);
            
            if (!aiData.title) aiData.title = "Anomaly Detected";
            if (!aiData.storyDescription) aiData.storyDescription = "The timeline is unstable here.";
            if (!aiData.choices || !Array.isArray(aiData.choices)) aiData.choices = ["Investigate", "Retreat"];
            if (!aiData.factionOwner) aiData.factionOwner = "Unknown";
            
            resolve(aiData);
          } catch (error) {
            console.error("CRITICAL PARSE ERROR. Fallback triggered.");
            resolve({
                title: "Temporal Distortion",
                storyDescription: "The AI communication link was briefly severed by a temporal storm, but you are still in danger. Unidentified entities are approaching your position.",
                choices: ["Hold the line", "Fall back to a safer era"],
                factionOwner: "Unknown"
            });
          }
        }
      });
    });
  });
};

export async function POST(request: Request) {
  try {
    const body: LandmarkEncounterRequest = await request.json();
    console.log(`[Backend Ping]: Generating encounter for ${body.landmarkName}...`);

    // Note: We now pass the landmarkId to the prompt builder instead of just the name!
    const aiEncounterData = await generateEncounterWithSnowflake(body.landmarkId, body.playerState.faction);
    const liveFactionOwner = await getLandmarkOwner(body.landmarkId);

    const responsePayload: LandmarkEncounterResponse = {
      title: aiEncounterData.title,
      storyDescription: aiEncounterData.storyDescription,
      choices: aiEncounterData.choices,
      difficultyRating: Math.floor(Math.random() * 5) + 1,
      factionOwner: liveFactionOwner 
    };

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error("[Backend Error]:", error);
    return NextResponse.json({ error: "Failed to process encounter" }, { status: 500 });
  }
}