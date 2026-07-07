/**
 * Procedural ljud via Web Audio — inga externa filer.
 * Vinjett: modern pop-loop (synth, trummor, bas).
 */
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.musicGain = null;
    this.sfxGain = null;
    this.unlocked = false;
    this.introNodes = [];
    this.introPlaying = false;
    this.introLoopTimer = null;
  }

  async ensureAudio() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      this.ctx = new Ctx();
      this.musicGain = this.ctx.createGain();
      this.sfxGain = this.ctx.createGain();
      this.musicGain.gain.value = 0.55;
      this.sfxGain.gain.value = 0.45;
      this.musicGain.connect(this.ctx.destination);
      this.sfxGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === "suspended") {
      try {
        await this.ctx.resume();
      } catch {
        return false;
      }
    }
    this.unlocked = this.ctx.state === "running";
    return this.unlocked;
  }

  /** Bakåtkompatibelt namn */
  unlock() {
    return this.ensureAudio();
  }

  stopIntro() {
    if (this.introLoopTimer) {
      clearTimeout(this.introLoopTimer);
      this.introLoopTimer = null;
    }
    for (const n of this.introNodes) {
      try {
        n.stop?.();
        n.disconnect?.();
      } catch { /* already stopped */ }
    }
    this.introNodes = [];
    this.introPlaying = false;
  }

  async startIntroIfNeeded() {
    const ok = await this.ensureAudio();
    if (!ok || this.introPlaying) return;
    this.playIntroFanfare();
  }

  /** Modern pop-vinjett — loopande synthpop (~32 s) */
  playIntroFanfare() {
    if (!this.ctx || this.ctx.state !== "running") return;
    this.stopIntro();
    this.introPlaying = true;

    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(this.musicGain);
    this.introNodes.push(master);

    const BPM = 120;
    const beat = 60 / BPM;
    const barBeats = 4;
    const bars = 16;
    const dur = bars * barBeats * beat;

    const chordRoots = [110, 87.31, 65.41, 98];
    const chordTriads = [
      [110, 130.81, 164.81],
      [87.31, 110, 130.81],
      [65.41, 82.41, 98],
      [98, 123.47, 146.83],
    ];
    // Am F C G | Am F C G | F C G Am | F C G Am
    const progression = [0, 1, 2, 3, 0, 1, 2, 3, 1, 2, 3, 0, 1, 2, 3, 0];

    const melody = [
      // Vers A
      [0, 440, 0.5], [0.5, 523.25, 0.5], [1, 659.25, 0.75], [2, 587.33, 0.5],
      [2.5, 523.25, 0.5], [3, 440, 1],
      [4, 523.25, 0.5], [4.5, 659.25, 0.5], [5, 783.99, 0.75], [6, 659.25, 0.5],
      [6.5, 587.33, 0.5], [7, 523.25, 1],
      [8, 440, 0.5], [8.5, 440, 0.5], [9, 493.88, 0.5], [9.5, 523.25, 0.5],
      [10, 587.33, 1], [11, 523.25, 0.5], [11.5, 440, 0.5],
      [12, 392, 0.5], [12.5, 440, 0.5], [13, 523.25, 0.5], [13.5, 659.25, 0.5],
      [14, 783.99, 1], [15, 659.25, 1],
      // Vers B
      [16, 523.25, 0.5], [16.5, 587.33, 0.5], [17, 659.25, 0.75], [18, 587.33, 0.5],
      [18.5, 523.25, 0.5], [19, 493.88, 0.5], [19.5, 440, 0.5], [20, 440, 1],
      [21, 493.88, 0.5], [21.5, 523.25, 0.5], [22, 587.33, 0.75], [23, 523.25, 0.5],
      [23.5, 493.88, 0.5], [24, 440, 1],
      [25, 440, 0.5], [25.5, 523.25, 0.5], [26, 659.25, 0.5], [26.5, 783.99, 0.5],
      [27, 880, 1], [28, 783.99, 0.5], [28.5, 659.25, 0.5], [29, 587.33, 0.5], [29.5, 523.25, 0.5],
      [30, 659.25, 1], [31, 523.25, 1],
      // Bro (lägre register)
      [32, 329.63, 0.75], [33, 392, 0.5], [33.5, 440, 0.5], [34, 493.88, 1],
      [36, 440, 0.5], [36.5, 493.88, 0.5], [37, 523.25, 0.75], [38, 493.88, 0.5],
      [38.5, 440, 0.5], [39, 392, 1],
      [40, 349.23, 0.5], [40.5, 392, 0.5], [41, 440, 0.5], [41.5, 493.88, 0.5],
      [42, 523.25, 1], [43, 493.88, 0.5], [43.5, 440, 0.5],
      [44, 392, 0.5], [44.5, 440, 0.5], [45, 493.88, 0.5], [45.5, 587.33, 0.5],
      [46, 659.25, 1.5], [47.5, 587.33, 0.5],
      // Refrain / upplösning
      [48, 440, 0.5], [48.5, 523.25, 0.5], [49, 659.25, 0.75], [50, 783.99, 0.5],
      [50.5, 880, 0.5], [51, 987.77, 1],
      [52, 880, 0.5], [52.5, 783.99, 0.5], [53, 659.25, 0.75], [54, 587.33, 0.5],
      [54.5, 523.25, 0.5], [55, 440, 1],
      [56, 523.25, 0.5], [56.5, 659.25, 0.5], [57, 783.99, 0.5], [57.5, 880, 0.5],
      [58, 783.99, 0.5], [58.5, 659.25, 0.5], [59, 587.33, 0.5], [59.5, 523.25, 0.5],
      [60, 659.25, 0.75], [61, 783.99, 0.75], [62, 880, 0.5], [62.5, 987.77, 0.5],
      [63, 880, 2],
    ];

    const playLoop = () => {
      if (!this.introPlaying || !this.ctx) return;
      const t0 = ctx.currentTime + 0.06;
      const totalBeats = bars * barBeats;

      for (let b = 0; b < totalBeats; b++) {
        const bt = t0 + b * beat;
        this._popKick(ctx, master, bt, 0.55);
        if (b % barBeats === 1 || b % barBeats === 3) {
          this._popSnare(ctx, master, bt, 0.22);
        }
        this._popHat(ctx, master, bt, 0.07);
        this._popHat(ctx, master, bt + beat * 0.5, 0.05);
        if (b % 8 === 7) {
          this._popHat(ctx, master, bt + beat * 0.25, 0.09);
          this._popHat(ctx, master, bt + beat * 0.75, 0.09);
        }
      }

      for (let bar = 0; bar < bars; bar++) {
        const ci = progression[bar];
        const root = chordRoots[ci];
        const bt = t0 + bar * barBeats * beat;
        const barDur = barBeats * beat;
        this._popBass(ctx, master, bt, root, barDur, 0.32);
        this._popBass(ctx, master, bt + beat * 2, root * 1.5, beat * 1.5, 0.18);
        if (bar >= 8) {
          this._popBass(ctx, master, bt + beat * 3, root * 2, beat * 0.9, 0.12);
        }
        for (const f of chordTriads[ci]) {
          this._popPad(ctx, master, bt, f, barDur, bar >= 8 && bar < 12 ? 0.09 : 0.07);
        }
        for (let i = 0; i < barBeats * 2; i++) {
          const arpT = bt + i * beat * 0.5;
          const note = chordTriads[ci][i % 3];
          this._popArp(ctx, master, arpT, note * 2, beat * 0.4, 0.045);
        }
      }

      for (const [startBeat, freq, lenBeat] of melody) {
        const vol = startBeat >= 48 ? 0.18 : startBeat >= 32 ? 0.13 : 0.16;
        this._popLead(ctx, master, t0 + startBeat * beat, freq, lenBeat * beat, vol);
      }

      for (let bar = 12; bar < 16; bar++) {
        const ci = progression[bar];
        const bt = t0 + bar * barBeats * beat;
        for (const f of chordTriads[ci]) {
          this._popPad(ctx, master, bt, f * 2, barBeats * beat, 0.04);
        }
      }

      this.introLoopTimer = setTimeout(() => {
        if (this.introPlaying) playLoop();
      }, dur * 1000);
    };

    playLoop();
  }

  _popArp(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 2400;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.02);
    this.introNodes.push(osc, gain, filter);
  }

  _popKick(ctx, dest, time, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(150, time);
    osc.frequency.exponentialRampToValueAtTime(40, time + 0.12);
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.2);
    this.introNodes.push(osc, gain);
  }

  _popSnare(ctx, dest, time, vol) {
    const bufLen = (ctx.sampleRate * 0.08) | 0;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 900;
    nGain.gain.setValueAtTime(vol, time);
    nGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.1);
    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(dest);
    noise.start(time);
    noise.stop(time + 0.12);

    const tone = ctx.createOscillator();
    const tGain = ctx.createGain();
    tone.type = "triangle";
    tone.frequency.setValueAtTime(180, time);
    tGain.gain.setValueAtTime(vol * 0.4, time);
    tGain.gain.exponentialRampToValueAtTime(0.0001, time + 0.06);
    tone.connect(tGain);
    tGain.connect(dest);
    tone.start(time);
    tone.stop(time + 0.08);
    this.introNodes.push(noise, nGain, filter, tone, tGain);
  }

  _popHat(ctx, dest, time, vol) {
    const bufLen = (ctx.sampleRate * 0.04) | 0;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = 6000;
    gain.gain.setValueAtTime(vol, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.035);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + 0.04);
    this.introNodes.push(noise, gain, filter);
  }

  _popBass(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 600;
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.02);
    gain.gain.setValueAtTime(vol * 0.85, time + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
    this.introNodes.push(osc, gain, filter);
  }

  _popPad(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1400;
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.15);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
    this.introNodes.push(osc, gain, filter);
  }

  _popLead(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3200, time);
    filter.frequency.exponentialRampToValueAtTime(1800, time + dur);
    osc.type = "square";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.025);
    gain.gain.setValueAtTime(vol * 0.75, time + dur * 0.6);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.05);
    this.introNodes.push(osc, gain, filter);
  }

  /** Klassiskt arkadljud när boss dör */
  async playBossDefeat() {
    const ok = await this.ensureAudio();
    if (!ok) return;
    const ctx = this.ctx;
    const t0 = ctx.currentTime + 0.02;

    const bufLen = ctx.sampleRate * 0.35;
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / bufLen);
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const nGain = ctx.createGain();
    const nFilter = ctx.createBiquadFilter();
    nFilter.type = "bandpass";
    nFilter.frequency.value = 800;
    nFilter.Q.value = 0.6;
    nGain.gain.setValueAtTime(0.35, t0);
    nGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.35);
    noise.connect(nFilter);
    nFilter.connect(nGain);
    nGain.connect(this.sfxGain);
    noise.start(t0);
    noise.stop(t0 + 0.4);

    const fall = [880, 660, 494, 370, 277, 220];
    fall.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(freq, t0 + i * 0.07);
      g.gain.setValueAtTime(0.0001, t0 + i * 0.07);
      g.gain.linearRampToValueAtTime(0.18, t0 + i * 0.07 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + i * 0.07 + 0.12);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(t0 + i * 0.07);
      osc.stop(t0 + i * 0.07 + 0.15);
    });

    const rise = [220, 277, 330, 440, 554, 660, 880];
    rise.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = "square";
      const st = t0 + 0.45 + i * 0.06;
      osc.frequency.setValueAtTime(freq, st);
      g.gain.setValueAtTime(0.0001, st);
      g.gain.linearRampToValueAtTime(0.15, st + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, st + 0.14);
      osc.connect(g);
      g.connect(this.sfxGain);
      osc.start(st);
      osc.stop(st + 0.16);
    });

    const ding = ctx.createOscillator();
    const dGain = ctx.createGain();
    ding.type = "sine";
    ding.frequency.setValueAtTime(1174.7, t0 + 0.95);
    dGain.gain.setValueAtTime(0.0001, t0 + 0.95);
    dGain.gain.linearRampToValueAtTime(0.22, t0 + 0.97);
    dGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.5);
    ding.connect(dGain);
    dGain.connect(this.sfxGain);
    ding.start(t0 + 0.95);
    ding.stop(t0 + 1.55);
  }
}
