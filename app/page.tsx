'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { gsap } from 'gsap';
import type { LandmarkEncounterResponse } from '../types';
import MapLayer from '../components/MapLayer';
import WalletConnect from '../components/WalletConnect';
import { landmarkRegistry, type Landmark } from './data/landmarks';
import { searchLandmark, type GeminiLandmark } from '../lib/gemini';

const Globe3D = dynamic(() => import('../components/Globe3D'), { ssr: false });

interface DiscoveredLandmark extends Landmark {
  geminiColor: string;
  location: string;
  description: string;
  elevation: number;
}
// Add this new interface
interface PuzzleEncounter {
  characterName: string;
  characterPersona: string;
  puzzleBeginning: string;
  puzzleEnd: string;
  secretTruth: string;
  portraitUrl: string;
  factionOwner: string;
}
/* ── Per-landmark personality ─────────────────────────────── */
const META: Record<string, { color: string; label: string; Icon: () => React.ReactElement }> = {
  colosseum_rome: {
    color: '#FFB800',
    label: 'ANCIENT ROME · 80 AD',
    Icon: () => (
      <svg viewBox="0 0 40 32" fill="none" className="w-10 h-8">
        <rect x="1" y="18" width="38" height="13" rx="1" fill="currentColor" opacity=".35" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="5" y="10" width="30" height="10" rx="1" fill="currentColor" opacity=".25" stroke="currentColor" strokeWidth="1.4"/>
        <rect x="10" y="3" width="20" height="9" rx="1" fill="currentColor" opacity=".2" stroke="currentColor" strokeWidth="1.4"/>
        {[8,15,25,32].map(x => <rect key={x} x={x} y="18" width="3" height="13" fill="currentColor" opacity=".7"/>)}
        {[13,19,25].map(x => <rect key={x} x={x} y="10" width="2.5" height="10" fill="currentColor" opacity=".55"/>)}
      </svg>
    ),
  },
  eiffel_tower_paris: {
    color: '#00E5FF',
    label: 'BELLE ÉPOQUE · 1889',
    Icon: () => (
      <svg viewBox="0 0 28 40" fill="none" className="w-7 h-10">
        <polygon points="14,1 4,28 10,28 8,40 20,40 18,28 24,28" fill="currentColor" opacity=".3" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <line x1="14" y1="1" x2="4" y2="28" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="14" y1="1" x2="24" y2="28" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="7" y1="18" x2="21" y2="18" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="5.5" y1="24" x2="22.5" y2="24" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="9" y1="34" x2="19" y2="34" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    ),
  },
  tokyo_tower_japan: {
    color: '#FF4040',
    label: 'SHŌWA ERA · 1958',
    Icon: () => (
      <svg viewBox="0 0 28 44" fill="none" className="w-7 h-11">
        <polygon points="14,0 5,30 11,30 9,44 19,44 17,30 23,30" fill="currentColor" opacity=".28" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/>
        <line x1="14" y1="0" x2="5" y2="30" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="14" y1="0" x2="23" y2="30" stroke="currentColor" strokeWidth="1.5"/>
        <line x1="7" y1="14" x2="21" y2="14" stroke="currentColor" strokeWidth="1.6"/>
        <line x1="6" y1="22" x2="22" y2="22" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="12" y="0" width="4" height="6" fill="currentColor" opacity=".85"/>
      </svg>
    ),
  },
};

