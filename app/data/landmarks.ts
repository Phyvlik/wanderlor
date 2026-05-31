export interface Landmark {
  id: string;
  name: string;
  lat: number;
  lng: number;
  height: number;
  elevation?: number;
  baseDifficulty: number;
  era: string;
  setting: string;
  figures: string[];
  crisis: string;
}

export const landmarkRegistry: Landmark[] = [
  {
    id: "colosseum_rome",
    name: "The Colosseum",
    lat: 41.8902,
    lng: 12.4922,
    height: 100,
    baseDifficulty: 3,
    era: "80 AD, opening games under Emperor Titus",
    setting: "The roaring arena floor of the Flavian Amphitheatre, sand stained red, 50,000 Romans screaming from the stands. The hypogeum tunnels rumble beneath you as caged lions are hoisted upward.",
    figures: ["Emperor Titus in the imperial box", "the champion gladiator Carpophorus who has slain 20 beasts today", "the Vestal Virgins whose thumbs decide fate"],
    crisis: "The crowd has turned on a fallen gladiator — a secret Chronoguard informant carrying critical intel hidden inside his belt. If the lions are released before you reach him, the intel is lost forever."
  },
  {
    id: "eiffel_tower_paris",
    name: "The Eiffel Tower",
    lat: 48.8584,
    lng: 2.2945,
    height: 100,
    baseDifficulty: 2,
    era: "March 1889, three weeks before the World's Fair opening",
    setting: "The half-finished iron lattice of the Eiffel Tower, 300 meters of riveted steel swaying in a Paris spring wind. Workers in flat caps scramble on the upper platforms. The Seine glitters below. Gustave Eiffel himself is on site.",
    figures: ["Gustave Eiffel, the engineer, reviewing blueprints on the first platform", "Guy de Maupassant, who has vowed to eat lunch here every day just to avoid looking at it", "a Prussian spy posing as a riveter"],
    crisis: "You have 10 minutes before the Prussian spy destroys the telegraph transmitter at the top — the same transmitter that will intercept German troop movements in WWI 25 years from now, saving Paris."
  },
  {
    id: "tokyo_tower_japan",
    name: "Tokyo Tower",
    lat: 35.6586,
    lng: 139.7454,
    height: 100,
    baseDifficulty: 2,
    era: "December 1958, the night of Tokyo Tower's inauguration",
    setting: "The observation deck of the newly opened Tokyo Tower, painted in international orange and white, blazing over a city rebuilding itself from ash. Mount Fuji is visible at dusk. The broadcast antennas above you are being activated for the first time.",
    figures: ["Chief engineer Naito Tachū, who designed the tower to survive typhoons", "a US occupation-era officer refusing to leave his post", "Empress Kōjun watching from the Imperial Palace"],
    crisis: "The broadcast signal about to go live has been secretly encoded with a destabilizing frequency that will cause a cascade blackout across Japan's recovery infrastructure — someone sabotaged it during construction and only you know."
  }
];
