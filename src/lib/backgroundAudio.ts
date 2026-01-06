import { AudioViz } from './audio';

export interface BackgroundAudioHandle {
  dispose(): void;
}

export function initBackgroundAudio(audio: AudioViz, url: string, initialDb = -12): BackgroundAudioHandle {
  let armed = false;
  const start = async () => {
    if (armed) return; armed = true;
    try {
      if (!audio.ready) await audio.init();
      await audio.loadAndPlayLoop(url);
      if (!(window as any).__ARS_VOL_SET && typeof initialDb === 'number' && isFinite(initialDb)) {
        audio.setDb(initialDb);
      } else if (initialDb === -Infinity) {
        audio.setDb(-Infinity);
      }
      audio.resume();
    } catch (e) {
      console.error('Background audio failed to start', e);
      armed = false;
    }
  };
  const opts: AddEventListenerOptions = { once: true };
  const pointerHandler = (ev: Event) => {
    const pe = ev as PointerEvent;
    if (pe.pointerType === 'mouse') start();
  };
  window.addEventListener('pointerdown', pointerHandler, opts);

  return {
    dispose() {
      window.removeEventListener('pointerdown', pointerHandler, opts);
    }
  };
}