/* ── Main component ─────────────────────────────────────── */
/* ── Weather visual overlay ──────────────────────────────── */
function WeatherOverlay({ atmosphere }: { atmosphere: { weather: any; timezone: any } | null }) {
  const particles = useMemo(() => Array.from({ length: 80 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 0.35 + Math.random() * 0.4,
    height: 10 + Math.random() * 14,
    size: 1 + Math.random() * 1.5,
  })), []);

  if (!atmosphere) return null;

  const { category, icon } = atmosphere.weather;
  const { isDaytime } = atmosphere.timezone;

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {/* Night tint */}
      {!isDaytime && (
        <div className="absolute inset-0" style={{ background: 'rgba(0,0,30,0.4)', mixBlendMode: 'multiply' }} />
      )}

      {/* Rain drops */}
      {(category === 'rain' || category === 'storm') && particles.slice(0, 80).map(p => (
        <div key={p.id} className="absolute" style={{
          left: `${p.left}%`, top: 0,
          width: '1.5px', height: `${p.height}px`,
          background: 'linear-gradient(to bottom, rgba(174,210,240,0.0), rgba(174,210,240,0.6))',
          animationName: 'rain-drop',
          animationDuration: `${p.duration}s`,
          animationDelay: `${p.delay}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }} />
      ))}

      {/* Lightning flash for storms */}
      {category === 'storm' && (
        <div className="absolute inset-0" style={{
          background: 'rgba(200,220,255,0.12)',
          animationName: 'lightning',
          animationDuration: '4s',
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
          animationDelay: `${Math.random() * 3}s`,
        }} />
      )}

      {/* Snowflakes */}
      {category === 'snow' && particles.slice(0, 50).map(p => (
        <div key={p.id} className="absolute rounded-full" style={{
          left: `${p.left}%`, top: 0,
          width: `${p.size}px`, height: `${p.size}px`,
          background: 'rgba(255,255,255,0.75)',
          animationName: 'snow-drift',
          animationDuration: `${2 + p.duration * 4}s`,
          animationDelay: `${p.delay * 2}s`,
          animationTimingFunction: 'linear',
          animationIterationCount: 'infinite',
        }} />
      ))}

      {/* Fog */}
      {category === 'fog' && (
        <div className="absolute inset-0" style={{
          background: 'rgba(180,190,200,0.18)',
          backdropFilter: 'blur(1.5px)',
          animationName: 'fog-drift',
          animationDuration: '8s',
          animationTimingFunction: 'ease-in-out',
          animationIterationCount: 'infinite',
        }} />
      )}

    </div>
  );
}

export default function GameHUD() {
  const [gameState, setGameState] = useState<'menu'|'flying'|'loading'|'encounter'|'resolving'|'result'>('menu');
  const [activeTarget, setActiveTarget] = useState<Landmark | null>(null);
  const [encounterData, setEncounterData] = useState<PuzzleEncounter | null>(null);
  const [resultData, setResultData]   = useState<any>(null);
  const [pinColor,   setPinColor]     = useState<string | undefined>(undefined);
  const [playerGuess, setPlayerGuess] = useState('');
  const [chatLog, setChatLog] = useState<{role: 'ai'|'player', text: string}[]>([]);
  const [isChatting, setIsChatting] = useState(false);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const [factionMap, setFactionMap]   = useState<Record<string,string>>({});
  const [atmosphere, setAtmosphere] = useState<{ weather: any; timezone: any } | null>(null);
  const [walletAddress,      setWalletAddress]      = useState('');
  const [nftMinting,         setNftMinting]         = useState<Set<string>>(new Set());
  const [nftResults,         setNftResults]         = useState<Record<string, { mint: string; explorerUrl: string }>>({});
  const [searchQuery,        setSearchQuery]        = useState('');
  const [isSearching,        setIsSearching]        = useState(false);
  const [searchError,        setSearchError]        = useState('');
  const [discoveredLandmarks, setDiscoveredLandmarks] = useState<DiscoveredLandmark[]>([]);

  const playerState = { playerId: 'demo_user_1', faction: 'Chronoguard', level: 5 };

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const leftPanelRef   = useRef<HTMLDivElement>(null);
  const rightPanelRef  = useRef<HTMLDivElement>(null);
  const discoveredRef  = useRef<HTMLDivElement>(null);
  const chatScrollRef  = useRef<HTMLDivElement>(null);

  /* Starfield */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const stars = Array.from({ length: 420 }, () => {
      const size = Math.random();
      return {
        x: Math.random(), y: Math.random(),
        r: size < 0.7 ? Math.random() * 0.8 + 0.2 : Math.random() * 1.6 + 0.8,
        o: size < 0.7 ? Math.random() * 0.5 + 0.25 : Math.random() * 0.4 + 0.55,
        color: Math.random() < 0.12 ? `rgba(180,220,255,` : Math.random() < 0.08 ? `rgba(255,220,180,` : `rgba(255,255,255,`,
      };
    });
    const draw = () => {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `${s.color}${s.o})`; ctx.fill();
      });
    };
    draw();
    window.addEventListener('resize', draw);
    return () => window.removeEventListener('resize', draw);
  }, []);

  /* ── Persist to localStorage + sync Backboard in background ── */
  const bbSyncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const syncToBackboard = (discovered: DiscoveredLandmark[], factions: Record<string,string>) => {
    // Debounce: wait 1s after last change before syncing
    if (bbSyncRef.current) clearTimeout(bbSyncRef.current);
    bbSyncRef.current = setTimeout(async () => {
      try {
        const threadId = localStorage.getItem('wl_thread_id') ?? undefined;
        const res = await fetch('/api/gamestate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ threadId, factionMap: factions, discoveredLandmarks: discovered }),
        });
        const data = await res.json();
        if (data.threadId) localStorage.setItem('wl_thread_id', data.threadId);
      } catch {}
    }, 1000);
  };

  useEffect(() => {
    try { localStorage.setItem('wl_discovered', JSON.stringify(discoveredLandmarks)); } catch {}
    syncToBackboard(discoveredLandmarks, factionMap);
  }, [discoveredLandmarks]);

  useEffect(() => {
    try { localStorage.setItem('wl_factions', JSON.stringify(factionMap)); } catch {}
    syncToBackboard(discoveredLandmarks, factionMap);
  }, [factionMap]);

  /* ── Hydration-safe localStorage load + Backboard sync ── */
  useEffect(() => {
    // Load local state first (runs only on client after hydration)
    try {
      const savedFactions = JSON.parse(localStorage.getItem('wl_factions') || '{}');
      if (Object.keys(savedFactions).length > 0) setFactionMap(savedFactions);
      const savedDiscovered = JSON.parse(localStorage.getItem('wl_discovered') || '[]');
      if (savedDiscovered.length > 0) setDiscoveredLandmarks(savedDiscovered);
    } catch {}

    // Then pull from Backboard to fill any gaps
    const threadId = localStorage.getItem('wl_thread_id');
    if (!threadId) return;
    fetch(`/api/gamestate?threadId=${threadId}`)
      .then(r => r.json())
      .then(data => {
        if (data.factionMap && Object.keys(data.factionMap).length > 0) {
          setFactionMap(data.factionMap);
          localStorage.setItem('wl_factions', JSON.stringify(data.factionMap));
        }
        if (data.discoveredLandmarks?.length > 0) {
          setDiscoveredLandmarks(data.discoveredLandmarks);
          localStorage.setItem('wl_discovered', JSON.stringify(data.discoveredLandmarks));
        }
      })
      .catch(() => {});
  }, []);

  /* Auto-scroll chat to bottom on new messages */
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTo({ top: chatScrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [chatLog]);

  /* GSAP entrance */
  useEffect(() => {
    if (gameState !== 'menu') return;
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo(leftPanelRef.current,  { opacity: 0, x: -40 }, { opacity: 1, x: 0, duration: 1 })
        .fromTo(rightPanelRef.current, { opacity: 0, scale: 0.92 }, { opacity: 1, scale: 1, duration: 1.1 }, '-=0.7')
        .fromTo(
          leftPanelRef.current ? Array.from(leftPanelRef.current.querySelectorAll('.mission-row')) : [],
          { opacity: 0, x: -24 }, { opacity: 1, x: 0, duration: 0.45, stagger: 0.12 }, '-=0.5'
        );
    });
    return () => ctx.revert();
  }, [gameState]);

  const handleSelectMission = (m: Landmark) => {
    const owner = factionMap[m.id];
    setPinColor(owner && owner !== 'Unclaimed' ? (owner === playerState.faction ? '#00E5FF' : '#FF0044') : undefined);
    setAtmosphere(null);
    setActiveTarget(m);
    setGameState('flying');
    // Fetch real weather + local time in background
    fetch(`/api/weather-tz?lat=${m.lat}&lng=${m.lng}`)
      .then(r => r.json())
      .then(data => { if (data.weather) setAtmosphere(data); })
      .catch(() => {});
  };

  const handleMarkerClick = async (landmarkId: string, landmarkName: string) => {
    setGameState('loading');
    setPlayerGuess(''); // Reset the input box for new encounters
    try {
      const discovered = discoveredLandmarks.find(d => d.id === landmarkId);
      const body: any = { landmarkId, landmarkName, playerState };
      if (discovered) {
        body.customContext = { era: discovered.era, setting: discovered.setting, crisis: discovered.crisis };
        body.lat = discovered.lat;
        body.lng = discovered.lng;
      }
      if (atmosphere) {
        body.atmosphere = {
          weather: atmosphere.weather.condition,
          tempC: atmosphere.weather.tempC,
          localTime: atmosphere.timezone.localTimeStr,
          isDaytime: atmosphere.timezone.isDaytime,
        };
      }
      const res = await fetch('/api/encounter', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      // FIX: We now check for puzzleBeginning instead of choices!
      if (!res.ok || !data.puzzleBeginning) throw new Error('failed');
      const humanFallback = `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(data.characterName || 'agent')}`;
      setEncounterData({ ...data, portraitUrl: humanFallback });
      setChatLog([{ role: 'ai', text: data.puzzleBeginning }]);
      setGameState('encounter');

      // Speak the opening line via ElevenLabs
      if (data.puzzleBeginning) {
        fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: data.puzzleBeginning }),
        }).then(r => r.ok ? r.blob() : null).then(blob => {
          if (!blob) return;
          const url = URL.createObjectURL(blob);
          const audio = new Audio(url);
          if (activeAudioRef.current) activeAudioRef.current.pause();
          activeAudioRef.current = audio;
          audio.play();
          audio.onended = () => URL.revokeObjectURL(url);
        }).catch(() => {});
      }

      // Non-blocking: swap to real Wikipedia portrait when available
      if (data.characterName) {
        fetch(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(data.characterName)}`)
          .then(r => r.json())
          .then(wiki => {
            if (wiki.thumbnail?.source) {
              setEncounterData((prev: any) => prev ? { ...prev, portraitUrl: wiki.thumbnail.source } : prev);
            }
          })
          .catch(() => {});
      }
    } catch { setGameState('menu'); }
  };

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerGuess.trim() || isChatting || !encounterData) return;

    const userText = playerGuess.trim();
    setPlayerGuess(''); // Instantly clear the box!
    setChatLog(prev => [...prev, { role: 'player', text: userText }]);
    setIsChatting(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userText,
          characterName: encounterData.characterName,
          persona: encounterData.characterPersona,
          history: chatLog
        })
      });
      
      if (!res.ok) throw new Error("Backend crashed");
      const data = await res.json();
      
      if (data.reply) {
        setChatLog(prev => [...prev, { role: 'ai', text: data.reply }]);
        
        // Trigger ElevenLabs for the AI's reply
        try {
          const audioRes = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              text: data.reply, 
              characterName: encounterData.characterName 
            }),
          });
          
          if (audioRes.ok) {
            const audioBlob = await audioRes.blob();
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            // Stop any currently playing audio before starting the new one
            if (activeAudioRef.current) {
              activeAudioRef.current.pause();
            }
            
            activeAudioRef.current = audio;
            audio.play();
          }
        } catch (audioErr) {
          console.error("Audio failed to play for chat reply.", audioErr);
        }
      }
    } catch {
      setChatLog(prev => [...prev, { role: 'ai', text: "*Static interference blocks the response.*" }]);
    } finally {
      setIsChatting(false);
    }
  };

  const handleSubmitGuess = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeTarget || !encounterData || !playerGuess.trim()) return; 
    setGameState('resolving');
    
    try {
      const res = await fetch('/api/resolve', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          landmarkId: activeTarget.id, 
          playerGuess: playerGuess.trim(),
          secretTruth: encounterData.secretTruth, // We pass the secret truth to the AI judge
          playerFaction: playerState.faction 
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error('failed');
      if (data.mapUpdate?.colorHex) {
        setPinColor(data.mapUpdate.colorHex);
        setFactionMap(prev => ({ ...prev, [activeTarget.id]: data.mapUpdate.newFactionOwner }));
      }
      setResultData(data); setGameState('result');
    } catch { setGameState('menu'); }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim() || isSearching) return;
    setIsSearching(true);
    setSearchError('');
    try {
      const result: GeminiLandmark = await searchLandmark(searchQuery.trim());
      const id = result.name.toLowerCase().replace(/[^a-z0-9]+/g, '_');

      // Avoid duplicates
      if (discoveredLandmarks.find(d => d.id === id) || landmarkRegistry.find(l => l.id === id)) {
        setSearchError(`${result.name} is already in the mission list.`);
        return;
      }

      const groundElevation = result.elevationMeters ?? 50;

      const newLandmark: DiscoveredLandmark = {
        id,
        name: result.name,
        lat: result.lat,
        lng: result.lng,
        height: groundElevation + 80,
        elevation: groundElevation,
        baseDifficulty: Math.floor(Math.random() * 3) + 2,
        era: result.era,
        setting: result.setting,
        figures: [],
        crisis: result.crisis,
        geminiColor: result.factionColor,
        location: result.location,
        description: result.description,
      };

      setDiscoveredLandmarks(prev => [...prev, newLandmark]);
      setSearchQuery('');

      // Mint NFT on Solana devnet if wallet connected (non-blocking)
      if (walletAddress) {
        setNftMinting(prev => new Set(prev).add(id));
        fetch('/api/mint-nft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            walletAddress,
            landmarkName: result.name,
            era: result.era,
            lat: result.lat,
            lng: result.lng,
          }),
        })
          .then(r => r.json())
          .then(data => {
            if (data.mint) {
              setNftResults(prev => ({ ...prev, [id]: { mint: data.mint, explorerUrl: data.explorerUrl } }));
            }
          })
          .catch(() => {})
          .finally(() => setNftMinting(prev => { const s = new Set(prev); s.delete(id); return s; }));
      }

      // Animate new card in
      requestAnimationFrame(() => {
        if (discoveredRef.current) {
          const cards = discoveredRef.current.querySelectorAll('.discovered-card');
          const last = cards[cards.length - 1];
          if (last) gsap.fromTo(last, { opacity: 0, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' });
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setSearchError(msg.includes('JSON') || msg.includes('502') ? 'Gemini returned an unexpected response — try again.' : `Could not identify "${searchQuery.trim()}". Try a more specific name.`);
    } finally {
      setIsSearching(false);
    }
  };

  const activeMeta = activeTarget ? META[activeTarget.id] : null;
  const activeDiscovered = activeTarget ? discoveredLandmarks.find(d => d.id === activeTarget.id) : null;
  const activeDisplay = activeMeta ?? (activeDiscovered ? {
    color: activeDiscovered.geminiColor,
    label: activeDiscovered.era,
    Icon: () => (
      <svg viewBox="0 0 20 28" fill="none" className="w-5 h-7">
        <path d="M10 0C4.48 0 0 4.48 0 10c0 7.5 10 18 10 18S20 17.5 20 10C20 4.48 15.52 0 10 0z" fill="currentColor" opacity=".35" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="10" cy="10" r="3.5" fill="currentColor"/>
      </svg>
    ),
  } : null);

  // For Gemini-discovered landmarks, derive theme from geminiColor
  const getDiscoveredTheme = (color: string) => ({
    accent: color,
    glow: color + '28',
    border: color + '55',
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden text-white" style={{ background: '#040d1e' }}>

      {/* Starfield */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none"/>

      {/* Deep space atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(2,10,28,0.55) 0%, rgba(4,8,22,0.7) 60%), radial-gradient(ellipse at 90% 10%, rgba(0,80,140,0.18) 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, rgba(80,0,110,0.14) 0%, transparent 45%)',
      }}/>

      {/* Map (flying state) */}
      <div className="absolute inset-0">
        {activeTarget && <MapLayer target={activeTarget} onMarkerClick={handleMarkerClick} pinColor={pinColor}/>}
      </div>

      {/* ═══════════════ MENU ═══════════════ */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex">

          {/* Left panel */}
          <div ref={leftPanelRef} className="flex flex-col z-10 h-full" style={{ width: '42%', padding: '20px 28px' }}>

            {/* ── Fixed header ── */}
            <div className="shrink-0">
              <p className="text-xs font-mono tracking-[0.35em] text-cyan-400/70 uppercase mb-2">
                ◈ Chronoguard Ops · Lv {playerState.level}
              </p>
              <h1
                className="leading-none font-black uppercase mb-1"
                style={{
                  fontFamily: 'var(--font-cinzel)',
                  fontSize: 'clamp(48px, 5.5vw, 80px)',
                  textShadow: '0 0 80px rgba(0,229,255,0.3), 0 0 160px rgba(0,229,255,0.1)',
                  WebkitTextStroke: '1px rgba(0,229,255,0.1)',
                }}
              >
                Wander<br/><span style={{ color: '#00E5FF' }}>Lore</span>
              </h1>
              <p className="text-xs font-mono text-neutral-400 tracking-[0.3em] uppercase mt-1 mb-3">
                Rewrite History · One Landmark at a Time
              </p>
              <div className="mb-3">
                <WalletConnect onConnect={setWalletAddress} onDisconnect={() => setWalletAddress('')} />
                {walletAddress && (
                  <p className="text-xs font-mono text-neutral-500 mt-1">
                    ◎ Discoveries mint as NFTs on Solana Devnet
                  </p>
                )}
              </div>
              <div className="h-px mb-3" style={{ background: 'linear-gradient(to right, rgba(0,229,255,0.4), transparent)' }}/>
            </div>

            {/* ── Scrollable content ── */}
            <div className="flex-1 min-h-0 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,229,255,0.15) transparent' }}>

              {/* ── Search bar ── */}
              <form onSubmit={handleSearch} className="flex gap-2 mb-3">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                    placeholder="Search any landmark in the world..."
                    className="w-full text-sm text-white placeholder-neutral-500 pl-8 pr-3 py-2.5 rounded-xl focus:outline-none transition-colors"
                    style={{ background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.15)' }}
                    onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.35)')}
                    onBlur={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.09)')}
                  />
                </div>
                <button
                  type="submit"
                  disabled={isSearching || !searchQuery.trim()}
                  className="px-4 py-2.5 rounded-xl text-xs font-mono tracking-widest uppercase transition-all disabled:opacity-30"
                  style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.25)', color: '#00E5FF' }}
                >
                  {isSearching ? (
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full border border-t-cyan-400 border-cyan-500/20 animate-spin inline-block"/>
                    </span>
                  ) : 'SCAN'}
                </button>
              </form>
              {searchError && <p className="text-red-400 text-xs font-mono mb-3 -mt-2 pl-1">{searchError}</p>}
              <div className="flex items-center gap-2 mb-2">
                <p className="text-xs font-mono text-neutral-400 tracking-[0.3em] uppercase">Select Mission</p>
                <div className="flex items-center gap-1 ml-auto">
                  <div className="w-1.5 h-1.5 rounded-full bg-cyan-500/70"/>
                  <span className="text-[10px] font-mono text-neutral-500 tracking-wider">POWERED BY GEMINI</span>
                </div>
              </div>
              <div className="flex flex-col gap-1">
                {landmarkRegistry.map((m, i) => {
                  const t = META[m.id];
                  const owner = factionMap[m.id];
                  const captured = owner && owner !== 'Unclaimed';
                  const mine = captured && owner === playerState.faction;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMission(m)}
                      className="mission-row group flex items-center gap-4 py-2.5 px-4 rounded-xl transition-all duration-200 text-left"
                      style={{ border: '1px solid transparent' }}
                      onMouseEnter={e => {
                        e.currentTarget.style.background = `rgba(${t.color === '#FFB800' ? '255,184,0' : t.color === '#00E5FF' ? '0,229,255' : '255,64,64'},0.05)`;
                        e.currentTarget.style.borderColor = t.color + '40';
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.borderColor = 'transparent';
                      }}
                    >
                      {/* Number */}
                      <span className="text-xs font-mono text-neutral-400 w-5 shrink-0">0{i+1}</span>

                      {/* Icon */}
                      <div style={{ color: t.color }} className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                        <t.Icon/>
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-white group-hover:text-white transition-colors tracking-wide truncate">{m.name}</p>
                        <p className="text-xs font-mono mt-0.5" style={{ color: t.color, opacity: 0.85 }}>{t.label}</p>
                      </div>

                      {/* Status */}
                      <div className="shrink-0 text-right">
                        {captured ? (
                          <span className="text-[8px] font-mono px-2 py-0.5 rounded-full" style={mine
                            ? { color: '#00E5FF', background: 'rgba(0,229,255,0.1)', border: '1px solid rgba(0,229,255,0.3)' }
                            : { color: '#FF4040', background: 'rgba(255,64,64,0.1)', border: '1px solid rgba(255,64,64,0.3)' }}>
                            {mine ? '▲ HELD' : '▼ ENEMY'}
                          </span>
                        ) : (
                          <span className="text-xs font-mono text-neutral-400 group-hover:text-neutral-200 transition-colors tracking-wider">DEPLOY →</span>
                        )}
                        <div className="flex gap-0.5 justify-end mt-1.5">
                          {[1,2,3,4,5].map(d => (
                            <div key={d} className="w-1 h-1 rounded-full" style={{ background: d <= m.baseDifficulty ? t.color : 'rgba(255,255,255,0.1)' }}/>
                          ))}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>

            {/* ── Discovered landmarks ── */}
            {discoveredLandmarks.length > 0 && (
              <div ref={discoveredRef} className="flex flex-col gap-1 mt-3 mb-2">
                <div className="flex items-center gap-2 mb-2">
                  <p className="text-xs font-mono text-neutral-400 tracking-[0.3em] uppercase flex items-center gap-2">
                    <span>Discovered</span>
                    <span className="px-1.5 py-0.5 rounded text-[8px]" style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                      {discoveredLandmarks.length} NEW
                    </span>
                  </p>
                  <button
                    onClick={() => { setDiscoveredLandmarks([]); setNftMinting(new Set()); setNftResults({}); try { localStorage.removeItem('wl_discovered'); } catch {} }}
                    className="ml-auto text-[9px] font-mono tracking-wider uppercase px-2 py-0.5 rounded transition-all hover:opacity-100 opacity-40"
                    style={{ color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)' }}
                  >
                    Clear All
                  </button>
                </div>
                {discoveredLandmarks.map((m) => {
                  const t = getDiscoveredTheme(m.geminiColor);
                  const owner = factionMap[m.id];
                  const captured = owner && owner !== 'Unclaimed';
                  const mine = captured && owner === playerState.faction;
                  return (
                    <div key={m.id} className="discovered-card rounded-xl overflow-hidden" style={{ background: 'rgba(6,6,12,0.95)', border: `1px solid ${t.border}`, boxShadow: `0 0 24px -8px ${t.glow}` }}>
                      <div className="h-px w-full" style={{ background: `linear-gradient(to right, ${t.accent}, transparent)` }}/>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <button onClick={() => handleSelectMission(m)} className="flex-1 min-w-0 text-left">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <p className="font-bold text-sm text-white truncate">{m.name}</p>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: t.accent, background: t.glow, border: `1px solid ${t.border}` }}>GEMINI</span>
                            {nftMinting.has(m.id) && (
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1" style={{ color: '#9945FF', background: 'rgba(153,69,255,0.08)', border: '1px solid rgba(153,69,255,0.3)' }}>
                                <span className="w-2 h-2 rounded-full border border-t-purple-400 border-purple-500/20 animate-spin inline-block"/>
                                MINTING
                              </span>
                            )}
                            {nftResults[m.id] && (
                              <a href={nftResults[m.id].explorerUrl} target="_blank" rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 hover:opacity-80 transition-opacity"
                                style={{ color: '#9945FF', background: 'rgba(153,69,255,0.1)', border: '1px solid rgba(153,69,255,0.4)' }}
                                title={`NFT Mint: ${nftResults[m.id].mint}`}>
                                ◎ ON-CHAIN
                              </a>
                            )}
                            {captured && (
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0" style={mine ? { color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)' } : { color: '#FF4040', background: 'rgba(255,64,64,0.08)', border: '1px solid rgba(255,64,64,0.3)' }}>
                                {mine ? '▲ YOURS' : '▼ ENEMY'}
                              </span>
                            )}
                          </div>
                          <p className="text-xs font-mono mb-0.5" style={{ color: t.accent, opacity: 0.85 }}>{m.era}</p>
                          <p className="text-xs text-neutral-400 truncate">{(m as DiscoveredLandmark).location}</p>
                        </button>
                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <button
                            onClick={() => setDiscoveredLandmarks(prev => prev.filter(d => d.id !== m.id))}
                            className="text-[10px] w-5 h-5 rounded flex items-center justify-center transition-opacity opacity-30 hover:opacity-100"
                            style={{ color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.3)' }}
                          >x</button>
                          <span className="text-xs font-mono text-neutral-400 tracking-wider">DEPLOY</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            </div>{/* end scrollable */}

            {/* ── Footer ── */}
            <div className="shrink-0 pt-3 flex flex-col gap-2">
              <div className="flex items-center gap-3 opacity-30">
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ animation: 'flicker 2s ease-in-out infinite' }}/>
                <p className="text-[9px] font-mono tracking-widest uppercase">WanderLore · Temporal Ops v1.0</p>
              </div>
              {/* DigitalOcean badge */}
              <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg w-fit"
                style={{ background: 'rgba(0,117,255,0.07)', border: '1px solid rgba(0,117,255,0.2)' }}>
                {/* DigitalOcean logo mark */}
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" fill="#0075FF" opacity=".15"/>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10c5.52 0 10-4.48 10-10S17.52 2 12 2zm0 16.5v-3c-2.49 0-4.5-2.01-4.5-4.5H4c0 4.42 3.58 8 8 8zm0-6v-3c-.83 0-1.5-.67-1.5-1.5H7.5c0 2.49 2.01 4.5 4.5 4.5zm0-6V4c-3.31 0-6 2.69-6 6h2.5c0-1.93 1.57-3.5 3.5-3.5z" fill="#0075FF" opacity=".9"/>
                </svg>
                <p className="text-[9px] font-mono tracking-wider" style={{ color: 'rgba(0,117,255,0.8)' }}>
                  Deployed on <span style={{ color: '#0075FF', fontWeight: 700 }}>DigitalOcean</span>
                </p>
              </div>
            </div>
          </div>

          {/* Right panel — Globe */}
          <div ref={rightPanelRef} className="flex-1 flex items-center justify-center relative overflow-hidden">
            {/* Orbital rings behind globe */}
            {[560,800,1080].map((size, i) => (
              <div key={size} className="absolute rounded-full pointer-events-none" style={{
                width: size, height: size,
                border: `1px solid rgba(0,229,255,${0.05 - i * 0.012})`,
                animation: `${i % 2 === 0 ? 'orbit' : 'orbit-reverse'} ${40 + i * 20}s linear infinite`,
                top: '50%', left: '50%',
              }}/>
            ))}
            {/* Glowing center for globe */}
            <div className="absolute rounded-full pointer-events-none" style={{
              width: 420, height: 420,
              background: 'radial-gradient(circle, rgba(0,229,255,0.04) 0%, transparent 70%)',
            }}/>
            <div className="relative z-10" style={{ width: 'min(680px, 96%)', aspectRatio: '1' }}>
              <Globe3D
                factionMap={factionMap}
                playerFaction={playerState.faction}
                extraPins={discoveredLandmarks.map((d: any) => {
                  const skip = new Set(['the','a','an','of','in','at','de','la','le','di','du','city','national','monument']);
                  const city = d.location.split(',')[0].trim();
                  // Take up to 2 meaningful words (skip articles/filler), max 12 chars total
                  const words = city.split(' ').filter((w: string) => !skip.has(w.toLowerCase()) && w.length > 1);
                  const label = words.slice(0, 2).join(' ').toUpperCase().slice(0, 12) || city.split(' ')[0].toUpperCase().slice(0, 8);
                  return { id: d.id, lat: d.lat, lng: d.lng, color: d.geminiColor, label };
                })}
                discoveredLandmarks={discoveredLandmarks.map((d: any) => ({ id: d.id, location: d.location }))}
              />
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════ NON-MENU STATES ═══════════════ */}
      {gameState !== 'menu' && (
        <div className="absolute inset-0 pointer-events-none">

          {/* Top bar */}
          <header className="pointer-events-auto flex justify-between items-center px-7 pt-5 gap-4">
            <div className="flex items-center gap-3">
              <button
                onClick={() => { setGameState('menu'); setActiveTarget(null); setPinColor(undefined); setEncounterData(null); setChatLog([]); }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95"
                style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.55)' }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.35)'; e.currentTarget.style.color = '#00E5FF'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.color = 'rgba(255,255,255,0.55)'; }}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M6 1L2 5l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                Base
              </button>
              <div className="w-7 h-7 rounded border border-cyan-500/30 bg-cyan-500/8 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ animation: 'flicker 2.4s ease-in-out infinite' }}/>
              </div>
              <div>
                <p className="text-[9px] font-mono text-cyan-400/60 tracking-[0.2em] uppercase">Operative</p>
                <p className="text-sm font-semibold">{playerState.faction} · Lv {playerState.level}</p>
              </div>
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <WalletConnect onConnect={setWalletAddress} onDisconnect={() => setWalletAddress('')} />
            {activeDisplay && (
              <div className="flex items-center gap-3">
                {/* Weather badge — always visible in flying state */}
                {gameState === 'flying' && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg pointer-events-auto"
                    style={{ background: 'rgba(0,0,0,0.55)', border: '1px solid rgba(255,255,255,0.12)', backdropFilter: 'blur(10px)' }}>
                    {atmosphere ? (
                      <>
                        <span style={{ fontSize: 20, lineHeight: 1 }}>{atmosphere.weather.icon}</span>
                        <div>
                          <p className="text-[11px] font-semibold text-white leading-tight">{atmosphere.weather.tempC}°C &nbsp;{atmosphere.weather.condition}</p>
                          <p className="text-[9px] font-mono leading-tight" style={{ color: atmosphere.timezone.isDaytime ? '#FFD700' : '#aaaaff' }}>
                            {atmosphere.timezone.isDaytime ? '☀ DAY' : '🌙 NIGHT'} &nbsp;·&nbsp; {atmosphere.timezone.localTimeStr} LOCAL
                          </p>
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-t-cyan-400 border-cyan-500/20 animate-spin"/>
                        <p className="text-[9px] font-mono text-neutral-500">Scanning atmosphere...</p>
                      </div>
                    )}
                  </div>
                )}
                <div className="flex items-center gap-2 opacity-80">
                  <div style={{ color: activeDisplay.color }}><activeDisplay.Icon/></div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{activeTarget?.name}</p>
                    <p className="text-[9px] font-mono" style={{ color: activeDisplay.color, opacity: 0.7 }}>{activeDisplay.label}</p>
                  </div>
                </div>
              </div>
            )}
            </div>
          </header>

          {/* Center states */}
          <div className={`absolute inset-0 flex flex-col items-center justify-center ${gameState === 'flying' ? '' : 'pointer-events-auto'}`}>

            {/* FLYING - weather overlay + HUD */}
            {gameState === 'flying' && activeTarget && (
              <>
                {/* Weather visual effect */}
                <WeatherOverlay atmosphere={atmosphere} />

                {/* Bottom HUD */}
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none w-full max-w-lg px-4">
                  <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-2xl backdrop-blur-md"
                    style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(255,255,255,0.08)' }}>
                    {/* Location + weather row */}
                    <div className="flex items-center justify-between w-full gap-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: activeDisplay?.color }}>
                          {activeTarget.name}
                        </p>
                      </div>
                      {atmosphere && (
                        <div className="flex items-center gap-3">
                          <span className="text-sm">{atmosphere.weather.icon}</span>
                          <div className="text-right">
                            <p className="text-[10px] font-mono text-neutral-300">{atmosphere.weather.condition} · {atmosphere.weather.tempC}°C</p>
                            <p className="text-[9px] font-mono" style={{ color: atmosphere.timezone.isDaytime ? '#FFB800' : '#8888ff' }}>
                              {atmosphere.timezone.isDaytime ? '☀ DAY' : '🌙 NIGHT'} · {atmosphere.timezone.localTimeStr} LOCAL
                            </p>
                          </div>
                        </div>
                      )}
                      {!atmosphere && (
                        <p className="text-[9px] font-mono text-neutral-700 animate-pulse">Scanning atmosphere...</p>
                      )}
                    </div>
                    {/* Controls hint */}
                    <p className="text-[10px] text-neutral-600 text-center">
                      <span className="font-mono bg-white/8 rounded px-1.5 py-0.5 text-neutral-400 text-[9px]">WASD</span>
                      {' '}move &nbsp;·&nbsp; click ground to look &nbsp;·&nbsp; click <span className="text-red-400">red pin</span> to scan
                    </p>
                  </div>
                </div>
              </>
            )}

            {/* LOADING / RESOLVING */}
            {(gameState === 'loading' || gameState === 'resolving') && (
              <div className="flex flex-col items-center gap-5">
                <div className="relative w-16 h-16">
                  <div className="absolute inset-0 rounded-full border border-cyan-500/15 animate-ping"/>
                  <div className="absolute inset-1.5 rounded-full border-2 border-t-cyan-400 border-cyan-500/20 animate-spin"/>
                  <div className="absolute inset-4 rounded-full bg-cyan-500/15 animate-pulse"/>
                </div>
                <p className="text-[11px] font-mono tracking-[0.35em] text-cyan-400/60 uppercase animate-pulse">
                  {gameState === 'loading' ? 'Scanning Anomaly...' : 'Calculating Trajectory...'}
                </p>
              </div>
            )}

            {/* ENCOUNTER — Cinematic visual novel layout */}
            {gameState === 'encounter' && encounterData && (
              <div className="absolute inset-x-0 bottom-0 pointer-events-auto" style={{ padding: '0 28px 28px 28px', background: 'linear-gradient(to top, rgba(0,0,8,0.88) 0%, transparent 100%)' }}>
                <style>{`
                  @keyframes scan-sweep {
                    0%   { top: 4%;  opacity: 0; }
                    8%   { opacity: 0.9; }
                    92%  { opacity: 0.9; }
                    100% { top: 88%; opacity: 0; }
                  }
                  @keyframes bracket-pulse {
                    0%, 100% { opacity: 0.45; }
                    50%      { opacity: 1; }
                  }
                `}</style>

                <div className="w-full max-w-5xl mx-auto flex items-end gap-5">

                  {/* ── Character Portrait ── */}
                  <div className="shrink-0 relative rounded-xl overflow-hidden" style={{ width: 224, height: 330 }}>
                    {/* Backdrop glow */}
                    <div className="absolute inset-0" style={{ background: 'rgba(0,229,255,0.03)', boxShadow: '0 0 50px -10px rgba(0,229,255,0.35)' }}/>

                    {/* Portrait image */}
                    <img
                      src={encounterData.portraitUrl}
                      alt={encounterData.characterName}
                      className="absolute inset-0 w-full h-full object-contain"
                      style={{ filter: 'drop-shadow(0 0 22px rgba(0,229,255,0.45))' }}
                    />

                    {/* Animated scan line */}
                    <div className="absolute inset-x-0 h-px pointer-events-none" style={{
                      background: 'linear-gradient(to right, transparent 0%, rgba(0,229,255,0.85) 50%, transparent 100%)',
                      boxShadow: '0 0 10px rgba(0,229,255,0.7)',
                      animationName: 'scan-sweep',
                      animationDuration: '3.2s',
                      animationTimingFunction: 'ease-in-out',
                      animationIterationCount: 'infinite',
                    }}/>

                    {/* Corner brackets */}
                    <div className="absolute top-0 left-0 w-5 h-5 pointer-events-none" style={{ borderTop: '2px solid #00E5FF', borderLeft: '2px solid #00E5FF', animation: 'bracket-pulse 2s ease-in-out infinite' }}/>
                    <div className="absolute top-0 right-0 w-5 h-5 pointer-events-none" style={{ borderTop: '2px solid #00E5FF', borderRight: '2px solid #00E5FF', animation: 'bracket-pulse 2s ease-in-out infinite', animationDelay: '0.5s' }}/>
                    <div className="absolute bottom-0 left-0 w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid #00E5FF', borderLeft: '2px solid #00E5FF', animation: 'bracket-pulse 2s ease-in-out infinite', animationDelay: '1s' }}/>
                    <div className="absolute bottom-0 right-0 w-5 h-5 pointer-events-none" style={{ borderBottom: '2px solid #00E5FF', borderRight: '2px solid #00E5FF', animation: 'bracket-pulse 2s ease-in-out infinite', animationDelay: '1.5s' }}/>

                    {/* Bottom nameplate */}
                    <div className="absolute bottom-0 inset-x-0 px-3 py-2" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.97) 0%, rgba(0,0,0,0.6) 65%, transparent 100%)' }}>
                      <p className="text-[8px] font-mono tracking-[0.35em] uppercase mb-0.5" style={{ color: 'rgba(0,229,255,0.55)' }}>◈ ENTITY SCANNED</p>
                      <p className="text-xs font-bold text-white tracking-wide leading-tight truncate">{encounterData.characterName}</p>
                    </div>
                  </div>

                  {/* ── Dialogue Panel ── */}
                  <div className="flex-1 relative rounded-2xl backdrop-blur-xl flex flex-col overflow-hidden"
                       style={{ background: 'rgba(1,3,12,0.93)', border: '1px solid rgba(0,229,255,0.28)', boxShadow: '0 0 90px -20px rgba(0,229,255,0.22), inset 0 1px 0 rgba(255,255,255,0.04)', height: 330, padding: '18px 20px 16px 20px' }}>

                    {/* Sci-fi corner accents on panel */}
                    <div className="absolute top-0 left-0 w-6 h-6 pointer-events-none" style={{ borderTop: '2px solid rgba(0,229,255,0.55)', borderLeft: '2px solid rgba(0,229,255,0.55)' }}/>
                    <div className="absolute top-0 right-0 w-6 h-6 pointer-events-none" style={{ borderTop: '2px solid rgba(0,229,255,0.55)', borderRight: '2px solid rgba(0,229,255,0.55)' }}/>
                    <div className="absolute bottom-0 left-0 w-6 h-6 pointer-events-none" style={{ borderBottom: '2px solid rgba(0,229,255,0.3)', borderLeft: '2px solid rgba(0,229,255,0.3)' }}/>
                    <div className="absolute bottom-0 right-0 w-6 h-6 pointer-events-none" style={{ borderBottom: '2px solid rgba(0,229,255,0.3)', borderRight: '2px solid rgba(0,229,255,0.3)' }}/>

                    {/* Header */}
                    <div className="flex items-start justify-between mb-2 shrink-0">
                      <div>
                        <div className="flex items-center gap-2 mb-0.5">
                          <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse"/>
                          <span className="text-[8px] font-mono tracking-[0.35em] uppercase" style={{ color: 'rgba(255,255,255,0.3)' }}>Temporal Contact · Live</span>
                        </div>
                        <span className="text-xl font-black uppercase tracking-wider" style={{ fontFamily: 'var(--font-cinzel)', color: '#00E5FF', textShadow: '0 0 28px rgba(0,229,255,0.65)' }}>
                          {encounterData.characterName}
                        </span>
                      </div>
                      <span className="text-[9px] font-mono px-2.5 py-1 rounded-full mt-1 shrink-0 uppercase tracking-widest" style={{ color: 'rgba(0,229,255,0.75)', background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.22)' }}>
                        {encounterData.characterPersona}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="h-px w-full mb-3 shrink-0" style={{ background: 'linear-gradient(to right, rgba(0,229,255,0.55), rgba(0,229,255,0.08), transparent)' }}/>

                    {/* Chat log */}
                    <div ref={chatScrollRef} className="flex-1 overflow-y-auto space-y-2 mb-3 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(0,229,255,0.15) transparent' }}>
                      {chatLog.map((msg, idx) => (
                        <div key={idx} className={`flex ${msg.role === 'player' ? 'justify-end' : 'justify-start'}`}>
                          <div className={`max-w-[82%] px-3 py-2 text-sm leading-relaxed ${msg.role === 'ai' ? 'rounded-xl rounded-tl-sm' : 'rounded-xl rounded-tr-sm'}`}
                               style={msg.role === 'ai'
                                 ? { background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.18)', color: '#e0e0e0' }
                                 : { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#999' }
                               }>
                            {msg.role === 'ai' && <span className="text-[10px] font-bold block mb-0.5" style={{ color: '#00E5FF' }}>{encounterData.characterName}</span>}
                            {msg.role === 'player' && <span className="text-[10px] font-bold text-neutral-500 block mb-0.5">You</span>}
                            {msg.text}
                          </div>
                        </div>
                      ))}
                      {isChatting && (
                        <div className="flex justify-start">
                          <div className="flex items-center gap-1 px-4 py-2.5 rounded-xl rounded-tl-sm" style={{ background: 'rgba(0,229,255,0.07)', border: '1px solid rgba(0,229,255,0.15)' }}>
                            {[0,1,2].map(i => (
                              <div key={i} className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: 'rgba(0,229,255,0.6)', animationDelay: `${i * 0.18}s` }}/>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Input + Claim */}
                    <div className="flex gap-2 shrink-0">
                      <form onSubmit={handleChatSubmit} className="flex-1">
                        <input
                          type="text"
                          value={playerGuess}
                          onChange={e => setPlayerGuess(e.target.value)}
                          disabled={isChatting}
                          placeholder="Respond to the temporal entity…"
                          className="w-full rounded-xl px-4 py-2.5 text-sm text-white placeholder-neutral-700 focus:outline-none transition-all disabled:opacity-40"
                          style={{ background: 'rgba(0,0,0,0.65)', border: '1px solid rgba(0,229,255,0.18)' }}
                          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.6)')}
                          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(0,229,255,0.18)')}
                        />
                      </form>
                      <button
                        onClick={handleSubmitGuess}
                        className="px-5 py-2.5 rounded-xl text-xs font-bold tracking-widest uppercase transition-all hover:scale-105 active:scale-95 shrink-0"
                        style={{ background: 'rgba(0,229,255,0.11)', border: '1px solid #00E5FF', color: '#00E5FF', boxShadow: '0 0 28px rgba(0,229,255,0.4), inset 0 1px 0 rgba(0,229,255,0.08)', textShadow: '0 0 10px rgba(0,229,255,0.5)' }}
                        onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 0 40px rgba(0,229,255,0.65), inset 0 1px 0 rgba(0,229,255,0.12)')}
                        onMouseLeave={e => (e.currentTarget.style.boxShadow = '0 0 28px rgba(0,229,255,0.4), inset 0 1px 0 rgba(0,229,255,0.08)')}
                      >
                        ◈ Claim
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* RESULT */}
            {gameState === 'result' && resultData && (
              <div className="w-full max-w-md px-5">
                <div className="rounded-2xl p-8 text-center backdrop-blur-xl"
                  style={{
                    background:'rgba(3,3,7,0.95)',
                    border:`1px solid ${resultData.success ? 'rgba(0,229,255,0.25)' : 'rgba(255,0,68,0.25)'}`,
                    boxShadow: resultData.success
                      ? '0 0 120px -20px rgba(0,229,255,0.3), inset 0 1px 0 rgba(255,255,255,0.04)'
                      : '0 0 120px -20px rgba(255,0,68,0.3), inset 0 1px 0 rgba(255,255,255,0.04)',
                  }}>
                  <div className="inline-flex items-center gap-2 text-[9px] font-mono tracking-[0.3em] uppercase px-3 py-1.5 rounded-full border mb-6"
                    style={resultData.success
                      ? { color:'#00E5FF', borderColor:'rgba(0,229,255,0.3)', background:'rgba(0,229,255,0.08)' }
                      : { color:'#FF4040', borderColor:'rgba(255,64,64,0.3)', background:'rgba(255,64,64,0.08)' }}>
                    <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: resultData.success ? '#00E5FF' : '#FF4040' }}/>
                    {resultData.success ? 'Mission Success' : 'Mission Failed'}
                  </div>
                  <h2 className="text-3xl font-black uppercase tracking-wider mb-4"
                    style={{
                      fontFamily:'var(--font-cinzel)',
                      color: resultData.success ? '#00E5FF' : '#FF4040',
                      textShadow: resultData.success ? '0 0 40px rgba(0,229,255,0.6)' : '0 0 40px rgba(255,64,64,0.6)',
                    }}>
                    {resultData.success ? 'Timeline Secured' : 'Anomaly Fractured'}
                  </h2>
                  <p className="text-sm text-neutral-400 leading-relaxed mb-2">{resultData.resultText}</p>
                  {resultData.success && activeTarget && (
                    <p className="text-[10px] font-mono mb-7 tracking-wider" style={{ color:'rgba(0,229,255,0.4)' }}>
                      {activeTarget.name.toUpperCase()} → {playerState.faction.toUpperCase()}
                    </p>
                  )}
                  {!resultData.success && <div className="mb-7"/>}
                  <button
                    onClick={() => { setGameState('menu'); setActiveTarget(null); setPinColor(undefined); }}
                    className="px-8 py-2.5 rounded-lg text-sm font-medium tracking-widest uppercase text-neutral-400 hover:text-white transition-all"
                    style={{ background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)' }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)')}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}>
                    Command Center
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      )}
    </main>
  );
}
