// Thunder Front audio kit.
//
// Built around a THREE.AudioListener on the camera so world sounds pan and
// attenuate automatically via THREE.PositionalAudio. Samples are CC0 (see
// public/sfx/CREDITS.md); anything not sourced is synthesized to AudioBuffers
// at load. The game runs error-free even if every file 404s — missing samples
// fall back to procedural buffers.
//
// Public API kept stable: ensure(), gun(pos), cannon(pos), boom(pos, scale),
// startEngine(kind), setEngine(throttle), stopEngine().
import * as THREE from 'three';

const SFX = {
  mg: 'sfx/mg_ppsh.ogg',
  uiClick: 'sfx/click1.wav',
  uiHover: 'sfx/rollover1.wav',
  uiSwitch: 'sfx/switch1.wav',
};

// how many world one-shot voices can overlap, and how many bot engine loops
const ONESHOT_VOICES = 24;
const MAX_BOT_ENGINES = 6;
const REF_DISTANCE = 60;
const MAX_DISTANCE = 1600;
const ROLLOFF = 1.4;

export class GameAudio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.master = 0.7;          // 0..1, stored on the class
    this.buffers = {};
    this.lastGun = 0;
    this.lastGunP = 0;
    this.lastBoom = 0;
    this.engine = null;         // player engine (listener-relative)
    this.wind = null;           // player airspeed loop
    this._oneshots = [];
    this._botEngines = [];      // pool of positional loops for nearby bots
    this._botOf = new Map();    // vehicle -> pooled voice
  }

  // ---------------------------------------------------------------- lifecycle

  ensure(camera) {
    if (this.ready) {
      if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const cam = camera || (window.game && window.game.camera);
    if (!cam) return;

    this.listener = new THREE.AudioListener();
    cam.add(this.listener);
    this.ctx = this.listener.context;
    this.masterGain = this.listener.getInput().gain;
    this.masterGain.value = this.master;

    this._buildProceduralBuffers();
    this._loadSamples();

    // world one-shot voice pool (positional)
    for (let i = 0; i < ONESHOT_VOICES; i++) {
      const a = new THREE.PositionalAudio(this.listener);
      a.setRefDistance(REF_DISTANCE);
      a.setMaxDistance(MAX_DISTANCE);
      a.setRolloffFactor(ROLLOFF);
      a.setDistanceModel('exponential');
      window.game.scene.add(a);
      this._oneshots.push(a);
    }
    // bot engine loop pool (positional, attached to scene, moved each frame)
    for (let i = 0; i < MAX_BOT_ENGINES; i++) {
      const a = new THREE.PositionalAudio(this.listener);
      a.setRefDistance(REF_DISTANCE);
      a.setMaxDistance(MAX_DISTANCE);
      a.setRolloffFactor(ROLLOFF);
      a.setDistanceModel('exponential');
      window.game.scene.add(a);
      this._botEngines.push({ audio: a, vehicle: null, gain: 0 });
    }
    this.ready = true;
  }

  setMasterVolume(v) {
    this.master = THREE.MathUtils.clamp(v, 0, 1);
    if (this.masterGain) this.masterGain.value = this.master;
  }

  // ---------------------------------------------------------------- samples

  async _loadSamples() {
    const loader = new THREE.AudioLoader();
    for (const [key, url] of Object.entries(SFX)) {
      loader.load(
        url,
        (buf) => { this.buffers[key] = buf; },
        undefined,
        () => { /* 404 or decode error: procedural fallback already present */ },
      );
    }
  }

  // ---------------------------------------------------------------- synthesis

  _buf(dur, fn, channels = 1) {
    const sr = this.ctx.sampleRate;
    const len = Math.max(1, Math.floor(dur * sr));
    const b = this.ctx.createBuffer(channels, len, sr);
    for (let c = 0; c < channels; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = fn(i / sr, i, len, c) || 0;
    }
    return b;
  }

  // seamless engine loop: sum of harmonics of f0 over an integer number of
  // cycles so the buffer wraps perfectly. Pitch is set later via playbackRate.
  _engineBuf(f0, harmonics, dur, rough) {
    const cycles = Math.max(1, Math.round(f0 * dur));
    const trueF0 = cycles / dur;
    // fixed random phases → periodic "combustion" texture that still loops
    const ph = harmonics.map(() => Math.random() * Math.PI * 2);
    return this._buf(dur, (t) => {
      let s = 0;
      for (let h = 0; h < harmonics.length; h++) {
        const n = h + 1;
        s += harmonics[h] * Math.sin(2 * Math.PI * trueF0 * n * t + ph[h]);
      }
      // cylinder-pulse amplitude modulation (firing pulses)
      const pulse = 0.6 + 0.4 * Math.pow(Math.max(0, Math.sin(Math.PI * trueF0 * t)), 3);
      // periodic higher-order roughness (loops because argument is n*trueF0)
      const grit = rough * Math.sin(2 * Math.PI * trueF0 * 11 * t + ph[0]) *
        Math.sin(2 * Math.PI * trueF0 * 17 * t);
      return (s * pulse + grit) * 0.5;
    });
  }

  _buildProceduralBuffers() {
    const B = this.buffers;

    // ---- big explosion: sub sweep + decaying filtered-ish noise body + crack
    B.boomBig = this._buf(1.9, (t) => {
      const sub = Math.sin(2 * Math.PI * (70 - 45 * Math.min(1, t / 0.5)) * t) *
        Math.exp(-t * 3.0);
      const bodyEnv = Math.exp(-t * 2.2);
      // low-passed noise emulation: smoothed random via cheap running value
      const n = (Math.random() * 2 - 1);
      const body = n * bodyEnv * 0.9;
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 26) * 0.8;
      return THREE.MathUtils.clamp(sub * 1.1 + body + crack, -1, 1);
    });
    B.boomBig = this._lowpass(B.boomBig, 0.35);

    // ---- small impact / hit
    B.boomSmall = this._buf(0.5, (t) => {
      const thump = Math.sin(2 * Math.PI * (150 - 90 * Math.min(1, t / 0.15)) * t) *
        Math.exp(-t * 12);
      const n = (Math.random() * 2 - 1) * Math.exp(-t * 22) * 0.7;
      return THREE.MathUtils.clamp(thump + n, -1, 1);
    });
    B.boomSmall = this._lowpass(B.boomSmall, 0.6);

    // ---- cannon: sub thump + bright midrange crack
    B.cannon = this._buf(0.7, (t) => {
      const sub = Math.sin(2 * Math.PI * (110 - 70 * Math.min(1, t / 0.25)) * t) *
        Math.exp(-t * 6);
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 15) * 0.9;
      const mid = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 10) * 0.3;
      return THREE.MathUtils.clamp(sub * 1.1 + crack + mid, -1, 1);
    });
    B.cannon = this._lowpass(B.cannon, 0.5);

    // ---- machine-gun fallback (used only if mg_ppsh.ogg fails)
    B.mgFallback = this._buf(0.1, (t) => {
      const crack = (Math.random() * 2 - 1) * Math.exp(-t * 45);
      const body = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t * 40) * 0.5;
      return THREE.MathUtils.clamp(crack + body, -1, 1);
    });

    // ---- per-shot gun cracks: sharp snap + short thump, 3 variants so rapid
    // fire doesn't phase. Small buffers start instantly — no perceived latency.
    B.gunCracks = [];
    for (let v = 0; v < 3; v++) {
      let lp = 0;
      B.gunCracks.push(this._buf(0.085, (t) => {
        const n = Math.random() * 2 - 1;
        lp += 0.3 * (n - lp);
        const snap = (n - lp) * Math.exp(-t * 110) * 1.5;   // highpassed attack
        const body = lp * Math.exp(-t * 35) * 0.9;
        const thump = Math.sin(2 * Math.PI * (150 - 400 * t) * t) * Math.exp(-t * 45) * 0.9;
        return THREE.MathUtils.clamp(snap + body + thump, -1, 1);
      }));
    }

    // ---- engine loops
    B.enginePlane = this._engineBuf(
      45, [1.0, 0.7, 0.5, 0.32, 0.22, 0.16, 0.11, 0.08], 0.5, 0.18);
    B.engineTank = this._engineBuf(
      26, [1.0, 0.85, 0.6, 0.4, 0.26, 0.14], 0.6, 0.28);

    // ---- wind / airspeed loop (crossfaded noise so it wraps clean)
    B.wind = this._crossfadeLoop(this._buf(1.4, () => (Math.random() * 2 - 1)));
    B.wind = this._lowpass(B.wind, 0.25);

    // ---- shell whistle / flyby: descending sweep with vibrato
    B.whistle = this._buf(1.0, (t) => {
      const f = 1500 - 1050 * Math.min(1, t / 0.85);
      const vib = 1 + 0.03 * Math.sin(2 * Math.PI * 6 * t);
      const env = Math.min(1, t / 0.05) * Math.exp(-t * 1.4);
      return Math.sin(2 * Math.PI * f * vib * t) * env * 0.7;
    });

    // ---- stings
    B.victory = this._arp([392, 523, 659, 784], 0.16, 1.0, 0.0);   // G major, bright
    B.defeat = this._arp([392, 330, 262, 196], 0.2, 1.0, 0.35);    // descending minor-ish
    B.capture = this._arp([523, 784], 0.12, 0.7, 0.0);             // two-note ping
  }

  // one-pole lowpass over a buffer (coef 0..1, lower = darker)
  _lowpass(buf, coef) {
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const d = buf.getChannelData(c);
      let prev = 0;
      for (let i = 0; i < d.length; i++) {
        prev += coef * (d[i] - prev);
        d[i] = prev;
      }
    }
    return buf;
  }

  // make a noise buffer loop seamlessly by crossfading the tail into the head
  _crossfadeLoop(buf) {
    const d = buf.getChannelData(0);
    const n = d.length;
    const fade = Math.floor(n * 0.2);
    for (let i = 0; i < fade; i++) {
      const w = i / fade;
      d[i] = d[i] * w + d[n - fade + i] * (1 - w);
    }
    return buf;
  }

  // simple brass-like sawtooth arpeggio sting
  _arp(freqs, noteDur, gain, detune) {
    const total = freqs.length * noteDur + 0.3;
    return this._buf(total, (t) => {
      const idx = Math.min(freqs.length - 1, Math.floor(t / noteDur));
      const f = freqs[idx] * (1 + detune * (t / total));
      const local = t - idx * noteDur;
      const env = Math.min(1, local / 0.01) * Math.exp(-local * 3.5);
      // sawtooth via summed harmonics, softened
      let s = 0;
      for (let h = 1; h <= 6; h++) s += Math.sin(2 * Math.PI * f * h * t) / h;
      return s * env * gain * 0.35;
    });
  }

  // ---------------------------------------------------------------- voices

  _freeVoice() {
    for (const a of this._oneshots) if (!a.isPlaying) return a;
    // steal the pool head if everything is busy
    const a = this._oneshots[0];
    try { a.stop(); } catch { /* noop */ }
    return a;
  }

  _playAt(buffer, pos, { volume = 1, rate = 1, refDistance = REF_DISTANCE } = {}) {
    if (!this.ready || !buffer) return;
    const a = this._freeVoice();
    a.position.copy(pos);
    if (a.isPlaying) { try { a.stop(); } catch { /* noop */ } }
    a.setBuffer(buffer);
    a.setRefDistance(refDistance);
    a.setPlaybackRate(rate);
    a.setVolume(volume);
    a.play();
  }

  // ---------------------------------------------------------------- API (world)

  gun(pos, isPlayer = false) {
    if (!this.ready) return;
    const bank = this.buffers.gunCracks;
    const buf = bank[(Math.random() * bank.length) | 0];
    const now = performance.now();
    if (isPlayer) {
      // player guns: listener-relative raw source, fires the same audio frame —
      // no positional processing, no distance falloff, no delay
      if (now - this.lastGunP < 25) return;
      this.lastGunP = now;
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.9 + Math.random() * 0.2;
      const g = this.ctx.createGain();
      g.gain.value = 0.42;
      src.connect(g).connect(this.listener.getInput());
      src.start();
      return;
    }
    if (now - this.lastGun < 50) return;
    this.lastGun = now;
    this._playAt(buf, pos, { volume: 0.8, rate: 0.85 + Math.random() * 0.25, refDistance: 90 });
  }

  cannon(pos) {
    if (!this.ready) return;
    this._playAt(this.buffers.cannon, pos, {
      volume: 1.0, rate: 0.9 + Math.random() * 0.15, refDistance: 120,
    });
  }

  boom(pos, scale = 1) {
    if (!this.ready) return;
    const now = performance.now();
    if (now - this.lastBoom < 55) return;
    this.lastBoom = now;
    if (scale >= 0.9) {
      this._playAt(this.buffers.boomBig, pos, {
        volume: Math.min(1.3, 0.85 * scale), rate: 0.85 + Math.random() * 0.2, refDistance: 180,
      });
    } else {
      this._playAt(this.buffers.boomSmall, pos, {
        volume: 0.8, rate: 0.9 + Math.random() * 0.25, refDistance: 90,
      });
    }
  }

  // ---------------------------------------------------------------- API (player engine)

  startEngine(kind) {
    if (!this.ready) return;
    this.stopEngine();
    const buf = kind === 'plane' ? this.buffers.enginePlane : this.buffers.engineTank;
    const a = new THREE.Audio(this.listener);
    a.setBuffer(buf);
    a.setLoop(true);
    a.setVolume(0);
    a.play();
    this.engine = { audio: a, kind, baseRate: 1 };

    if (kind === 'plane') {
      const w = new THREE.Audio(this.listener);
      w.setBuffer(this.buffers.wind);
      w.setLoop(true);
      w.setVolume(0);
      w.play();
      this.wind = w;
    }
  }

  setEngine(throttle) {
    if (!this.engine) return;
    const e = this.engine;
    const t = THREE.MathUtils.clamp(throttle, 0, 1.2);
    if (e.kind === 'plane') {
      e.audio.setPlaybackRate(0.85 + t * 1.15);
      e.audio.setVolume(0.28 + t * 0.30);
      if (this.wind) this.wind.setVolume(THREE.MathUtils.clamp((t - 0.25) * 0.5, 0, 0.35));
    } else {
      e.audio.setPlaybackRate(0.75 + t * 0.9);
      e.audio.setVolume(0.30 + Math.min(1, t) * 0.28);
    }
  }

  stopEngine() {
    if (this.engine) {
      try { this.engine.audio.stop(); } catch { /* noop */ }
      this.engine = null;
    }
    if (this.wind) {
      try { this.wind.stop(); } catch { /* noop */ }
      this.wind = null;
    }
  }

  // ---------------------------------------------------------------- stings

  sting(type) {
    if (!this.ready) return;
    const buf = this.buffers[type];
    if (!buf) return;
    const a = new THREE.Audio(this.listener);
    a.setBuffer(buf);
    a.setVolume(type === 'capture' ? 0.5 : 0.8);
    a.play();
  }

  // ---------------------------------------------------------------- per-frame

  // Called each frame from the game loop. Handles nearby-bot positional engine
  // loops (pooled) and enemy shell whistles near the player.
  update(dt, game) {
    if (!this.ready || !game) return;
    this._updateBotEngines(game);
    this._updateWhistles(game);
  }

  _updateBotEngines(game) {
    const cam = game.camera.position;
    // rank other alive vehicles (not the player) by distance to camera
    const cand = [];
    for (const v of game.vehicles) {
      if (!v.alive || v.isPlayer) continue;
      const d = cam.distanceToSquared(v.pos);
      if (d < MAX_DISTANCE * MAX_DISTANCE) cand.push({ v, d });
    }
    cand.sort((a, b) => a.d - b.d);
    const near = new Set(cand.slice(0, MAX_BOT_ENGINES).map((c) => c.v));

    // release voices whose vehicle is no longer near/alive
    for (const slot of this._botEngines) {
      if (slot.vehicle && !near.has(slot.vehicle)) {
        try { slot.audio.stop(); } catch { /* noop */ }
        this._botOf.delete(slot.vehicle);
        slot.vehicle = null;
      }
    }
    // assign free voices to newly-near vehicles
    for (const v of near) {
      if (this._botOf.has(v)) continue;
      const slot = this._botEngines.find((s) => !s.vehicle);
      if (!slot) break;
      slot.vehicle = v;
      this._botOf.set(v, slot);
      const buf = v.kind === 'plane' ? this.buffers.enginePlane : this.buffers.engineTank;
      slot.audio.setBuffer(buf);
      slot.audio.setLoop(true);
      slot.audio.setVolume(v.kind === 'plane' ? 0.5 : 0.55);
      slot.audio.setPlaybackRate(v.kind === 'plane' ? 1.15 : 0.9);
      if (!slot.audio.isPlaying) slot.audio.play();
    }
    // track positions + a little pitch variation with speed
    for (const slot of this._botEngines) {
      if (!slot.vehicle) continue;
      slot.audio.position.copy(slot.vehicle.pos);
      if (slot.vehicle.kind === 'plane') {
        const thr = slot.vehicle.throttle ?? 0.8;
        slot.audio.setPlaybackRate(0.95 + thr * 0.9);
      }
    }
  }

  _updateWhistles(game) {
    const p = game.player;
    if (!p || !p.alive) return;
    for (const proj of game.projectiles.list) {
      if (proj._whistled || proj.type === 'bullet') continue;
      if (proj.owner && proj.owner.team === p.team) continue;
      // whistle once when a hostile shell/bomb comes within earshot of the player
      if (proj.pos.distanceToSquared(p.pos) < 90 * 90) {
        proj._whistled = true;
        this._playAt(this.buffers.whistle, proj.pos, {
          volume: 0.8, rate: 0.9 + Math.random() * 0.2, refDistance: 70,
        });
      }
    }
  }

  // ---------------------------------------------------------------- UI

  ui(kind = 'click') {
    if (!this.ready) return;
    const key = kind === 'hover' ? 'uiHover' : kind === 'switch' ? 'uiSwitch' : 'uiClick';
    const buf = this.buffers[key];
    if (!buf) return;
    const a = new THREE.Audio(this.listener);
    a.setBuffer(buf);
    a.setVolume(0.6);
    a.play();
  }
}
