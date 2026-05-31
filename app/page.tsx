'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { gsap } from 'gsap';
import type { LandmarkEncounterResponse } from '../types';
import MapLayer from '../components/MapLayer';
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
const META: Record<string, { color: string; label: string; Icon: () => JSX.Element }> = {
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

/* ── (GlobeViz replaced by Globe3D — see components/Globe3D.tsx) ── */
function _Unused({ factionMap, playerFaction }: { factionMap: Record<string, string>; playerFaction: string }) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const frameRef     = useRef<number>(0);
  const angleRef     = useRef<number>(0);
  const isDragging   = useRef(false);
  const isHovering   = useRef(false);
  const lastMouseX   = useRef(0);

  // Pin base longitudes (degrees) — kept fixed relative to the rotating grid
  const PINS_DEF = [
    { id: 'colosseum_rome',     label: 'ROME',  lat:  41.9, lng:  12.5, color: '#FFB800' },
    { id: 'eiffel_tower_paris', label: 'PARIS', lat:  48.9, lng:   2.3, color: '#00E5FF' },
    { id: 'tokyo_tower_japan',  label: 'TOKYO', lat:  35.7, lng: 139.7, color: '#FF4040' },
  ];

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const R = 230, cx = 260, cy = 260;

    const project = (lat: number, lng: number, rotY: number) => {
      const phi = lat * Math.PI / 180;
      const lam = (lng + rotY) * Math.PI / 180;
      const x3 = Math.cos(phi) * Math.sin(lam);
      const y3 = Math.sin(phi);
      const z3 = Math.cos(phi) * Math.cos(lam);
      return { x: cx + R * x3, y: cy - R * y3, visible: z3 > 0 };
    };

    const draw = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
      const W = canvas.offsetWidth, H = canvas.offsetHeight;
      const r = Math.min(W, H) / 2 - 10;
      const ox = W / 2, oy = H / 2;

      ctx.clearRect(0, 0, W, H);

      // Clipping circle
      ctx.save();
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.clip();

      // Base gradient
      const bg = ctx.createRadialGradient(ox - r*0.25, oy - r*0.25, 0, ox, oy, r);
      bg.addColorStop(0,   '#1a4a7a');
      bg.addColorStop(0.5, '#0d2d50');
      bg.addColorStop(1,   '#060f1e');
      ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

      // Atmosphere inner tint
      const atm = ctx.createRadialGradient(ox, oy, r * 0.6, ox, oy, r);
      atm.addColorStop(0, 'rgba(0,180,255,0)');
      atm.addColorStop(1, 'rgba(0,180,255,0.12)');
      ctx.fillStyle = atm; ctx.fillRect(0, 0, W, H);

      const rot = angleRef.current;

      // Latitude lines
      for (let lat = -75; lat <= 75; lat += 15) {
        const phi = lat * Math.PI / 180;
        const ry = r * Math.cos(phi);
        const yLine = oy - r * Math.sin(phi);
        ctx.beginPath();
        ctx.ellipse(ox, yLine, ry, ry * 0.15, 0, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,220,255,0.18)';
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      // Longitude lines (only front hemisphere visible as ellipses)
      for (let lng = 0; lng < 360; lng += 20) {
        const lam = (lng + rot) * Math.PI / 180;
        const rx = r * Math.abs(Math.sin(lam));
        const skew = Math.cos(lam);
        ctx.beginPath();
        ctx.ellipse(ox, oy, rx, r, 0, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,220,255,${Math.abs(skew) > 0.5 ? 0.14 : 0.07})`;
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }

      // Specular highlight
      const spec = ctx.createRadialGradient(ox - r*0.3, oy - r*0.3, 0, ox - r*0.3, oy - r*0.3, r*0.5);
      spec.addColorStop(0, 'rgba(255,255,255,0.08)');
      spec.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = spec; ctx.fillRect(0, 0, W, H);

      ctx.restore();

      // Outline + rim glow
      const rim = ctx.createRadialGradient(ox, oy, r * 0.75, ox, oy, r + 2);
      rim.addColorStop(0, 'rgba(0,229,255,0)');
      rim.addColorStop(1, 'rgba(0,229,255,0.35)');
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(0,229,255,0.5)'; ctx.lineWidth = 1.5; ctx.stroke();

      // Pins
      const scaleFactor = r / 230;
      for (const p of PINS_DEF) {
        const owner = factionMap[p.id];
        const captured = owner && owner !== 'Unclaimed';
        const pinColor = captured ? (owner === playerFaction ? '#00E5FF' : '#FF4040') : p.color;

        const proj = (() => {
          const phi = p.lat * Math.PI / 180;
          const lam = (p.lng + rot) * Math.PI / 180;
          const x3 = Math.cos(phi) * Math.sin(lam);
          const y3 = Math.sin(phi);
          const z3 = Math.cos(phi) * Math.cos(lam);
          return { x: ox + r * x3, y: oy - r * y3, visible: z3 > -0.1 };
        })();

        if (!proj.visible) continue;

        // Pulse ring
        const t = (Date.now() / 1200 + PINS_DEF.indexOf(p) * 0.4) % 1;
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, (8 + t * 14) * scaleFactor, 0, Math.PI * 2);
        ctx.strokeStyle = pinColor + Math.round((1 - t) * 100).toString(16).padStart(2,'0');
        ctx.lineWidth = 1;
        ctx.stroke();

        // Dot
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, 5 * scaleFactor, 0, Math.PI * 2);
        ctx.fillStyle = pinColor;
        ctx.shadowColor = pinColor;
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        // Label
        ctx.font = `bold ${9 * scaleFactor}px monospace`;
        ctx.fillStyle = pinColor;
        ctx.globalAlpha = 0.9;
        const lx = proj.x + (proj.x > ox ? -10 : 10) * scaleFactor;
        ctx.textAlign = proj.x > ox ? 'right' : 'left';
        ctx.fillText(p.label, lx, proj.y - 9 * scaleFactor);
        if (captured) {
          ctx.font = `${7.5 * scaleFactor}px monospace`;
          ctx.globalAlpha = 0.65;
          ctx.fillText(owner === playerFaction ? '▲ YOURS' : '▼ ENEMY', lx, proj.y + 2 * scaleFactor);
        }
        ctx.globalAlpha = 1;
      }

      // Scan sweep
      const sweepAngle = (Date.now() / 8000) * Math.PI * 2;
      ctx.save();
      ctx.beginPath(); ctx.arc(ox, oy, r, 0, Math.PI * 2); ctx.clip();
      const sweep = ctx.createLinearGradient(
        ox + Math.cos(sweepAngle - 0.4) * r,
        oy + Math.sin(sweepAngle - 0.4) * r,
        ox + Math.cos(sweepAngle) * r,
        oy + Math.sin(sweepAngle) * r,
      );
      sweep.addColorStop(0, 'rgba(0,229,255,0)');
      sweep.addColorStop(1, 'rgba(0,229,255,0.07)');
      ctx.beginPath();
      ctx.moveTo(ox, oy);
      ctx.arc(ox, oy, r, sweepAngle - 0.4, sweepAngle);
      ctx.closePath();
      ctx.fillStyle = sweep;
      ctx.fill();
      ctx.restore();

      // Auto-rotate: full speed when idle, slow when hovered, paused while dragging
      if (!isDragging.current) {
        angleRef.current += isHovering.current ? 0.012 : 0.055;
      }
      frameRef.current = requestAnimationFrame(draw);
    };

    // Mouse interaction
    const onMouseEnter = () => {
      isHovering.current = true;
      canvas.style.cursor = 'grab';
    };
    const onMouseLeave = () => {
      isHovering.current = false;
      isDragging.current = false;
      canvas.style.cursor = 'default';
    };
    const onMouseDown = (e: MouseEvent) => {
      isDragging.current = true;
      lastMouseX.current = e.clientX;
      canvas.style.cursor = 'grabbing';
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging.current) return;
      const dx = e.clientX - lastMouseX.current;
      angleRef.current += dx * 0.25;
      lastMouseX.current = e.clientX;
    };
    const onMouseUp = () => {
      isDragging.current = false;
      canvas.style.cursor = isHovering.current ? 'grab' : 'default';
    };

    canvas.addEventListener('mouseenter', onMouseEnter);
    canvas.addEventListener('mouseleave', onMouseLeave);
    canvas.addEventListener('mousedown',  onMouseDown);
    canvas.addEventListener('mousemove',  onMouseMove);
    canvas.addEventListener('mouseup',    onMouseUp);

    draw();
    return () => {
      cancelAnimationFrame(frameRef.current);
      canvas.removeEventListener('mouseenter', onMouseEnter);
      canvas.removeEventListener('mouseleave', onMouseLeave);
      canvas.removeEventListener('mousedown',  onMouseDown);
      canvas.removeEventListener('mousemove',  onMouseMove);
      canvas.removeEventListener('mouseup',    onMouseUp);
    };
  }, [factionMap, playerFaction]);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ filter: 'drop-shadow(0 0 50px rgba(0,180,255,0.25))' }}
    />
  );
}

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
  const [factionMap, setFactionMap]   = useState<Record<string,string>>(() => {
    if (typeof window === 'undefined') return {};
    try { return JSON.parse(localStorage.getItem('wl_factions') || '{}'); } catch { return {}; }
  });
  const [atmosphere, setAtmosphere] = useState<{ weather: any; timezone: any } | null>(null);
  const [searchQuery,        setSearchQuery]        = useState('');
  const [isSearching,        setIsSearching]        = useState(false);
  const [searchError,        setSearchError]        = useState('');
  const [discoveredLandmarks, setDiscoveredLandmarks] = useState<DiscoveredLandmark[]>(() => {
    if (typeof window === 'undefined') return [];
    try { return JSON.parse(localStorage.getItem('wl_discovered') || '[]'); } catch { return []; }
  });

  const playerState = { playerId: 'demo_user_1', faction: 'Chronoguard', level: 5 };

  const canvasRef      = useRef<HTMLCanvasElement>(null);
  const leftPanelRef   = useRef<HTMLDivElement>(null);
  const rightPanelRef  = useRef<HTMLDivElement>(null);
  const discoveredRef  = useRef<HTMLDivElement>(null);

  /* Starfield */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const stars = Array.from({ length: 260 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 1.3 + 0.15, o: Math.random() * 0.5 + 0.08,
    }));
    const draw = () => {
      canvas.width = window.innerWidth; canvas.height = window.innerHeight;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(s => {
        ctx.beginPath(); ctx.arc(s.x * canvas.width, s.y * canvas.height, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${s.o})`; ctx.fill();
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

  /* ── Load from Backboard on mount (fills gaps localStorage can't cover) ── */
  useEffect(() => {
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

      // Use human-style avatar immediately, then upgrade to Wikipedia portrait if found
      const humanFallback = `https://api.dicebear.com/7.x/personas/svg?seed=${encodeURIComponent(data.characterName || 'agent')}`;
      setEncounterData({ ...data, portraitUrl: humanFallback });
      setGameState('encounter');

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

  // For Gemini-discovered landmarks, derive theme from geminiColor
  const getDiscoveredTheme = (color: string) => ({
    accent: color,
    glow: color + '28',
    border: color + '55',
  });

  return (
    <main className="relative w-screen h-screen overflow-hidden text-white" style={{ background: '#000' }}>

      {/* Starfield */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none"/>

      {/* Deep space atmosphere */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: 'radial-gradient(ellipse at 30% 50%, rgba(2,10,28,0.88) 0%, rgba(0,0,0,0.95) 60%), radial-gradient(ellipse at 90% 10%, rgba(0,60,110,0.2) 0%, transparent 50%), radial-gradient(ellipse at 10% 90%, rgba(60,0,90,0.15) 0%, transparent 45%)',
      }}/>

      {/* Map (flying state) */}
      <div className="absolute inset-0">
        {activeTarget && <MapLayer target={activeTarget} onMarkerClick={handleMarkerClick} pinColor={pinColor}/>}
      </div>

      {/* ═══════════════ MENU ═══════════════ */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 flex">

          {/* Left panel */}
          <div ref={leftPanelRef} className="flex flex-col justify-between px-12 py-10 z-10" style={{ width: '42%' }}>

            {/* Branding */}
            <div>
              <p className="text-[9px] font-mono tracking-[0.35em] text-cyan-400/50 uppercase mb-4">
                ◈ Chronoguard Ops · Lv {playerState.level}
              </p>
              <h1
                className="leading-none font-black uppercase mb-2"
                style={{
                  fontFamily: 'var(--font-cinzel)',
                  fontSize: 'clamp(52px, 6vw, 80px)',
                  textShadow: '0 0 80px rgba(0,229,255,0.3), 0 0 160px rgba(0,229,255,0.1)',
                  WebkitTextStroke: '1px rgba(0,229,255,0.1)',
                }}
              >
                Wander<br/><span style={{ color: '#00E5FF' }}>Lore</span>
              </h1>
              <p className="text-[10px] font-mono text-neutral-600 tracking-[0.4em] uppercase mt-3 mb-10">
                Rewrite History · One Landmark at a Time
              </p>

              {/* Divider */}
              <div className="h-px mb-8" style={{ background: 'linear-gradient(to right, rgba(0,229,255,0.3), transparent)' }}/>

              {/* Mission list */}
              {/* ── Search bar ── */}
              <form onSubmit={handleSearch} className="flex gap-2 mb-5">
                <div className="flex-1 relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => { setSearchQuery(e.target.value); setSearchError(''); }}
                    placeholder="Search any landmark in the world..."
                    className="w-full text-sm text-white placeholder-neutral-700 pl-8 pr-3 py-2.5 rounded-xl focus:outline-none transition-colors"
                    style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)' }}
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
              {searchError && <p className="text-red-400 text-[10px] font-mono mb-3 -mt-2 pl-1">{searchError}</p>}
              <div className="flex items-center gap-2 mb-3">
                <p className="text-[9px] font-mono text-neutral-700 tracking-[0.3em] uppercase">Select Mission</p>
                <div className="flex items-center gap-1 ml-auto">
                  <div className="w-1 h-1 rounded-full bg-cyan-500/50"/>
                  <span className="text-[8px] font-mono text-neutral-700 tracking-wider">POWERED BY GEMINI</span>
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
                      className="mission-row group flex items-center gap-4 py-4 px-4 rounded-xl transition-all duration-200 text-left"
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
                      <span className="text-[11px] font-mono text-neutral-500 w-5 shrink-0">0{i+1}</span>

                      {/* Icon */}
                      <div style={{ color: t.color }} className="shrink-0 opacity-70 group-hover:opacity-100 transition-opacity">
                        <t.Icon/>
                      </div>

                      {/* Text */}
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-base text-neutral-200 group-hover:text-white transition-colors tracking-wide truncate">{m.name}</p>
                        <p className="text-[10px] font-mono mt-0.5" style={{ color: t.color, opacity: 0.65 }}>{t.label}</p>
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
                          <span className="text-[9px] font-mono text-neutral-500 group-hover:text-neutral-200 transition-colors tracking-wider">DEPLOY →</span>
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
            </div>

            {/* ── Discovered landmarks ── */}
            {discoveredLandmarks.length > 0 && (
              <div ref={discoveredRef} className="flex flex-col gap-1 mb-4">
                <p className="text-[9px] font-mono text-neutral-700 tracking-[0.3em] uppercase mb-2 flex items-center gap-2">
                  <span>Discovered</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px]" style={{ background: 'rgba(0,229,255,0.08)', color: '#00E5FF', border: '1px solid rgba(0,229,255,0.2)' }}>
                    {discoveredLandmarks.length} NEW
                  </span>
                </p>
                {discoveredLandmarks.map((m, i) => {
                  const t = getDiscoveredTheme(m.geminiColor);
                  const owner = factionMap[m.id];
                  const captured = owner && owner !== 'Unclaimed';
                  const mine = captured && owner === playerState.faction;
                  return (
                    <button
                      key={m.id}
                      onClick={() => handleSelectMission(m)}
                      className="discovered-card w-full text-left rounded-xl overflow-hidden transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                      style={{ background: 'rgba(6,6,12,0.95)', border: `1px solid ${t.border}`, boxShadow: `0 0 24px -8px ${t.glow}` }}
                    >
                      <div className="h-px w-full" style={{ background: `linear-gradient(to right, ${t.accent}, transparent)` }}/>
                      <div className="px-4 py-3 flex items-center gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <p className="font-bold text-sm text-white truncate">{m.name}</p>
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ color: t.accent, background: t.glow, border: `1px solid ${t.border}` }}>
                              GEMINI
                            </span>
                            {captured && (
                              <span className="text-[8px] font-mono px-1.5 py-0.5 rounded shrink-0" style={mine
                                ? { color: '#00E5FF', background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.3)' }
                                : { color: '#FF4040', background: 'rgba(255,64,64,0.08)', border: '1px solid rgba(255,64,64,0.3)' }}>
                                {mine ? '▲ YOURS' : '▼ ENEMY'}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] font-mono mb-0.5" style={{ color: t.accent, opacity: 0.65 }}>{m.era}</p>
                          <p className="text-[9px] text-neutral-700 truncate">{(m as DiscoveredLandmark).location}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1.5 shrink-0">
                          <div className="flex gap-0.5">
                            {[1,2,3,4,5].map(d => (
                              <div key={d} className="w-1 h-1 rounded-full" style={{ background: d <= m.baseDifficulty ? t.accent : 'rgba(255,255,255,0.08)' }}/>
                            ))}
                          </div>
                          <span className="text-[9px] font-mono text-neutral-600 tracking-wider">DEPLOY →</span>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="flex items-center gap-3 opacity-30">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400" style={{ animation: 'flicker 2s ease-in-out infinite' }}/>
              <p className="text-[9px] font-mono tracking-widest uppercase">WanderLore · Temporal Ops v1.0</p>
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
          <header className="pointer-events-auto flex justify-between items-center px-7 pt-5">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded border border-cyan-500/30 bg-cyan-500/8 flex items-center justify-center">
                <div className="w-2 h-2 rounded-full bg-cyan-400" style={{ animation: 'flicker 2.4s ease-in-out infinite' }}/>
              </div>
              <div>
                <p className="text-[9px] font-mono text-cyan-400/60 tracking-[0.2em] uppercase">Operative</p>
                <p className="text-sm font-semibold">{playerState.faction} · Lv {playerState.level}</p>
              </div>
            </div>
            {activeMeta && (
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
                  <div style={{ color: activeMeta.color }}><activeMeta.Icon/></div>
                  <div className="text-right">
                    <p className="text-xs font-bold">{activeTarget?.name}</p>
                    <p className="text-[9px] font-mono" style={{ color: activeMeta.color, opacity: 0.7 }}>{activeMeta.label}</p>
                  </div>
                </div>
              </div>
            )}
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
                        <p className="text-xs font-bold tracking-widest uppercase" style={{ color: activeMeta?.color }}>
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

            {/* ENCOUNTER (Visual Novel Layout) */}
            {gameState === 'encounter' && encounterData && (
              <div className="absolute inset-x-0 bottom-0 p-8 flex justify-center pointer-events-auto">
                <div className="w-full max-w-5xl flex items-end gap-6">
                  
                  {/* Character Portrait */}
                  <div className="w-56 h-56 shrink-0 relative drop-shadow-2xl transform translate-y-2">
                    <img 
                      src={encounterData.portraitUrl} 
                      alt={encounterData.characterName} 
                      className="w-full h-full object-contain drop-shadow-[0_0_20px_rgba(0,229,255,0.4)]" 
                    />
                  </div>

                  {/* Dialogue & Input Box */}
                  <div className="flex-1 rounded-2xl p-6 backdrop-blur-xl mb-4"
                       style={{ background:'rgba(3,3,7,0.90)', border:'1px solid rgba(0,229,255,0.3)', boxShadow:'0 0 80px -20px rgba(0,229,255,0.2), inset 0 1px 0 rgba(255,255,255,0.04)' }}>
                    
                    {/* Header */}
                    <div className="flex items-end gap-3 mb-2">
                      <span className="text-2xl font-black uppercase text-cyan-400 tracking-wider" style={{ fontFamily:'var(--font-cinzel)', textShadow:'0 0 20px rgba(0,229,255,0.5)' }}>
                        {encounterData.characterName}
                      </span>
                      <span className="text-xs font-mono text-cyan-100 uppercase tracking-widest opacity-60 mb-1">
                        [{encounterData.characterPersona}]
                      </span>
                    </div>
                    
                    <div className="h-px bg-gradient-to-r from-cyan-500/40 to-transparent mb-4"/>
                    
                    {/* The Puzzle Text */}
                    <div className="mb-6 space-y-3">
                      <p className="text-sm text-neutral-200 leading-relaxed">
                        "{encounterData.puzzleBeginning}"
                      </p>
                      <p className="text-sm font-bold text-red-400 leading-relaxed">
                        "{encounterData.puzzleEnd}"
                      </p>
                    </div>

                    {/* Text Input Form */}
                    <form onSubmit={handleSubmitGuess} className="flex gap-3 mt-auto">
                      <input
                        type="text"
                        value={playerGuess}
                        onChange={e => setPlayerGuess(e.target.value)}
                        placeholder="Type your deduction of the Secret Truth..."
                        className="flex-1 bg-black/60 border border-neutral-700 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-cyan-400 transition-colors"
                      />
                      <button
                        type="submit"
                        disabled={!playerGuess.trim()}
                        className="px-8 py-3 rounded-xl text-xs font-bold tracking-widest uppercase transition-all disabled:opacity-30"
                        style={{ background:'rgba(0,229,255,0.1)', border:'1px solid rgba(0,229,255,0.3)', color:'#00E5FF' }}
                      >
                        Interrogate
                      </button>
                    </form>
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
