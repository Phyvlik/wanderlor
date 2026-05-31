// app/page.tsx
'use client';

import { useState } from 'react';
import { Map, Crosshair, AlertTriangle, Shield, Globe } from 'lucide-react';
import type { LandmarkEncounterResponse } from '../types';
import MapLayer from '../components/MapLayer';
import { landmarkRegistry, type Landmark } from './data/landmarks';
export default function GameHUD() {
  const [gameState, setGameState] = useState<'menu' | 'flying' | 'loading' | 'encounter' | 'resolving' | 'result'>('menu');
  const [activeTarget, setActiveTarget] = useState<Landmark | null>(null);
  const [encounterData, setEncounterData] = useState<LandmarkEncounterResponse | null>(null);
  const [resultData, setResultData] = useState<any>(null);

  const playerState = { playerId: "demo_user_1", faction: "Chronoguard", level: 5 };

  const handleSelectMission = (mission: Landmark) => {
    setActiveTarget(mission);
    setGameState('flying');
  };

  const handleArrive = async (landmarkId: string, landmarkName: string) => {
    setGameState('loading');
    try {
      const res = await fetch('/api/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarkId, landmarkName, playerState })
      });
      const data = await res.json();
      
      if (!res.ok || !data.choices) throw new Error("Backend failed");
      
      setEncounterData(data);
      setGameState('encounter');
    } catch (error) {
      console.error("Encounter Failed");
      setGameState('menu'); 
    }
  };

  const handleMakeChoice = async (choiceText: string) => {
    if (!activeTarget) return;
    setGameState('resolving');
    try {
      setTimeout(() => {
        setResultData({ success: Math.random() > 0.5, resultText: "The timeline has shifted based on your actions." });
        setGameState('result');
      }, 1500);
    } catch (error) {
      setGameState('menu');
    }
  };

  // This ONLY fires when the user clicks the red dot
  const handleMarkerClick = async (landmarkId: string, landmarkName: string) => {
    setGameState('loading');
    try {
      const res = await fetch('/api/encounter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landmarkId, landmarkName, playerState })
      });
      const data = await res.json();
      
      if (!res.ok || !data.choices) throw new Error("Backend failed");
      
      setEncounterData(data);
      setGameState('encounter');
    } catch (error) {
      console.error("Encounter Failed");
      setGameState('menu'); 
    }
  };

  return (
    <main className="relative w-screen h-screen bg-neutral-950 overflow-hidden font-sans text-white">
      
      <div className="absolute inset-0">
        {activeTarget && (
          <MapLayer target={activeTarget} onMarkerClick={handleMarkerClick} />
        )}
      </div>

      <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between">
        
        <header className="flex justify-between items-start pointer-events-auto">
          <div className="bg-black/60 backdrop-blur-md border border-cyan-500/30 p-4 rounded-xl flex items-center gap-4">
            <Shield className="text-cyan-400" />
            <div>
              <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider">Active Agent</p>
              <p className="text-lg font-semibold">{playerState.faction} Operative</p>
            </div>
          </div>
        </header>

        <div className="flex-1 flex items-center justify-center pointer-events-auto">
          
          {gameState === 'menu' && (
            <div className="bg-black/80 border border-neutral-700 p-8 rounded-2xl max-w-lg w-full backdrop-blur-md">
              <div className="flex items-center gap-3 mb-6 border-b border-neutral-800 pb-4">
                <Globe className="text-cyan-400" size={32} />
                <h1 className="text-2xl font-bold tracking-widest uppercase text-cyan-50">Select Target Era</h1>
              </div>
              <div className="flex flex-col gap-3">
                {landmarkRegistry.map(mission => (
                  <button
                    key={mission.id}
                    onClick={() => handleSelectMission(mission)}
                    className="flex justify-between items-center p-4 bg-neutral-900 border border-neutral-800 hover:border-cyan-500 hover:bg-neutral-800 rounded-xl transition-all group"
                  >
                    <span className="font-semibold text-neutral-200 group-hover:text-cyan-400">
                      {mission.name}
                    </span>
                    <Crosshair size={18} className="text-neutral-600 group-hover:text-cyan-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STATE: FLYING / EXPLORING */}
          {gameState === 'flying' && activeTarget && (
            <div className="flex flex-col items-center bg-black/60 backdrop-blur-sm border border-cyan-500/50 p-6 rounded-xl pointer-events-none mt-[60vh]">
              <Crosshair className="text-cyan-400 animate-pulse mb-3" size={32} />
              <h3 className="font-bold text-xl tracking-widest uppercase text-cyan-400 drop-shadow-md mb-2">
                Deploying to {activeTarget.name}
              </h3>
              <p className="text-neutral-200 font-medium">
                Use <span className="text-white font-bold bg-neutral-800 px-2 py-1 rounded">W A S D</span> to walk. Use Mouse to look.
              </p>
              <p className="text-red-400 font-bold mt-2 animate-bounce">
                Find and click the Red Anomaly Marker!
              </p>
            </div>
          )}

          {(gameState === 'loading' || gameState === 'resolving') && (
            <div className="bg-black/80 border border-cyan-500 p-8 rounded-xl flex flex-col items-center animate-pulse">
              <AlertTriangle className="text-cyan-400 mb-4 animate-bounce" size={32} />
              <p className="tracking-widest uppercase font-bold text-cyan-400">
                {gameState === 'loading' ? 'Analyzing Temporal Anomaly...' : 'Calculating Timeline Trajectory...'}
              </p>
            </div>
          )}

          {gameState === 'encounter' && encounterData && (
            <div className="bg-black/90 border border-red-500/50 shadow-[0_0_50px_-12px_rgba(239,68,68,0.3)] p-8 rounded-2xl max-w-2xl w-full backdrop-blur-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-3xl font-bold text-red-400 uppercase tracking-tight">{encounterData.title}</h2>
              </div>
              <p className="text-lg text-neutral-300 leading-relaxed mb-8">
                {encounterData.storyDescription}
              </p>
              <div className="space-y-4">
                {encounterData.choices.map((choice, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleMakeChoice(choice)}
                    className="w-full text-left p-4 bg-neutral-900 border border-neutral-700 hover:border-cyan-400 rounded-xl transition-all font-medium text-neutral-200"
                  >
                    <span className="text-cyan-500 mr-3 font-bold">[{idx + 1}]</span>
                    {choice}
                  </button>
                ))}
              </div>
            </div>
          )}

          {gameState === 'result' && resultData && (
            <div className={`bg-black/90 border p-8 rounded-2xl max-w-xl w-full backdrop-blur-xl text-center shadow-2xl ${resultData.success ? 'border-cyan-500 shadow-cyan-500/20' : 'border-red-500 shadow-red-500/20'}`}>
              <h2 className={`text-3xl font-bold mb-4 uppercase tracking-wider ${resultData.success ? 'text-cyan-400' : 'text-red-500'}`}>
                {resultData.success ? 'Timeline Secured' : 'Anomaly Fractured'}
              </h2>
              <p className="text-neutral-300 text-lg mb-8">{resultData.resultText}</p>
              <button 
                onClick={() => {
                  setGameState('menu');
                  setActiveTarget(null);
                }}
                className="px-8 py-3 bg-neutral-800 hover:bg-neutral-700 border border-neutral-600 rounded-lg transition-colors"
              >
                Return to Command Center
              </button>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}