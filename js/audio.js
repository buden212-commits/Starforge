/**
 * Procedural ljud via Web Audio — inga externa filer.
 * Vinjett: episkt, mystiskt orkestertema (blås, stråkar, kör, pukor,
 * skimrande klockor och cinematisk reverb) i en ~87 sekunder lång loop.
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

  /** Episk, mystisk orkestervinjett — loopande tema (~87 s) */
  playIntroFanfare() {
    if (!this.ctx || this.ctx.state !== "running") return;
    this.stopIntro();
    this.introPlaying = true;

    const ctx = this.ctx;
    const master = ctx.createGain();
    master.gain.value = 0.85;
    master.connect(this.musicGain);
    this.introNodes.push(master);

    // Cinematisk reverb (dry/wet-send) för rymd och episk känsla.
    const reverbBus = ctx.createGain();
    const dryGain = ctx.createGain();
    dryGain.gain.value = 0.72;
    const wetGain = ctx.createGain();
    wetGain.gain.value = 0.36;
    const convolver = ctx.createConvolver();
    convolver.buffer = this._buildReverbImpulse(ctx, 3.4, 2.6);
    reverbBus.connect(dryGain);
    dryGain.connect(master);
    reverbBus.connect(convolver);
    convolver.connect(wetGain);
    wetGain.connect(master);
    this.introNodes.push(reverbBus, dryGain, wetGain, convolver);

    // Skimrande delay för klockor/stjärnglitter.
    const bellDelay = ctx.createDelay(1.5);
    bellDelay.delayTime.value = 0.42;
    const bellFeedback = ctx.createGain();
    bellFeedback.gain.value = 0.38;
    const bellWet = ctx.createGain();
    bellWet.gain.value = 0.55;
    bellDelay.connect(bellFeedback);
    bellFeedback.connect(bellDelay);
    bellDelay.connect(bellWet);
    bellWet.connect(reverbBus);
    this.introNodes.push(bellDelay, bellFeedback, bellWet);

    const dest = reverbBus;
    const noteFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

    const BPM = 66;
    const beat = 60 / BPM;
    const barBeats = 4;
    const bars = 24;
    const dur = bars * barBeats * beat;

    // Dm - B♭ - F - C - Gm - Dm - B♭ - A (mystisk moll-progression, A löser till Dm i loopen)
    const CHORDS = [
      { bass: 38, triad: [50, 53, 57] },
      { bass: 34, triad: [46, 50, 53] },
      { bass: 29, triad: [53, 57, 60] },
      { bass: 36, triad: [48, 52, 55] },
      { bass: 31, triad: [55, 58, 62] },
      { bass: 38, triad: [50, 53, 57] },
      { bass: 34, triad: [46, 50, 53] },
      { bass: 33, triad: [45, 49, 52] },
    ];

    // Mjuk, mystisk temafras (intro/uppbyggnad) — 8 takter.
    const phraseTheme = [
      [0, 62, 2], [2, 65, 1], [3, 69, 1], [4, 72, 2], [6, 70, 1], [7, 69, 1],
      [8, 65, 2], [10, 67, 1], [11, 69, 1], [12, 65, 3],
      [16, 60, 2], [18, 62, 1], [19, 65, 1], [20, 69, 2], [22, 67, 1], [23, 65, 1],
      [24, 62, 2], [26, 60, 1], [27, 58, 1], [28, 57, 4],
    ];
    // Stort blås-tema för klimax — 4 takter.
    const phraseClimax = [
      [0, 74, 2], [2, 77, 1], [3, 74, 1], [4, 79, 3],
      [8, 77, 1], [9, 74, 1], [10, 72, 2],
      [12, 74, 1], [13, 72, 1], [14, 69, 2],
    ];
    // Nedtonande avslutningsfras som leder tillbaka in i loopen.
    const phraseOutro = [[0, 69, 2], [4, 65, 2], [8, 62, 2], [12, 57, 4]];

    const playPhrase = (phrase, startBar, vol, useBrass) => {
      const base = (b) => startBar * barBeats * beat + b * beat;
      for (const [b, note, lenBeats] of phrase) {
        const time = base(b);
        const f = noteFreq(note);
        const d = lenBeats * beat;
        if (useBrass) this._brass(ctx, dest, time, f, d, vol);
        else this._solo(ctx, dest, time, f, d, vol);
      }
    };

    const playLoop = () => {
      if (!this.introPlaying || !this.ctx) return;
      const t0 = ctx.currentTime + 0.08;

      this._drone(ctx, dest, t0, noteFreq(26), dur, 0.045);
      this._drone(ctx, dest, t0, noteFreq(38), dur, 0.055);

      for (let bar = 0; bar < bars; bar++) {
        const chord = CHORDS[bar % 8];
        const bt = t0 + bar * barBeats * beat;
        const barDur = barBeats * beat;
        const isIntro = bar < 8;
        const isBuild = bar >= 8 && bar < 16;
        const isClimax = bar >= 16 && bar < 20;
        const sectionVol = isIntro
          ? 0.4
          : isBuild
            ? 0.4 + ((bar - 8) / 8) * 0.5
            : isClimax
              ? 1
              : Math.max(0.22, 1 - ((bar - 20) / 4) * 0.78);

        this._stringsPad(ctx, dest, bt, noteFreq(chord.bass), barDur * 1.05, 0.1 * sectionVol);
        for (const n of chord.triad) {
          this._stringsPad(ctx, dest, bt, noteFreq(n), barDur * 1.05, 0.09 * sectionVol);
          this._choirPad(ctx, dest, bt, noteFreq(n + 12), barDur * 1.1, (isIntro ? 0.045 : 0.08) * sectionVol);
        }

        if (!isIntro) {
          this._timpani(ctx, dest, bt, 0.5 * sectionVol);
          this._timpani(ctx, dest, bt + beat * 2, 0.35 * sectionVol);
        }

        if (isIntro || bar >= 20) {
          [0, 1.5, 2.5].forEach((offBeat, i) => {
            const n = chord.triad[i % chord.triad.length] + 12;
            this._bellSparkle(ctx, dest, bellDelay, bt + offBeat * beat, noteFreq(n), 0.08 * sectionVol);
          });
        } else {
          for (let i = 0; i < barBeats * 2; i++) {
            const n = chord.triad[i % 3] + 12;
            this._bellSparkle(ctx, dest, bellDelay, bt + i * beat * 0.5, noteFreq(n), 0.05 * sectionVol);
          }
        }

        if (bar === 16 || bar === 20) {
          this._cymbalSwell(ctx, dest, bt - beat, barBeats * beat * 1.3, 0.5);
        }
      }

      playPhrase(phraseTheme, 0, 0.09, false);
      playPhrase(phraseTheme, 8, 0.17, true);
      playPhrase(phraseClimax, 16, 0.25, true);
      playPhrase(phraseOutro, 20, 0.08, false);

      this.introLoopTimer = setTimeout(() => {
        if (this.introPlaying) playLoop();
      }, dur * 1000);
    };

    playLoop();
  }

  _buildReverbImpulse(ctx, duration = 3, decay = 3) {
    const rate = ctx.sampleRate;
    const length = Math.max(1, (rate * duration) | 0);
    const impulse = ctx.createBuffer(2, length, rate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  _drone(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 400;
    osc.type = "sine";
    osc2.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq * 1.005, time);
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 120;
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 4);
    gain.gain.setValueAtTime(vol, time + Math.max(4.1, dur - 4));
    gain.gain.linearRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc2.start(time);
    lfo.start(time);
    const stopT = time + dur + 0.1;
    osc.stop(stopT);
    osc2.stop(stopT);
    lfo.stop(stopT);
    this.introNodes.push(osc, osc2, gain, filter, lfo, lfoGain);
  }

  _stringsPad(ctx, dest, time, freq, dur, vol) {
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 1600;
    filter.Q.value = 0.3;
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 4.5;
    vibratoGain.gain.value = 2.2;
    vibrato.connect(vibratoGain);
    const oscs = [];
    for (const det of [-6, 0, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, time);
      osc.detune.setValueAtTime(det, time);
      vibratoGain.connect(osc.detune);
      osc.connect(filter);
      oscs.push(osc);
    }
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.6);
    gain.gain.setValueAtTime(vol, time + Math.max(0.7, dur - 0.6));
    gain.gain.linearRampToValueAtTime(0.0001, time + dur);
    filter.connect(gain);
    gain.connect(dest);
    vibrato.start(time);
    oscs.forEach((o) => o.start(time));
    const stopT = time + dur + 0.1;
    vibrato.stop(stopT);
    oscs.forEach((o) => o.stop(stopT));
    this.introNodes.push(gain, filter, vibrato, vibratoGain, ...oscs);
  }

  _choirPad(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    const gain = ctx.createGain();
    const f1 = ctx.createBiquadFilter();
    f1.type = "bandpass";
    f1.frequency.value = 700;
    f1.Q.value = 4;
    const f2 = ctx.createBiquadFilter();
    f2.type = "bandpass";
    f2.frequency.value = 1200;
    f2.Q.value = 5;
    osc.connect(f1);
    osc.connect(f2);
    f1.connect(gain);
    f2.connect(gain);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 1.2);
    gain.gain.setValueAtTime(vol, time + Math.max(1.3, dur - 1));
    gain.gain.linearRampToValueAtTime(0.0001, time + dur);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + dur + 0.1);
    this.introNodes.push(osc, gain, f1, f2);
  }

  _timpani(ctx, dest, time, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(95, time);
    osc.frequency.exponentialRampToValueAtTime(58, time + 0.35);
    gain.gain.setValueAtTime(Math.max(vol, 0.0001), time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.6);
    osc.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc.stop(time + 0.65);
    this.introNodes.push(osc, gain);
  }

  _bellSparkle(ctx, dest, delayNode, time, freq, vol) {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, time);
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 1.1);
    osc.connect(gain);
    gain.connect(dest);
    gain.connect(delayNode);
    osc.start(time);
    osc.stop(time + 1.2);
    this.introNodes.push(osc, gain);
  }

  _cymbalSwell(ctx, dest, time, dur, vol) {
    const bufLen = Math.max(1, (ctx.sampleRate * dur) | 0);
    const buffer = ctx.createBuffer(1, bufLen, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufLen; i++) data[i] = Math.random() * 2 - 1;
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(1200, time);
    filter.frequency.linearRampToValueAtTime(5000, time + dur * 0.6);
    filter.Q.value = 0.7;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + dur * 0.55);
    gain.gain.linearRampToValueAtTime(0.0001, time + dur);
    noise.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    noise.start(time);
    noise.stop(time + dur + 0.05);
    this.introNodes.push(noise, gain, filter);
  }

  _brass(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    osc.type = "sawtooth";
    osc2.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    osc2.frequency.setValueAtTime(freq, time);
    osc2.detune.setValueAtTime(8, time);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = 1.5;
    filter.frequency.setValueAtTime(600, time);
    filter.frequency.linearRampToValueAtTime(2600, time + Math.min(0.12, dur * 0.3));
    filter.frequency.setValueAtTime(2600, time + dur * 0.6);
    filter.frequency.linearRampToValueAtTime(1200, time + dur);
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 5.5;
    vibratoGain.gain.value = 3.5;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.detune);
    vibratoGain.connect(osc2.detune);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.06);
    gain.gain.setValueAtTime(vol * 0.85, time + dur * 0.7);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    osc2.start(time);
    vibrato.start(time + 0.08);
    const stopT = time + dur + 0.05;
    osc.stop(stopT);
    osc2.stop(stopT);
    vibrato.stop(stopT);
    this.introNodes.push(osc, osc2, filter, vibrato, vibratoGain, gain);
  }

  _solo(ctx, dest, time, freq, dur, vol) {
    const osc = ctx.createOscillator();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = freq * 2;
    filter.Q.value = 2.5;
    const vibrato = ctx.createOscillator();
    const vibratoGain = ctx.createGain();
    vibrato.frequency.value = 4.2;
    vibratoGain.gain.value = 4;
    vibrato.connect(vibratoGain);
    vibratoGain.connect(osc.detune);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.linearRampToValueAtTime(vol, time + 0.15);
    gain.gain.setValueAtTime(vol * 0.8, time + dur * 0.75);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(dest);
    osc.start(time);
    vibrato.start(time + 0.1);
    const stopT = time + dur + 0.05;
    osc.stop(stopT);
    vibrato.stop(stopT);
    this.introNodes.push(osc, filter, vibrato, vibratoGain, gain);
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
