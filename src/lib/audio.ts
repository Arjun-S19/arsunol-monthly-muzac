export class AudioViz {
  private ctx!: AudioContext;
  private analyser!: AnalyserNode;
  private gain!: GainNode;
  public data!: Uint8Array<ArrayBuffer>;
  public ready = false;
  private trackSource: AudioBufferSourceNode | null = null;
  private trackStartedAt = 0;
  private trackBuffer: AudioBuffer | null = null;
  private virtualTime = 0;
  private lastPerfUpdate = performance.now();

  async init() {
    if (this.ready) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.gain = this.ctx.createGain();
    this.analyser = this.ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.86;
    this.data = new Uint8Array(new ArrayBuffer(this.analyser.frequencyBinCount));
    this.gain.gain.value = 0.0;
    this.gain.connect(this.analyser).connect(this.ctx.destination);
    this.ready = true;
  }

  setDb(db: number) {
    if (!isFinite(db) || db <= -80) {
      this.gain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
      return;
    }
    const g = Math.pow(10, db / 20);
    this.gain.gain.setTargetAtTime(g, this.ctx.currentTime, 0.05);
  }

  pull() {
    if (!this.ready) return;
    const now = performance.now();
    const dt = (now - this.lastPerfUpdate) / 1000;
    this.lastPerfUpdate = now;
    if (this.trackBuffer && this.ctx.state !== 'running') {
      this.virtualTime = (this.virtualTime + dt) % this.trackBuffer.duration;
    }
    this.analyser.getByteTimeDomainData(this.data);
  }

  resume() {
    this.ctx?.resume();
  }
  pause() {
    this.ctx?.suspend();
  }

  async loadAndPlayLoop(url: string) {
    if (!this.ready) await this.init();
    const res = await fetch(url);
    const buf = await res.arrayBuffer();
    this.trackBuffer = await this.ctx.decodeAudioData(buf);
    if (this.trackSource) { try { this.trackSource.stop(); } catch { } }
    const src = this.ctx.createBufferSource();
    src.buffer = this.trackBuffer;
    src.loop = true;
    src.connect(this.gain);
    src.start();
    this.trackSource = src;
    this.trackStartedAt = this.ctx.currentTime;
    this.virtualTime = 0;
    this.lastPerfUpdate = performance.now();
  }

  getTrackSamplePosition(): number {
    if (!this.trackBuffer || !this.trackSource) return 0;
    if (this.ctx.state === 'running') {
      const dur = this.trackBuffer.duration;
      const rel = (this.ctx.currentTime - this.trackStartedAt) % dur;
      return Math.floor(rel * this.trackBuffer.sampleRate);
    } else {
      return Math.floor(this.virtualTime * this.trackBuffer.sampleRate);
    }
  }
  getTrackChannels(): { L: Float32Array; R: Float32Array | null } | null {
    if (!this.trackBuffer) return null;
    const L = this.trackBuffer.getChannelData(0);
    const R = this.trackBuffer.numberOfChannels > 1 ? this.trackBuffer.getChannelData(1) : null;
    return { L, R };
  }
}
