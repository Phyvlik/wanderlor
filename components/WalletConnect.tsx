'use client';
import { useState, useEffect } from 'react';

interface Props {
  onConnect: (address: string) => void;
  onDisconnect?: () => void;
}

export default function WalletConnect({ onConnect, onDisconnect }: Props) {
  const [address, setAddress]       = useState('');
  const [connecting, setConnecting] = useState(false);
  const [phantom, setPhantom]       = useState(false);

  useEffect(() => {
    const provider = (window as any).solana;
    setPhantom(!!provider?.isPhantom);

    // Auto-reconnect if user already connected in this browser
    if (provider?.isPhantom) {
      provider.connect({ onlyIfTrusted: true })
        .then((resp: any) => {
          const addr = resp.publicKey.toString();
          setAddress(addr);
          onConnect(addr);
        })
        .catch(() => {});
    }
  }, []);

  const connect = async () => {
    const provider = (window as any).solana;
    if (!provider?.isPhantom) {
      window.open('https://phantom.app', '_blank');
      return;
    }
    setConnecting(true);
    try {
      const resp = await provider.connect();
      const addr = resp.publicKey.toString();
      setAddress(addr);
      onConnect(addr);
    } catch {}
    setConnecting(false);
  };

  const disconnect = async () => {
    try { await (window as any).solana?.disconnect(); } catch {}
    setAddress('');
    onDisconnect?.();
  };

  if (address) {
    return (
      <div className="flex items-center gap-2">
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
          style={{ background: 'rgba(153,69,255,0.1)', border: '1px solid rgba(153,69,255,0.35)' }}
          title={address}
        >
          <svg width="14" height="14" viewBox="0 0 128 128" fill="none">
            <circle cx="64" cy="64" r="64" fill="#9945FF"/>
            <path d="M109 80H43a4 4 0 0 1-4-4V52a4 4 0 0 1 4-4h66a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4z" fill="white"/>
            <circle cx="94" cy="64" r="6" fill="#9945FF"/>
          </svg>
          <span className="text-xs font-mono" style={{ color: '#b57bff' }}>
            {address.slice(0, 4)}…{address.slice(-4)}
          </span>
          <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse"/>
        </div>
        <button
          onClick={disconnect}
          className="px-2 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95"
          style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid rgba(255,60,60,0.3)', color: '#ff6b6b' }}
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={connect}
      disabled={connecting}
      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[10px] font-mono tracking-wider uppercase transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
      style={{ background: 'rgba(153,69,255,0.1)', border: '1px solid rgba(153,69,255,0.35)', color: '#9945FF' }}
    >
      {connecting
        ? <span className="w-3 h-3 rounded-full border-2 border-t-purple-400 border-purple-500/20 animate-spin"/>
        : <svg width="12" height="12" viewBox="0 0 128 128" fill="none"><circle cx="64" cy="64" r="64" fill="#9945FF"/><path d="M109 80H43a4 4 0 0 1-4-4V52a4 4 0 0 1 4-4h66a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4z" fill="white"/><circle cx="94" cy="64" r="6" fill="#9945FF"/></svg>
      }
      {connecting ? 'Connecting…' : phantom ? 'Connect Phantom' : 'Get Phantom'}
    </button>
  );
}
