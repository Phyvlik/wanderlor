# WanderLore - Rewrite History, One Landmark at a Time

**QuackHacks 2026 Hackathon Project**
Built by **Vivek Patel** and **Aaron Wong**

---

## What is WanderLore?

WanderLore is a real-world multiplayer historical RPG layered on top of the actual planet. Search any landmark on Earth - the Eiffel Tower, Big Ben, the Colosseum, Machu Picchu - and get teleported there via photorealistic Google 3D Tiles. An AI-powered historical figure greets you, a crisis is unfolding, and you must resolve it to capture the territory for your faction.

Every discovery is minted as an NFT on Solana. Every territory is contested in real time with other players worldwide.

---

## Features

- **Search any landmark on Earth** - powered by Google Gemini 2.5 Flash. Type "Big Ben", "Angkor Wat", "Stonehenge" - WanderLore identifies the site, generates its historical context, and pins it on the globe.
- **Photorealistic 3D fly-to** - CesiumJS with Google Photorealistic 3D Tiles drops you at street level with a cinematic camera sweep. Real building geometry, real elevation data.
- **AI-generated historical encounters** - Snowflake Cortex (llama3-8b) generates a unique encounter at every landmark: a real historical figure, their current mood, and a crisis you must resolve through dialogue.
- **Real-time weather & timezone** - Encounter context is live. The AI knows the actual local time and weather at that landmark right now.
- **Faction territory capture** - Chronoguard vs rival factions. Every landmark on Earth is contested. Capture it and it shows your faction's color on every player's globe.
- **NFT minting on Solana Devnet** - Every discovered landmark can be minted as a unique NFT via Phantom wallet. Metadata stored permanently on Arweave via Irys.
- **Live multiplayer state** - Territory ownership synced in real time across all sessions via Backboard.
- **Text-to-speech narration** - Historical figure dialogue voiced by ElevenLabs.
- **Interactive globe** - Animated 3D globe (react-globe.gl / Three.js) shows all captured territories as glowing faction markers.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| 3D Globe | react-globe.gl, Three.js |
| 3D Map | CesiumJS + Google Photorealistic 3D Tiles |
| Landmark AI | Google Gemini 2.5 Flash |
| Encounter AI | Snowflake Cortex (llama3-8b) |
| Chat AI | Snowflake Cortex (llama3-8b) |
| Geocoding | Google Maps Geocoding API + Elevation API |
| Weather | wttr.in |
| Blockchain | Solana Devnet |
| Wallet | Phantom |
| NFT Storage | Arweave via Irys |
| NFT Standard | Metaplex Token Metadata |
| TTS | ElevenLabs |
| Multiplayer | Backboard |
| Deployment | DigitalOcean App Platform |
| Animations | GSAP |

---

## Architecture

```
User searches "Big Ben"
        │
        ▼
/api/gemini  ──── Gemini 2.5 Flash generates historical context (name, era, crisis, setting)
        │    ──── Google Geocoding API verifies exact coordinates + elevation in parallel
        │
        ▼
Globe pins the landmark → User clicks DEPLOY
        │
        ▼
CesiumJS flies camera to real 3D location
        │
        ▼
/api/encounter ── Snowflake Cortex generates character + opening dialogue
             ──── wttr.in + Google Timezone API adds live weather/time context
        │
        ▼
Player chats with historical figure ── /api/chat via Snowflake Cortex
        │
        ▼
Territory captured → synced to Backboard (multiplayer)
        │
        ▼
Player mints NFT → Metaplex on Solana Devnet, metadata on Arweave
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- A Phantom wallet browser extension (for NFT minting)
- API keys (see below)

### Installation

```bash
git clone https://github.com/Abulala1/wanderlor.git
cd wanderlor
npm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_gemini_api_key
SNOWFLAKE_ACCOUNT=your_snowflake_account
SNOWFLAKE_USERNAME=your_snowflake_username
SNOWFLAKE_PASSWORD=your_snowflake_password
ELEVENLABS_API_KEY=your_elevenlabs_key
BACKBOARD_API_KEY=your_backboard_key
NEXT_PUBLIC_GOOGLE_MAPS_KEY=your_google_maps_key
NEXT_PUBLIC_SOLANA_APP_PUBKEY=your_solana_pubkey
SOLANA_PRIVATE_KEY=[your,private,key,bytes]
```

### Run

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## How to Play

1. **Connect your Phantom wallet** using the Connect button
2. **Search any landmark** - type a name in the search bar and hit SCAN
3. **Select a mission** from your discovered list or the preset landmarks
4. **Click DEPLOY** to fly to the landmark in 3D
5. **Talk to the historical figure** - resolve their crisis through dialogue
6. **Capture the territory** for the Chronoguard faction
7. **Mint your discovery** as an NFT on Solana Devnet

---

## Prize Categories

- **Best Use of Snowflake**: AI encounter generation and real-time chat with historical figures powered entirely by Snowflake Cortex (llama3-8b)
- **Best Use of DigitalOcean**: Deployed on DigitalOcean App Platform
- **Best Use of Solana**: NFT minting for every landmark discovery, stored permanently on Arweave
- **Google Track**: Google Photorealistic 3D Tiles via CesiumJS for immersive landmark fly-to, Google Maps Geocoding API for verified real-world coordinates, and Google Elevation API for accurate camera positioning
- **Best Use of Gemini**: Google Gemini 2.5 Flash identifies and generates rich historical context (era, setting, crisis, faction) for any landmark on Earth from a natural language search query

---

## Team

| Name | Role |
|---|---|
| Vivek Patel | Full-stack development, 3D map integration, AI pipeline |
| Aaron Wong | Full-stack development, blockchain integration, game design |

---

*Built at QuackHacks 2026*
