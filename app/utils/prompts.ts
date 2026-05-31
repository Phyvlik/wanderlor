import { landmarkRegistry } from '../data/landmarks';

export function buildCustomPrompt(name: string, playerFaction: string, ctx: { era: string; setting: string; crisis: string }, atm?: AtmosphereContext): string {
  return `You are the Game Master for WanderLore, a real-world RPG where players fight over history at real landmarks.

LOCATION: ${name}
ERA: ${ctx.era}
SCENE: ${ctx.setting}
THE CRISIS: ${ctx.crisis}
PLAYER: A ${playerFaction} operative who just materialized here with 60 seconds to act.${atmosphereLine(atm)}

Write a gripping RPG encounter rooted in the specific details above. Make it feel like the player is actually standing there.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "title": "A punchy 4-6 word title referencing the specific location or era",
  "storyDescription": "2-3 tight sentences. Name at least one real figure. Describe what the player sees, hears, smells. End on an urgent decision point.",
  "choices": [
    "A bold direct action specific to this scene (max 12 words)",
    "A cunning indirect approach using the environment or a figure (max 12 words)"
  ]
}`;
}

interface AtmosphereContext {
  weather?: string;
  tempC?: string;
  localTime?: string;
  isDaytime?: boolean;
}

function atmosphereLine(atm?: AtmosphereContext): string {
  if (!atm?.weather && !atm?.localTime) return '';
  const parts: string[] = [];
  if (atm.weather) parts.push(`${atm.weather}${atm.tempC ? ` (${atm.tempC}C)` : ''}`);
  if (atm.localTime) parts.push(`local time ${atm.localTime} (${atm.isDaytime ? 'daylight' : 'night'})`);
  return `\nATMOSPHERE: ${parts.join(', ')}. Weave the weather and lighting naturally into your scenario.`;
}

export function buildSnowflakePrompt(landmarkId: string, playerFaction: string, atm?: AtmosphereContext): string {
  const landmark = landmarkRegistry.find(l => l.id === landmarkId);

  if (!landmark) {
    return `You are a Game Master for WanderLore RPG. A ${playerFaction} agent has arrived at an unknown anomaly site. Generate a short tense scenario. Respond ONLY with valid JSON, no markdown: {"title":"String","storyDescription":"String","choices":["String","String"]}`;
  }

  return `You are the Game Master for WanderLore, a real-world RPG where players fight over history at real landmarks.

LOCATION: ${landmark.name}
ERA: ${landmark.era}
SCENE: ${landmark.setting}
KEY FIGURES PRESENT: ${landmark.figures.join(' | ')}
THE CRISIS: ${landmark.crisis}
PLAYER: A ${playerFaction} operative who just materialized here with 60 seconds to act.${atmosphereLine(atm)}

Write a gripping RPG encounter rooted entirely in the specific details above. Use the real names, the real setting, and the real crisis. Do NOT use generic phrases like "temporal anomaly" or "timeline". Make it feel like the player is actually standing there.

Respond ONLY with valid JSON, no markdown, no extra text:
{
  "title": "A punchy 4-6 word title referencing the specific location or era",
  "storyDescription": "2-3 tight sentences. Name at least one real figure. Describe what the player sees, hears, smells. End on an urgent decision point.",
  "choices": [
    "A bold direct action specific to this scene (max 12 words)",
    "A cunning indirect approach using the environment or a figure (max 12 words)"
  ]
}`;
}
