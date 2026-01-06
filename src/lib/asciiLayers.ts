type Ctx2D = CanvasRenderingContext2D;
type U8 = Uint8Array;

const RAMP =
  " .'`^\",:;Il!i><~+_-?][}{1)(|\\/*tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";

export type LayersConfig = {
  cellW: number;
  cellH: number;
  darkColor: string;
  lightColor: string;
};

export class AsciiWaves {
  private dark!: HTMLCanvasElement;
  private audio!: HTMLCanvasElement;
  private dtx!: Ctx2D;
  private atx!: Ctx2D;
  private cols = 0;
  private rows = 0;
  private t0 = performance.now();
  private frameInterval = 1000 / 30; // fps cap (default 30)
  private lastFrameTime = 0;
  private cfg: LayersConfig;
  private overlay: Uint8Array | null = null;
  private overlayMode: 'normal' | 'edge' = 'normal';
  private lastOverlay: Uint8Array | null = null;
  private overlaySmooth = 0.5;

  private waves = Array.from({ length: 4 }, (_, k) => ({
    phase: Math.random() * Math.PI * 2,
    speed: (k % 2 ? -1 : 1) * (0.25 + Math.random() * 0.35),
    amp: 0.9 - k * 0.12,
    fx: 0.8 + Math.random() * 1.2
  }));
  constructor(
    dark: HTMLCanvasElement,
    audio: HTMLCanvasElement,
    cfg: LayersConfig
  ) {
    this.cfg = cfg;
    this.dark = dark;
    this.audio = audio;
    this.dtx = dark.getContext("2d")!;
    this.atx = audio.getContext("2d")!;
    this.fit();
    addEventListener("resize", () => {
      this.fit();
    });
  }

  fit() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const dpr = window.devicePixelRatio || 1;
    const scaleFactor = Math.min(1, dpr);
    const densityScale = scaleFactor < 0.95 ? 0.75 : 1;
    const effectiveCellW = this.cfg.cellW / densityScale;
    const effectiveCellH = this.cfg.cellH / densityScale;
    this.cols = Math.max(60, Math.floor(width / effectiveCellW));
    this.rows = Math.max(30, Math.floor(height / effectiveCellH));
    [this.dark, this.audio].forEach((c) => {
      c.width = this.cols * this.cfg.cellW;
      c.height = this.rows * this.cfg.cellH;
      c.style.width = '100vw';
      c.style.height = '100vh';
      const ctx = c.getContext("2d")!;
      ctx.font = `${this.cfg.cellH - 2}px ui-monospace, monospace`;
      ctx.textBaseline = "top";
      (ctx as any).imageSmoothingEnabled = false;
    });
  }

  getCols() { return this.cols; }
  getRows() { return this.rows; }
  setOverlay(buf: Uint8Array | null) {
    if (!buf) { this.overlay = null; return; }
    if (this.lastOverlay && this.lastOverlay.length === buf.length && this.overlaySmooth > 0) {
      const a = this.lastOverlay;
      const k = this.overlaySmooth;
      for (let i = 0; i < a.length; i++) {
        a[i] = a[i] + (buf[i] - a[i]) * (1 - k);
      }
      this.overlay = a;
    } else {
      this.lastOverlay = new Uint8Array(buf);
      this.overlay = this.lastOverlay;
    }
  }
  setOverlayMode(mode: 'normal' | 'edge') { this.overlayMode = mode; }
  setOverlaySmoothing(f: number) { this.overlaySmooth = Math.min(0.95, Math.max(0, f)); }
  setMaxFps(fps: number) {
    const clamped = Math.max(10, Math.min(60, Math.floor(fps || 30)));
    this.frameInterval = 1000 / clamped;
  }

  private drawDark(now: number) {
    const t = (now - this.t0) / 1400;
    const ctx = this.dtx;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.dark.width, this.dark.height);

    for (const w of this.waves) {
      w.phase += w.speed * 0.012;
    }

    const cols = this.cols,
      rows = this.rows;
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const x = i / cols,
          y = j / rows;
        let v = 0.2 * Math.sin((x - 0.7 * y) * 6.283 + t * 0.8);
        for (let k = 0; k < this.waves.length; k++) {
          const w = this.waves[k];
          const h = Math.sin((x * w.fx + y * 0.5) * 6.283 + w.phase);
          let gain = w.amp;
          if (k > 0) {
            const prev = Math.sin(
              (x * this.waves[k - 1].fx + y * 0.5) * 6.283 +
              this.waves[k - 1].phase
            );
            const prox = 1 - Math.min(1, Math.abs(h - prev));
            gain *= 0.65 + 0.35 * prox;
          }
          v += gain * h;
        }

        const n = (v + 3.0) / 6.0;
        const idx = Math.max(
          0,
          Math.min(RAMP.length - 1, Math.floor(n * RAMP.length))
        );
        const ch = RAMP[idx];
        ctx.fillStyle = this.cfg.darkColor;
        ctx.fillText(ch, i * this.cfg.cellW, j * this.cfg.cellH);
      }
    }
  }

  private drawAudio(domain: U8) {
    if (domain && domain.length) {
      void domain[0];
    }
    this.atx.clearRect(0, 0, this.audio.width, this.audio.height);
    if (!this.overlay) return;
    const buf = this.overlay;
    const cols = this.cols;
    const rows = this.rows;
    if (this.overlayMode === 'normal') {
      const ramp = RAMP;
      for (let j = 0; j < rows; j++) {
        for (let i = 0; i < cols; i++) {
          const idx = j * cols + i;
          const v = buf[idx];
          if (v < 16) continue;
          const n = v / 255;
          const ridx = Math.min(ramp.length - 1, (ramp.length - 1 - Math.floor(n * (ramp.length - 1))));
          const ch = ramp[ridx];
          this.atx.fillStyle = this.cfg.lightColor;
          this.atx.fillText(ch, i * this.cfg.cellW, j * this.cfg.cellH);
        }
      }
    } else {
      const palette = [
        { t: 210, ch: '#' },
        { t: 170, ch: '@' },
        { t: 140, ch: '%' },
        { t: 115, ch: '*' },
        { t: 90, ch: '+' },
        { t: 70, ch: '=' },
        { t: 55, ch: ':' },
        { t: 40, ch: '.' }
      ];
      for (let j = 1; j < rows - 1; j++) {
        for (let i = 1; i < cols - 1; i++) {
          const idx = j * cols + i;
          const v = buf[idx];
          if (v < 40) continue;
          let ch = '.';
          for (const p of palette) { if (v >= p.t) { ch = p.ch; break; } }
          this.atx.fillStyle = this.cfg.lightColor;
          this.atx.fillText(ch, i * this.cfg.cellW, j * this.cfg.cellH);
        }
      }
    }
  }

  frame(domain: U8) {
    const now = performance.now();
    if (now - this.lastFrameTime < this.frameInterval) return;
    this.lastFrameTime = now;
    this.drawDark(now);
    this.drawAudio(domain);
  }
}
