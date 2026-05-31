// types.ts
export interface LandmarkEncounterRequest {
  landmarkId: string;
  landmarkName: string;
  playerState: {
    playerId: string;
    faction: string;
    level: number;
  };
}

export interface LandmarkEncounterResponse {
  title: string;
  storyDescription: string;
  choices: string[];
  difficultyRating: number;
  factionOwner: string;
}