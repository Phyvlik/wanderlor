'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

/* ── Static landmark → country mapping ─────────────────── */
const LANDMARK_COUNTRY: Record<string, string> = {
  colosseum_rome:     'Italy',
  eiffel_tower_paris: 'France',
  tokyo_tower_japan:  'Japan',
};

const STATIC_PINS = [
  { id: 'colosseum_rome',     lat: 41.9, lng:  12.5, color: '#FFB800', label: 'ROME'  },
  { id: 'eiffel_tower_paris', lat: 48.9, lng:   2.3, color: '#00E5FF', label: 'PARIS' },
  { id: 'tokyo_tower_japan',  lat: 35.7, lng: 139.7, color: '#FF4040', label: 'TOKYO' },
];

export interface ExtraPin {
  id: string; lat: number; lng: number;
  color: string; label: string;
}

interface Props {
  factionMap: Record<string, string>;
  playerFaction: string;
  extraPins?: ExtraPin[];
  discoveredLandmarks?: Array<{ id: string; location: string }>;
}

export default function Globe3D({
  factionMap, playerFaction,
  extraPins = [], discoveredLandmarks = [],
}: Props) {
  const globeRef      = useRef<any>(null);
  const containerRef  = useRef<HTMLDivElement>(null);
  const GlobeComp     = useRef<any>(null);
  const [ready,   setReady]   = useState(false);
  const [countries, setCountries] = useState<any>({ features: [] });
  const [size, setSize] = useState({ w: 0, h: 0 });

  /* Dynamic import — no SSR */
  useEffect(() => {
    import('react-globe.gl').then(m => { GlobeComp.current = m.default; setReady(true); });
  }, []);

  /* Country GeoJSON */
  useEffect(() => {
    fetch('https://raw.githubusercontent.com/vasturiano/react-globe.gl/master/example/datasets/ne_110m_admin_0_countries.geojson')
      .then(r => r.json()).then(setCountries).catch(() => {});
  }, []);

  /* Container size */
  useEffect(() => {
    const el = containerRef.current; if (!el) return;
    const ro = new ResizeObserver(e => {
      const { width: w, height: h } = e[0].contentRect;
      setSize({ w, h });
    });
    ro.observe(el); return () => ro.disconnect();
  }, []);

  /* Globe setup after mount */
  useEffect(() => {
    if (!globeRef.current) return;
    const ctrl = globeRef.current.controls();
    ctrl.autoRotate      = true;
    ctrl.autoRotateSpeed = 0.7;
    ctrl.enableZoom      = false;
    ctrl.enablePan       = false;
    globeRef.current.pointOfView({ altitude: 1.7 }); // closer = bigger globe
  }, [ready]);

  /* Which countries are captured and by whom */
  const capturedCountries = useMemo(() => {
    const map: Record<string, string> = {}; // country name → faction
    Object.entries(factionMap).forEach(([id, faction]) => {
      if (!faction || faction === 'Unclaimed') return;
      // Static
      if (LANDMARK_COUNTRY[id]) map[LANDMARK_COUNTRY[id]] = faction;
      // Discovered
      const disc = discoveredLandmarks.find(d => d.id === id);
      if (disc?.location) {
        const parts = disc.location.split(',');
        const country = parts[parts.length - 1].trim();
        if (country) map[country] = faction;
      }
    });
    return map;
  }, [factionMap, discoveredLandmarks]);

  /* All pins merged */
  const allPins = useMemo(() => {
    const resolve = (id: string, base: string) => {
      const f = factionMap[id];
      if (f && f !== 'Unclaimed') return f === playerFaction ? '#00E5FF' : '#FF4040';
      return base;
    };
    return [
      ...STATIC_PINS.map(p => ({ ...p, color: resolve(p.id, p.color), size: 0.55 })),
      ...extraPins.map(p => ({
        ...p,
        // Use city portion of location for label if stored, else use what was passed
        color: resolve(p.id, p.color),
        size: 0.45,
      })),
    ];
  }, [factionMap, playerFaction, extraPins]);

  /* Country polygon color */
  const polyColor = (feat: any) => {
    const name: string = feat.properties?.NAME || feat.properties?.ADMIN || '';
    const match = Object.entries(capturedCountries).find(([country]) => {
      const n = name.toLowerCase(), c = country.toLowerCase();
      return n === c || n.includes(c) || c.includes(n);
    });
    if (!match) return 'rgba(8,20,45,0.3)';
    // Gold for player, red for enemy
    return match[1] === playerFaction
      ? 'rgba(255,190,40,0.55)'
      : 'rgba(255,30,68,0.5)';
  };

  const polySideColor = (feat: any) => {
    const name: string = feat.properties?.NAME || '';
    const match = Object.entries(capturedCountries).find(([c]) => {
      const n = name.toLowerCase(), cc = c.toLowerCase();
      return n === cc || n.includes(cc) || cc.includes(n);
    });
    if (!match) return 'rgba(0,0,0,0)';
    return match[1] === playerFaction ? 'rgba(255,190,40,0.4)' : 'rgba(255,30,68,0.4)';
  };

  const polyAltitude = (feat: any) => {
    const name: string = feat.properties?.NAME || '';
    const captured = Object.keys(capturedCountries).some(c => {
      const n = name.toLowerCase(), cc = c.toLowerCase();
      return n === cc || n.includes(cc) || cc.includes(n);
    });
    return captured ? 0.03 : 0.005;
  };

  const hasCaptured = Object.keys(capturedCountries).length > 0;

  if (!ready || !GlobeComp.current) {
    return <div ref={containerRef} className="w-full h-full"/>;
  }

  const Globe = GlobeComp.current;

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      onMouseEnter={() => globeRef.current?.controls() && (globeRef.current.controls().autoRotateSpeed = 0.15)}
      onMouseLeave={() => globeRef.current?.controls() && (globeRef.current.controls().autoRotateSpeed = 0.7)}
      style={{
        filter: hasCaptured
          ? 'drop-shadow(0 0 40px rgba(255,190,40,0.2)) drop-shadow(0 0 80px rgba(0,100,255,0.15))'
          : 'drop-shadow(0 0 40px rgba(0,100,255,0.2))',
        transition: 'filter 1s ease',
      }}
    >
      {size.w > 0 && (
        <Globe
          ref={globeRef}
          width={size.w}
          height={size.h}

          /* ── Earth texture ── */
          globeImageUrl="//unpkg.com/three-globe/example/img/earth-dark.jpg"
          bumpImageUrl="//unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="rgba(0,0,0,0)"
          backgroundImageUrl={null}
          showAtmosphere
          atmosphereColor="rgba(30,160,255,0.9)"
          atmosphereAltitude={0.22}

          /* ── Country polygons ── */
          polygonsData={countries.features}
          polygonCapColor={polyColor}
          polygonStrokeColor={() => 'rgba(0,229,255,0.22)'}
          polygonSideColor={polySideColor}
          polygonAltitude={polyAltitude}

          /* ── Location pins ── */
          pointsData={allPins}
          pointLat={(p: any) => p.lat}
          pointLng={(p: any) => p.lng}
          pointColor={(p: any) => p.color}
          pointAltitude={0.025}
          pointRadius={(p: any) => p.size}
          pointsMerge={false}
          pointResolution={16}

          /* ── Labels ── */
          labelsData={allPins}
          labelLat={(p: any) => p.lat}
          labelLng={(p: any) => p.lng}
          labelText={(p: any) => p.label}
          labelColor={(p: any) => p.color}
          labelSize={1.3}
          labelDotRadius={0}
          labelAltitude={0.03}
          labelResolution={2}
        />
      )}
    </div>
  );
}
