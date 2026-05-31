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
}

export default function MapLayer({ target, onMarkerClick }: MapLayerProps) {
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

    // --- FIX 1: THE LAPTOP TRACKPAD & FPS MOUSE FIX ---
    // 1. Stop grabbing the Earth (Disables orbiting)
    viewer.scene.screenSpaceCameraController.enableRotate = false; 
    // 2. Make Left-Click-Drag turn your head in place (FPS Style)
    viewer.scene.screenSpaceCameraController.lookEventTypes = [window.Cesium.CameraEventType.LEFT_DRAG];
    // 3. Keep two-finger trackpad swipe / scroll wheel for zooming
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

    // --- FIX 2: THE BULLETPROOF CLICK HANDLER ---
    const handler = new window.Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: any) => {
      // Grab whatever pixel the mouse just touched
      const pickedObject = viewer.scene.pick(click.position);
      
      // Print it to the browser console so we can see if you missed!
      console.log("🎯 YOU CLICKED ON:", pickedObject); 

      if (window.Cesium.defined(pickedObject) && pickedObject.id) {
        const entity = pickedObject.id;
        
        // Double check that it has our custom ID and Name
        if (entity.id && entity.name) {
          console.log("🚀 LAUNCHING AI FOR:", entity.name);
          clickHandlerRef.current(entity.id as string, entity.name as string);
        }
      } else {
         console.log("❌ Missed the pin. You clicked empty space or a building.");
      }
    }, window.Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Also trigger on Left-UP just in case the trackpad drag cancels the click
    handler.setInputAction((click: any) => {
      const pickedObject = viewer.scene.pick(click.position);
      if (window.Cesium.defined(pickedObject) && pickedObject.id && pickedObject.id.id && pickedObject.id.name) {
        clickHandlerRef.current(pickedObject.id.id as string, pickedObject.id.name as string);
      }
    }, window.Cesium.ScreenSpaceEventType.LEFT_UP);

    return () => {
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

    const pinBuilder = new window.Cesium.PinBuilder();
    const pinIcon = pinBuilder.fromColor(window.Cesium.Color.CRIMSON, 56).toDataURL(); // Made the pin larger!

    viewer.entities.add({
      id: target.id, 
      name: target.name,
      position: window.Cesium.Cartesian3.fromDegrees(target.lng, target.lat, target.height),
      billboard: {
        image: pinIcon,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
        width: 56, // Bigger hitbox for clicking!
        height: 56,
        disableDepthTestDistance: Number.POSITIVE_INFINITY 
      },
      label: {
        text: "CLICK TO SCAN",
        font: 'bold 16pt sans-serif', // Bigger text!
        fillColor: window.Cesium.Color.WHITE,
        style: window.Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 4,
        outlineColor: window.Cesium.Color.BLACK,
        verticalOrigin: window.Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new window.Cesium.Cartesian2(0, -65), 
        disableDepthTestDistance: Number.POSITIVE_INFINITY
      }
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

  }, [target]);

  return <div ref={mapContainer} className="w-full h-full cursor-crosshair" />;
}