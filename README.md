# WanderLore

**The world is the battlefield. Rewrite history, one landmark at a time.**

WanderLore is a real-world multiplayer RPG where players fly over photorealistic 3D cities powered by Google Maps, discover historical landmarks, and battle for faction control through AI-generated story encounters grounded in real history.

---

## What Was Built

### Core Game Loop
- Players select a mission from the landing page (or search any landmark in the world via Gemini AI)
- The game deploys them to that real-world location using Google Maps Photorealistic 3D Tiles via CesiumJS
- Players navigate the 3D environment using WASD + mouse look
- Clicking the red anomaly marker triggers a historically-grounded AI encounter story
- Players choose an action, the outcome is resolved, and the landmark is claimed for their faction

### Landing Page
- Split-screen layout: mission list on the left, interactive 3D Earth globe on the right
- Globe built with react-globe.gl using NASA dark Earth texture, country polygon borders, and auto-rotation
- Captured countries highlight in gold (player) or red (enemy) on the globe
- GSAP entrance animations on every menu load

### AI Story Generation
- Encounter prompts use Snowflake Cortex (llama3-8b) via Snowflake SDK
- Each landmark has a richly defined historical era, setting, key figures, and a specific crisis
- The prompt forces the AI to name real historical figures, use real sensory details, and avoid generic phrases
- Gemini-discovered landmarks pass their AI-generated context directly to the encounter engine

### Gemini Landmark Search
- Search bar powered by Gemini 2.5 Flash (server-side, key never exposed to browser)
- Any real-world location or historical site can be searched
- Gemini returns name, coordinates, elevation, historical era, vivid setting, specific crisis, and faction color
- New landmarks animate in as mission cards and appear as pins on the 3D globe
- Camera height uses real elevation data so high-altitude locations (Machu Picchu, Great Wall) spawn correctly

### Persistence
- Faction ownership and discovered landmarks persist across sessions via localStorage
- Background sync to Backboard API threads for cross-device persistence
- Thread ID stored in localStorage, full state retrieved on mount

### 3D Map (Cesium)
- Google Photorealistic 3D Tiles for real-world city rendering
- WASD movement with height-relative speed
- FPS mouse look via Pointer Lock API with software crosshair overlay
- Red anomaly pins placed at exact coordinates, disappear to back hemisphere
- Pointer lock: click empty ground to lock, Escape to release, click red pin to trigger encounter

### Faction System
- Landmark ownership tracked per session and synced to Backboard
- Resolve API: 70% win chance, updates faction owner on success
- Globe highlights captured countries in real time when returning to landing

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript) |
| 3D Map | CesiumJS 1.114 + Google Photorealistic 3D Tiles |
| Globe Visualization | react-globe.gl + three-globe (NASA dark Earth texture) |
| AI Story Generation | Snowflake Cortex (llama3-8b via Snowflake SDK) |
| Landmark Discovery | Gemini 2.5 Flash (Google Generative AI) |
| Persistence | Backboard API (threads as state store) + localStorage |
| Animations | GSAP 3 |
| Styling | Tailwind CSS v4 |
| Font | Cinzel Decorative (Google Fonts) |

---

## Environment Variables

Create a `.env.local` file in the project root:

```
SNOWFLAKE_ACCOUNT=your_account
SNOWFLAKE_USERNAME=your_username
SNOWFLAKE_PASSWORD=your_password
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_api_key
BACKBOARD_API_KEY=your_backboard_key
GEMINI_API_KEY=your_gemini_key
```

**Important:** `GEMINI_API_KEY` and `BACKBOARD_API_KEY` must NOT use the `NEXT_PUBLIC_` prefix. Both are called server-side via API routes to keep keys out of the browser bundle.

---

## Getting Started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Project Structure

```
app/
  api/
    encounter/route.ts     AI encounter generation via Snowflake Cortex
    resolve/route.ts       Choice resolution + faction capture
    gemini/route.ts        Landmark search via Gemini 2.5 Flash
    gamestate/route.ts     Backboard sync for faction + discovered landmarks
  data/landmarks.ts        Static landmark definitions (era, setting, figures, crisis)
  utils/
    backboard.ts           Backboard API client
    prompts.ts             Snowflake Cortex prompt builders
  page.tsx                 Main game HUD + state machine
  layout.tsx               Loads CesiumJS, Cinzel font
components/
  MapLayer.tsx             CesiumJS viewer, WASD, pointer lock, anomaly pins
  Globe3D.tsx              react-globe.gl Earth with country highlights
lib/
  gemini.ts                Gemini landmark search (calls /api/gemini)
```

---

## What Still Needs Work

- [ ] Real multiplayer: player positions synced via WebSocket so multiple players share the same globe state live
- [ ] ElevenLabs voice narration: the SDK is installed but not wired up. Encounter story text could be read aloud on arrival
- [ ] More landmarks: the static registry only has 3. Could pre-seed 20-30 famous landmarks
- [ ] Player profiles: currently hardcoded as `demo_user_1 / Chronoguard`. Add auth and multiple factions
- [ ] Faction colors on Cesium map: after capturing a landmark, recolor the Cesium anomaly pin to faction color (partially done)
- [ ] Mobile support: pointer lock and WASD do not translate well to touch
- [ ] Encounter result narration: the resolve API returns static text. Could use Snowflake or Gemini to generate dynamic outcome text based on the choice made
- [ ] Leaderboard: faction ownership scores across all players

---

## Demo Flow for Judges

1. Open the landing page and observe the rotating Earth with landmark pins
2. Search "Angkor Wat" in the search bar and watch Gemini add it as a new mission card
3. Select "The Eiffel Tower" and deploy to Paris in photorealistic 3D
4. Navigate to the red pin, click it, read the AI-generated 1889 story encounter
5. Make a choice, win the territory, return to landing
6. Watch France highlight gold on the globe
