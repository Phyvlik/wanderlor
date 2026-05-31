// app/utils/prompts.ts
import { landmarkRegistry } from '../data/landmarks';

export function buildSnowflakePrompt(landmarkId: string, playerFaction: string): string {
  const landmark = landmarkRegistry.find(l => l.id === landmarkId);
  const context = landmark ? landmark.historicalContext : "A historic landmark location.";
  const locationName = landmark ? landmark.name : "Unknown Anomaly";
  
  return `You are the Game Master for WanderLore RPG. 
  The player belonging to the ${playerFaction} faction has breached a temporal anomaly at ${locationName}.
  Historical Context to incorporate: ${context}
  Generate a short, tense scenario.
  Respond ONLY with a valid JSON object matching this exact structure, with no markdown formatting:
  {
    "title": "String",
    "storyDescription": "String (max 3 sentences)",
    "choices": ["String", "String"]
  }`;
}