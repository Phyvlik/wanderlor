'use client';

import { useEffect, useRef } from 'react';

export interface LocationTarget {
  id: string;
  name: string;
  lng: number;
  lat: number;
  height: number;
}

interface MapLayerProps {
  target: LocationTarget;
  onMarkerClick: (landmarkId: string, landmarkName: string) => void;
  pinColor?: string;
}

function buildScannerPin(hex: string): string {
  const W = 160, H = 210;
  const canvas = document.createElement('canvas');
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  const cx = W / 2, cy = 66, R = 46;

  ctx.shadowColor = hex;
  ctx.shadowBlur = 18;

  // Broken outer ring (4 arcs with corner gaps)
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, R, i * Math.PI / 2 + 0.28, (i + 1) * Math.PI / 2 - 0.28);
    ctx.stroke();
  }

  // Tick marks at cardinal points (outside ring)
  ctx.lineWidth = 2;
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * (R + 6), cy + Math.sin(a) * (R + 6));
    ctx.lineTo(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16));
    ctx.stroke();
  }

  // Faint inner ring
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(cx, cy, R * 0.5, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Center diamond
  ctx.fillStyle = hex;
  ctx.shadowBlur = 28;
  ctx.beginPath();
  ctx.moveTo(cx, cy - 11); ctx.lineTo(cx + 8, cy);
  ctx.lineTo(cx, cy + 11); ctx.lineTo(cx - 8, cy);
  ctx.closePath();
  ctx.fill();

  // Stem
  ctx.shadowBlur = 10;
  ctx.strokeStyle = hex;
  ctx.lineWidth = 2;
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(cx, cy + R + 3);
  ctx.lineTo(cx, cy + R + 28);
  ctx.stroke();

  // Arrow tip (pointer)
  ctx.fillStyle = hex;
  ctx.globalAlpha = 1;
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(cx - 6, cy + R + 24);
  ctx.lineTo(cx + 6, cy + R + 24);
  ctx.lineTo(cx, cy + R + 38);
  ctx.closePath();
  ctx.fill();

  // Text box background
  ctx.shadowBlur = 0;
  ctx.globalAlpha = 0.72;
  ctx.fillStyle = '#000d1a';
  const ty = cy + R + 44, tw = 138, th = 28;
  ctx.fillRect(cx - tw / 2, ty, tw, th);
  ctx.globalAlpha = 0.7;
  ctx.strokeStyle = hex;
  ctx.lineWidth = 1;
  ctx.strokeRect(cx - tw / 2, ty, tw, th);

  // Label text
  ctx.shadowBlur = 12;
  ctx.shadowColor = hex;
  ctx.globalAlpha = 1;
  ctx.fillStyle = hex;
  ctx.font = 'bold 11px "Courier New", monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('[ CLICK TO SCAN ]', cx, ty + th / 2);

  return canvas.toDataURL();
}

