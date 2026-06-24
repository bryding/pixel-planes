// ===========================================================================
//  SOUND  --  all game sounds, generated in code with the Web Audio API
//  (no sound files to download). One master volume controls everything, set on
//  the title SETTINGS screen. Browsers only allow sound after a click/tap, so
//  we start the audio when you press START (or move the volume slider).
// ===========================================================================

const Sound = {
  ctx: null,
  master: null,
  volume: 0.5,     // 0..1, controlled by the Settings slider
  _noise: null,

  // Load the saved volume (call at startup).
  load() {
    try {
      const v = localStorage.getItem('pp_volume');
      if (v !== null) this.volume = Math.max(0, Math.min(1, parseFloat(v)));
    } catch (e) {}
  },

  // Start (or resume) the audio engine. Must run from a click/tap.
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
      this._loadGun();                 // fetch the real AK-47 gun sound
    } catch (e) { this.ctx = null; }
  },

  // Load the real gunfire recording (decoded into memory for instant playback).
  _loadGun() {
    if (this._gunBuf || this._gunLoading) return;
    this._gunLoading = true;
    fetch('sounds/gun.mp3')
      .then((r) => r.arrayBuffer())
      .then((b) => this.ctx.decodeAudioData(b))
      .then((buf) => { this._gunBuf = buf; })
      .catch(() => {});                // if it fails, gun() uses the generated sound
  },

  setVolume(v) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.master) this.master.gain.value = this.volume;
    try { localStorage.setItem('pp_volume', this.volume); } catch (e) {}
  },

  // A short, decaying noise burst we reuse for each gunshot.
  _noiseBuf() {
    if (this._noise) return this._noise;
    const ctx = this.ctx, dur = 0.08;
    const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 2.5);
    this._noise = buf;
    return buf;
  },

  // One gunshot. Fired repeatedly while shooting -> a machine-gun rattle.
  gun() {
    if (!this.ctx || this.volume <= 0) return;
    const ctx = this.ctx, t = ctx.currentTime;

    // Preferred: a short slice of the REAL AK-47 recording (one shot's worth).
    if (this._gunBuf) {
      const src = ctx.createBufferSource();
      src.buffer = this._gunBuf;
      const g = ctx.createGain(); g.gain.value = 1.0;
      src.connect(g); g.connect(this.master);
      src.start(t, 0, 0.16);          // play just the first ~1 shot, then stop
      return;
    }

    // Fallback (until the mp3 loads / if it fails): a generated gunshot.
    const src = ctx.createBufferSource();
    src.buffer = this._noiseBuf();
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2200;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.08);
    src.connect(lp); lp.connect(g); g.connect(this.master);
    src.start(t);
    src.stop(t + 0.09);
  },

  // ---- Title theme: a short military bugle-style fanfare that loops ----
  // [frequency in Hz (0 = rest), length in seconds]
  _melody: [
    [392, 0.18], [392, 0.18], [523, 0.5], [392, 0.18], [523, 0.18], [659, 0.5],
    [523, 0.18], [659, 0.18], [784, 0.5], [659, 0.25], [523, 0.25], [392, 0.6],
    [0, 0.5],
  ],
  startTheme() {
    if (!this.ctx || this._themeOn) return;
    this._themeOn = true;
    this._scheduleTheme(this.ctx.currentTime + 0.08);
  },
  stopTheme() {
    this._themeOn = false;
    clearTimeout(this._themeTimer);
  },
  _scheduleTheme(startAt) {
    if (!this._themeOn || !this.ctx) return;
    let t = startAt;
    for (const [freq, dur] of this._melody) {
      if (freq > 0) this._note(freq, t, dur * 0.92);
      t += dur;
    }
    const totalMs = (t - startAt) * 1000;
    this._themeTimer = setTimeout(() => this._scheduleTheme(this.ctx.currentTime + 0.02), totalMs);
  },
  _note(freq, t, dur) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.type = 'square'; o.frequency.value = freq;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2600;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.02);   // brassy attack
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(lp); lp.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.03);
  },

  // ---- Title plane engine: a prop-plane "neeerm" drone whose volume & pitch
  // follow the plane (louder/higher as it nears, quieter/lower as it flies off) ----
  startEngine() {
    if (!this.ctx || this._engineOn) return;
    this._engineOn = true;
    const ctx = this.ctx;
    this._eOsc1 = ctx.createOscillator(); this._eOsc1.type = 'sawtooth'; this._eOsc1.frequency.value = 100;
    this._eOsc2 = ctx.createOscillator(); this._eOsc2.type = 'sawtooth'; this._eOsc2.frequency.value = 103;
    this._eLp = ctx.createBiquadFilter(); this._eLp.type = 'lowpass'; this._eLp.frequency.value = 900;
    this._eGain = ctx.createGain(); this._eGain.gain.value = 0;
    this._eOsc1.connect(this._eLp); this._eOsc2.connect(this._eLp);
    this._eLp.connect(this._eGain); this._eGain.connect(this.master);
    this._eOsc1.start(); this._eOsc2.start();
  },
  setEngine(level, pitch) {
    if (!this._engineOn || !this._eGain) return;
    const now = this.ctx.currentTime;
    const v = Math.max(0, Math.min(1, level)) * 0.22;
    this._eGain.gain.setTargetAtTime(v, now, 0.06);
    if (pitch && this._eOsc1) {
      this._eOsc1.frequency.setTargetAtTime(pitch, now, 0.06);
      this._eOsc2.frequency.setTargetAtTime(pitch * 1.03, now, 0.06);
    }
  },
  stopEngine() {
    this._engineOn = false;
    if (this._eGain) this._eGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.05);
    const o1 = this._eOsc1, o2 = this._eOsc2;
    setTimeout(() => { try { o1 && o1.stop(); } catch (e) {} try { o2 && o2.stop(); } catch (e) {} }, 200);
    this._eOsc1 = this._eOsc2 = this._eGain = this._eLp = null;
  },
};
Sound.load();

// Browsers block audio until the user interacts. Wake the engine up on ANY
// click / key / tap, so sound is ready (and resumes if the tab suspended it).
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => Sound.init(), { passive: true }));
