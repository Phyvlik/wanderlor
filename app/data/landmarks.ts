// app/data/landmarks.ts
export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  height: number;
  baseDifficulty: number;
  historicalContext: string;
}

export const landmarkRegistry: Landmark[] = [
  {
    id: "colosseum_rome",
    name: "The Colosseum",
    lat: 41.8902,
    lng: 12.4922,
    height: 100,
    baseDifficulty: 3,
    historicalContext: "Built in 80 AD under Emperor Titus. Hosted gladiatorial combats, mock sea battles, and dramatic executions."
  },
  {
    id: "eiffel_tower_paris",
    name: "The Eiffel Tower",
    lat: 48.8584,
    lng: 2.2945,
    height: 100,
    baseDifficulty: 2,
    historicalContext: "Constructed in 1889 for the World's Fair. Initially criticized by French artists, it became a global cultural icon and radio transmitter."
  },
  {
    id: "tokyo_tower_japan",
    name: "Tokyo Tower",
    lat: 35.6586,
    lng: 139.7454,
    height: 100,
    baseDifficulty: 2,
    historicalContext: "Built in 1958. A communications and observation tower inspired by the Eiffel Tower, symbolizing post-war rebirth."
  }
];