// app/api/resolve/route.ts
import { NextResponse } from 'next/server';
import snowflake from 'snowflake-sdk';
import { getLandmarkOwner, setLandmarkOwner } from '../../utils/backboard';

const evaluateGuessWithSnowflake = (guess: string, secretTruth: string): Promise<boolean> => {
  return new Promise((resolve, reject) => {
    const connection = snowflake.createConnection({
        account: process.env.SNOWFLAKE_ACCOUNT || '',
        username: process.env.SNOWFLAKE_USERNAME || '',
        password: process.env.SNOWFLAKE_PASSWORD || '',
    });

    connection.connect((err, conn) => {
      if (err) return reject(`Connection failed: ${err.message}`);

      const prompt = `
        You are an impartial judge for a Lateral Thinking Puzzle.
        The Secret Truth of the puzzle is: "${secretTruth}"
        The Player guessed: "${guess}"
        
        Does the player's guess capture the core logic or main concept of the Secret Truth? 
        It does not need to be exactly word-for-word, but the core deductive reasoning must be correct.
        
        Respond with exactly one word: TRUE if they are correct, FALSE if they are wrong.
      `;
      const safePrompt = prompt.replace(/'/g, "''");

      const sqlText = `
        SELECT SNOWFLAKE.CORTEX.COMPLETE(
            'llama3-8b', 
            [
                {'role': 'system', 'content': 'You are a strict logic judge. Respond ONLY with TRUE or FALSE.'},
                {'role': 'user', 'content': '${safePrompt}'}
            ],
            {'temperature': 0.1}
        ) as AI_RESPONSE;
      `;

      connection.execute({
        sqlText,
        complete: (err, stmt, rows) => {
          if (err) return reject(err);
          try {
             const response = rows[0].AI_RESPONSE.toString().trim().toUpperCase();
             resolve(response.includes("TRUE"));
          } catch (e) {
             resolve(false);
          }
        }
      });
    });
  });
};

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log(`[Backend Ping]: Evaluating guess at ${body.landmarkId}...`);

    // 1. Evaluate the guess using Snowflake
    const isSuccess = await evaluateGuessWithSnowflake(body.playerGuess, body.secretTruth);
    
    // 2. Check Backboard
    const currentOwner = await getLandmarkOwner(body.landmarkId);
    let finalOwner = currentOwner;

    // 3. Write to Backboard on Success
    if (isSuccess) {
      await setLandmarkOwner(body.landmarkId, body.playerFaction);
      finalOwner = body.playerFaction;
      console.log(`[Backboard Update]: ${body.landmarkId} captured!`);
    }

    const responsePayload = {
      success: isSuccess,
      resultText: isSuccess 
        ? `Correct! The truth is revealed: ${body.secretTruth}. The anomaly stabilizes. Territory claimed.`
        : "Incorrect. That is not the hidden truth. The anomaly fractures further. You are thrown back to your time.",
      mapUpdate: {
        landmarkId: body.landmarkId,
        newFactionOwner: finalOwner,
        colorHex: isSuccess ? "#00E5FF" : "#FF0044"
      }
    };

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error("[Backend Error]:", error);
    return NextResponse.json({ error: "Failed to resolve encounter" }, { status: 500 });
  }
}