export default function MapLayer({ target, onMarkerClick, pinColor }: MapLayerProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  
  const clickHandlerRef = useRef(onMarkerClick);
  useEffect(() => {
    clickHandlerRef.current = onMarkerClick;
  }, [onMarkerClick]);

  useEffect(() => {
    if (!window.Cesium || !mapContainer.current) return;
    if (viewerRef.current) return; 

    const viewer = new window.Cesium.Viewer(mapContainer.current, {
      animation: false,
      baseLayerPicker: false,
      baseLayer: false,
      fullscreenButton: false,
      geocoder: false,
      homeButton: false,
      infoBox: false,
      sceneModePicker: false,
      selectionIndicator: false,
      timeline: false,
      navigationHelpButton: false,
      requestRenderMode: false, 
    });
    
    viewerRef.current = viewer;
    viewer.cesiumWidget.creditContainer.style.display = 'none';

    viewer.scene.screenSpaceCameraController.enableRotate = false;
    viewer.scene.screenSpaceCameraController.lookEventTypes = []; // handled manually via pointer lock
    viewer.scene.screenSpaceCameraController.zoomEventTypes = [window.Cesium.CameraEventType.WHEEL, window.Cesium.CameraEventType.PINCH];

    window.Cesium.GoogleMaps.defaultApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
    window.Cesium.createGooglePhotorealistic3DTileset().then((tileset: any) => {
      viewer.scene.primitives.add(tileset);
    });

    const flags = { W: false, A: false, S: false, D: false };
    const getFlag = (code: string) => {
      switch(code) {
        case 'KeyW': return 'W';
        case 'KeyS': return 'S';
        case 'KeyD': return 'D';
        case 'KeyA': return 'A';
        default: return null;
      }
    };

    document.addEventListener('keydown', (e) => {
      const f = getFlag(e.code);
      if (f) flags[f as keyof typeof flags] = true;
    });

    document.addEventListener('keyup', (e) => {
      const f = getFlag(e.code);
      if (f) flags[f as keyof typeof flags] = false;
    });

    viewer.scene.preUpdate.addEventListener(() => {
      const camera = viewer.camera;
      const height = viewer.scene.globe.ellipsoid.cartesianToCartographic(camera.position).height;
      const moveRate = height / 50.0; 

      if (flags.W) camera.moveForward(moveRate);
      if (flags.S) camera.moveBackward(moveRate);
      if (flags.A) camera.moveLeft(moveRate);
      if (flags.D) camera.moveRight(moveRate);
    });

    // FPS mouse look via Pointer Lock
    const canvas = viewer.scene.canvas;
    const sensitivity = 0.003;

    // Software crosshair shown while pointer is locked (replaces hidden native cursor)
    const cursorEl = document.createElement('div');
    cursorEl.style.cssText = 'position:fixed;width:18px;height:18px;border:2.5px solid white;border-radius:50%;pointer-events:none;z-index:9999;transform:translate(-50%,-50%);display:none;box-shadow:0 0 6px rgba(0,0,0,0.9)';
    document.body.appendChild(cursorEl);

    let softX = window.innerWidth / 2;
    let softY = window.innerHeight / 2;
    const moveCursor = () => { cursorEl.style.left = softX + 'px'; cursorEl.style.top = softY + 'px'; };

    document.addEventListener('pointerlockchange', () => {
      if (document.pointerLockElement === canvas) {
        cursorEl.style.display = 'block';
      } else {
        cursorEl.style.display = 'none';
      }
    });

    const handleMouseLook = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      viewer.camera.lookRight(e.movementX * sensitivity);
      viewer.camera.lookDown(e.movementY * sensitivity);
      softX = Math.max(0, Math.min(window.innerWidth, softX + e.movementX));
      softY = Math.max(0, Math.min(window.innerHeight, softY + e.movementY));
      moveCursor();
    };
    document.addEventListener('mousemove', handleMouseLook);

    canvas.addEventListener('click', (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      let pickX: number, pickY: number;

      if (document.pointerLockElement === canvas) {
        // Use software cursor position when locked
        pickX = softX - rect.left;
        pickY = softY - rect.top;
      } else {
        // Use native cursor position and sync software cursor for when lock activates
        pickX = e.clientX - rect.left;
        pickY = e.clientY - rect.top;
        softX = e.clientX;
        softY = e.clientY;
        moveCursor();
      }

      const picked = viewer.scene.pick(new window.Cesium.Cartesian2(pickX, pickY));
      if (window.Cesium.defined(picked) && picked.id?.id && picked.id?.name) {
        document.exitPointerLock();
        clickHandlerRef.current(picked.id.id as string, picked.id.name as string);
      } else if (document.pointerLockElement !== canvas) {
        canvas.requestPointerLock();
      }
    });

    return () => {
      document.removeEventListener('mousemove', handleMouseLook);
      document.exitPointerLock();
      if (document.body.contains(cursorEl)) document.body.removeChild(cursorEl);
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!viewerRef.current || !target) return;
    const viewer = viewerRef.current;

    viewer.entities.removeAll();

    const hex = pinColor || '#00E5FF';
    const pinIcon = buildScannerPin(hex);

    viewer.entities.add({
      id: target.id,
      name: target.name,
      position: window.Cesium.Cartesian3.fromDegrees(target.lng, target.lat, target.height),
      billboard: {
        image: pinIcon,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
        width: 160,
        height: 210,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      },
    });

    viewer.camera.flyTo({
      destination: window.Cesium.Cartesian3.fromDegrees(target.lng, target.lat - 0.0015, target.height + 40),
      orientation: {
        heading: window.Cesium.Math.toRadians(0),
        pitch: window.Cesium.Math.toRadians(-10),
        roll: 0.0,
      },
      duration: 3 
    });

  }, [target, pinColor]);

  return <div ref={mapContainer} className="w-full h-full cursor-crosshair" />;
}