// app/api/resolve/route.ts
import { NextResponse } from 'next/server';
import { getLandmarkOwner, setLandmarkOwner } from '../../utils/backboard';
export async function POST(request: Request) {
  try {
    // 1. Parse the player's choice
    const body = await request.json();
    console.log(`[Backend Ping]: Resolving choice '${body.choiceId}' at ${body.landmarkId}...`);

    // 2. Mock Game Logic (70% chance to win)
    const isSuccess = Math.random() > 0.3; 
    
    // 3. Check Backboard for the current owner
    const currentOwner = await getLandmarkOwner(body.landmarkId);
    let finalOwner = currentOwner;

    // 4. WRITE TO BACKBOARD: If they win, overwrite the database with their faction
    if (isSuccess) {
      await setLandmarkOwner(body.landmarkId, body.playerFaction);
      finalOwner = body.playerFaction;
      console.log(`[Backboard Update]: ${body.landmarkId} captured by ${finalOwner}!`);
    }

    // 5. Format the response contract
    const responsePayload = {
      success: isSuccess,
      resultText: isSuccess 
        ? "Your quick thinking pays off. The anomaly stabilizes, and the timeline is secure. You have claimed this territory."
        : "You hesitate. The guards overpower you, and the anomaly fractures further before you are violently thrown back to your own time.",
      mapUpdate: {
        landmarkId: body.landmarkId,
        newFactionOwner: finalOwner, // Sends the live state back to the UI map
        colorHex: isSuccess ? "#00E5FF" : "#FF0044"
      }
    };

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error("[Backend Error]:", error);
    return NextResponse.json({ error: "Failed to resolve encounter" }, { status: 500 });
  }
}