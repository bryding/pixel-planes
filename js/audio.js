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
};
Sound.load();

// Browsers block audio until the user interacts. Wake the engine up on ANY
// click / key / tap, so sound is ready (and resumes if the tab suspended it).
['pointerdown', 'keydown', 'touchstart'].forEach((ev) =>
  window.addEventListener(ev, () => Sound.init(), { passive: true }));
