// app/utils/backboard.ts

const BACKBOARD_URL = process.env.BACKBOARD_URL || "https://api.backboard.io"; 
const API_KEY = process.env.BACKBOARD_API_KEY;

export async function getLandmarkOwner(landmarkId: string): Promise<string> {
  try {
    const response = await fetch(`${BACKBOARD_URL}/${landmarkId}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` }
    });
    
    if (!response.ok) return "Unclaimed";
    
    const data = await response.json();
    return data.owner || "Unclaimed";
  } catch (error) {
    // SILENT FALLBACK: Prevent terminal spam if the API is offline
    console.warn(`⚠️ Backboard API unreachable. Defaulting ${landmarkId} to 'Unclaimed'.`);
    return "Unclaimed";
  }
}
// Update the owner when a player wins
export async function setLandmarkOwner(landmarkId: string, newFaction: string): Promise<boolean> {
  try {
    const response = await fetch(`${BACKBOARD_URL}/${landmarkId}`, {
      method: "POST",
      headers: { 
        "Authorization": `Bearer ${API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ owner: newFaction })
    });
    
    return response.ok;
  } catch (error) {
    console.error("[Backboard Write Error]", error);
    return false;
  }
}