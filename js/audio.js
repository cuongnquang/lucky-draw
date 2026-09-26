/* ============================================================
   audio.js — WebAudio synthesized SFX + optional music file
   ============================================================ */
(function () {
  "use strict";

  const audio = {
    ctx: null,
    master: null,
    musicGain: null,
    spinNodes: null,
    musicEl: null,
    musicUrl: null,

    _enabled: true,

    ensure() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        this.musicGain = this.ctx.createGain();
        this.musicGain.gain.value = 0.45;
        this.musicGain.connect(this.master);
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return true;
    },

    get on() { return this._enabled && !!(this.ctx && this.ctx.state !== "closed"); },

    setSound(on) {
      this._enabled = on;
      if (on) { this.ensure(); }
      else { this.stopSpin(); this.stopMusic(); }
    },

    _tone(freq, { dur = 0.18, type = "sine", vol = 0.5, when = 0, slide = null } = {}) {
      if (!this.ensure() || !this._enabled) return;
      const t0 = this.ctx.currentTime + when;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type; osc.frequency.setValueAtTime(freq, t0);
      if (slide) osc.frequency.exponentialRampToValueAtTime(slide, t0 + dur);
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(vol, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g).connect(this.master);
      osc.start(t0); osc.stop(t0 + dur + 0.05);
    },

    _noise({ dur = 0.25, vol = 0.3, freq = 1200, when = 0, lp = true } = {}) {
      if (!this.ensure() || !this._enabled) return;
      const t0 = this.ctx.currentTime + when;
      const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      const f = this.ctx.createBiquadFilter();
      f.type = lp ? "lowpass" : "highpass"; f.frequency.value = freq;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(vol, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t0);
    },

    countdown(n, isLast) {
      this._tone(isLast ? 880 : 523.25, { type: "triangle", dur: 0.22, vol: 0.5 });
      if (!isLast) this._tone(261.63, { type: "sine", dur: 0.2, vol: 0.25, when: 0.02 });
    },
    go() {
      this._tone(1318.5, { type: "triangle", dur: 0.3, vol: 0.55 });
      this._tone(2637, { type: "sine", dur: 0.22, vol: 0.3, when: 0.02 });
    },
    tick() {
      this._noise({ dur: 0.035, vol: 0.12, freq: 2600, lp: false });
    },

    spinStart() {
      if (!this.ensure() || !this._enabled || this.spinNodes) return;
      const ctx = this.ctx;
      const len = ctx.sampleRate;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      const src = ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 900; bp.Q.value = 3;
      const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5;
      const lfoG = ctx.createGain(); lfoG.gain.value = 420;
      lfo.connect(lfoG).connect(bp.frequency);
      const g = ctx.createGain(); g.gain.value = 0.07;
      src.connect(bp).connect(g).connect(this.master);
      src.start(); lfo.start();
      this.spinNodes = [src, lfo];
    },
    spinStop() {
      if (!this.spinNodes) return;
      this.spinNodes.forEach((n) => { try { n.stop(); } catch (e) {} });
      this.spinNodes = null;
    },

    reveal() {
      [523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        this._tone(f, { type: "triangle", dur: 0.2, vol: 0.45, when: i * 0.09 }));
      this._tone(2093, { type: "sine", dur: 0.5, vol: 0.2, when: 0.36 });
    },
    celebration() {
      const seq = [392, 523.25, 659.25, 784, 659.25, 784, 1046.5];
      seq.forEach((f, i) =>
        this._tone(f, { type: "triangle", dur: i === seq.length - 1 ? 0.6 : 0.16, vol: 0.5, when: i * 0.11 }));
      this._noise({ dur: 0.9, vol: 0.1, freq: 400, when: 0 });
    },

    /* ---------- music ---------- */
    setMusic(file) {
      const url = URL.createObjectURL(file);
      if (this.musicEl) { this.musicEl.pause(); URL.revokeObjectURL(this.musicUrl); }
      this.musicUrl = url;
      this.musicEl = new Audio(url);
      this.musicEl.loop = true;
      this.musicEl.volume = 0.5;
      localStorage.setItem("ld-music", JSON.stringify({ name: file.name }));
    },
    playMusic() {
      if (!this.ensure()) return;
      if (!this.musicEl) return false;
      this.musicEl.play().catch(() => {});
      return true;
    },
    stopMusic() {
      if (this.musicEl) this.musicEl.pause();
    },
    isMusicPlaying() { return this.musicEl && !this.musicEl.paused; },

    pickMusic() {
      return new Promise((resolve) => {
        const input = document.createElement("input");
        input.type = "file"; input.accept = "audio/*";
        input.onchange = () => {
          const f = input.files && input.files[0];
          if (f) { this.setMusic(f); this.playMusic(); resolve(f); }
          else resolve(null);
        };
        input.click();
      });
    },
  };

  window.LD = Object.assign(window.LD || {}, { audio });
})();