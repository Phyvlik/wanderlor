// app/api/resolve/route.ts
import { NextResponse } from 'next/server';
import { setLandmarkOwner } from '../../utils/backboard';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log(`[Backend Ping]: Auto-claiming ${body.landmarkId} for ${body.playerFaction}...`);

    // 1. Instant 100% Win! Write to the database.
    await setLandmarkOwner(body.landmarkId, body.playerFaction);

    // 2. Return the success payload
    const responsePayload = {
      success: true,
      resultText: "You stabilized the anomaly and successfully anchored this territory to your timeline.",
      mapUpdate: {
        landmarkId: body.landmarkId,
        newFactionOwner: body.playerFaction, 
        colorHex: "#00E5FF" // Turns the pin Cyan for the player
      }
    };

    return NextResponse.json(responsePayload, { status: 200 });

  } catch (error) {
    console.error("[Backend Error]:", error);
    return NextResponse.json({ error: "Failed to resolve encounter" }, { status: 500 });
  }
}