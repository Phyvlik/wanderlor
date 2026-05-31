// app/utils/prompts.ts

interface EnvironmentContext {
  localTime: string;
  weather: string;
}

export const buildSnowflakePrompt = (
  landmarkName: string,
  faction: string,
  era: string,
  setting: string,
  figures: string[],
  crisis: string,
  environmentContext: EnvironmentContext
): string => {
  const figuresList = figures.length > 0 ? figures[0] : 'a mysterious figure';
  const scene = setting.replace(/\n/g, ' ').slice(0, 200);
  const crisisShort = crisis.replace(/\n/g, ' ').slice(0, 150);

  return `You are ${figuresList} at ${landmarkName} (${era}). It is ${environmentContext.localTime}, weather: ${environmentContext.weather}. Crisis: ${crisisShort}. A ${faction} operative has appeared. Create a lateral thinking puzzle: give a mysterious situation (puzzleBeginning) and a strange outcome (puzzleEnd) that only makes sense with a hidden twist (secretTruth). Output ONLY valid JSON with no extra text: {"characterName":"${figuresList.split(',')[0].trim()}","characterPersona":"brief tone description","puzzleBeginning":"2-3 sentences of mysterious situation referencing the weather and time","puzzleEnd":"1-2 sentences of strange outcome","secretTruth":"the hidden logical explanation"}`;
};
