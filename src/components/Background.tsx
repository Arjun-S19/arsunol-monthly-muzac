import { useEffect, useRef } from 'react';
import { AsciiWaves } from '../lib/asciiLayers';
import { AudioViz } from '../lib/audio';
import { initBackgroundAudio } from '../lib/backgroundAudio';

type Layers = {
  darkCanvas: HTMLCanvasElement;
  audioCanvas: HTMLCanvasElement;
};

function ensureLayers(): Layers {
  const doc = document;
  const root = doc.body;
  const setSharedStyles = (el: HTMLElement, z: number) => {
    el.style.position = 'fixed';
    el.style.inset = '0';
    el.style.width = '100vw';
    el.style.height = '100vh';
    el.style.minWidth = '100vw';
    el.style.minHeight = '100vh';
    el.style.pointerEvents = 'none';
    el.style.zIndex = String(z);
  };

  let base = doc.getElementById('bg-layer1') as HTMLDivElement | null;
  if (!base) {
    base = doc.createElement('div');
    base.id = 'bg-layer1';
    setSharedStyles(base, 0);
    base.style.background = '#000';
    root.insertBefore(base, root.firstChild);
  }

  const getCanvas = (id: string, z: number) => {
    let canvas = doc.getElementById(id) as HTMLCanvasElement | null;
    if (!canvas) {
      canvas = doc.createElement('canvas');
      canvas.id = id;
      setSharedStyles(canvas, z);
      root.insertBefore(canvas, base!.nextSibling);
    }
    return canvas;
  };

  return {
    darkCanvas: getCanvas('bg-layer2', 1),
    audioCanvas: getCanvas('bg-layer3', 2)
  };
}

export default function Background() {
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const { darkCanvas, audioCanvas } = ensureLayers();
    const waves = new AsciiWaves(darkCanvas, audioCanvas, {
      cellW: 8,
      cellH: 14,
      darkColor: '#232323',
      lightColor: '#cfcfcf'
    });
    waves.setOverlayMode('edge');
    waves.setOverlaySmoothing(0.65);

    const audio = new AudioViz();
    if (!audio.ready) {
      audio.init().then(() => audio.setDb(-Infinity)).catch(() => undefined);
    } else {
      audio.setDb(-Infinity);
    }
    const audioHandle = initBackgroundAudio(audio, `${import.meta.env.BASE_URL ?? ''}kyoto.wav`, -Infinity);
    const fallback = new Uint8Array(1024);

    const tick = () => {
      try {
        audio.pull?.();
      } catch {
      }
      const domain = (audio as any)?.data as Uint8Array | undefined;
      waves.frame(domain && domain.length ? domain : fallback);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      audioHandle?.dispose?.();
    };
  }, []);

  return null;
}
