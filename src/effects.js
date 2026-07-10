import * as THREE from 'three';

function makeParticleTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.8)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

const FIRE = new THREE.Color(0xffa030);
const FIRE_END = new THREE.Color(0x802010);
const SMOKE = new THREE.Color(0x3a3a3a);
const DIRT = new THREE.Color(0x6a5a3a);
const SPARK = new THREE.Color(0xffe080);
const FLASH = new THREE.Color(0xfff2c0);
const DUST = new THREE.Color(0x9a8b66);
const VAPOR = new THREE.Color(0xffffff);

const _d = new THREE.Vector3();

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tex = makeParticleTexture();
    this.pool = [];
    this.active = [];
    for (let i = 0; i < 420; i++) {
      const mat = new THREE.SpriteMaterial({ map: this.tex, transparent: true, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      sp.visible = false;
      scene.add(sp);
      this.pool.push({ sprite: sp, vel: new THREE.Vector3(), life: 0, maxLife: 1, size: 1, grow: 0, from: FIRE.clone(), to: SMOKE.clone(), gravity: 0 });
    }
  }

  emit(pos, opts) {
    const p = this.pool.pop();
    if (!p) return;
    p.sprite.visible = true;
    p.sprite.position.copy(pos);
    p.vel.set(
      (Math.random() - 0.5) * 2 * (opts.spread ?? 5),
      (Math.random() - 0.2) * 2 * (opts.spread ?? 5) * (opts.upBias ?? 1),
      (Math.random() - 0.5) * 2 * (opts.spread ?? 5)
    );
    if (opts.vel) p.vel.add(opts.vel);
    p.maxLife = p.life = (opts.life ?? 1) * (0.7 + Math.random() * 0.6);
    p.size = (opts.size ?? 4) * (0.7 + Math.random() * 0.6);
    p.grow = opts.grow ?? 4;
    p.gravity = opts.gravity ?? 0;
    p.from.copy(opts.from ?? FIRE);
    p.to.copy(opts.to ?? SMOKE);
    p.sprite.material.opacity = 1;
    this.active.push(p);
  }

  explosion(pos, scale = 1) {
    for (let i = 0; i < 14; i++) {
      this.emit(pos, { spread: 9 * scale, size: 6 * scale, life: 0.6, grow: 14 * scale, from: FIRE, to: FIRE_END, gravity: 2 });
    }
    for (let i = 0; i < 12; i++) {
      this.emit(pos, { spread: 7 * scale, size: 8 * scale, life: 1.8, grow: 9 * scale, from: SMOKE, to: SMOKE, gravity: -3, upBias: 1.6 });
    }
    for (let i = 0; i < 8; i++) {
      this.emit(pos, { spread: 26 * scale, size: 1.6, life: 0.5, grow: 0, from: SPARK, to: FIRE_END, gravity: 22 });
    }
  }

  dirtHit(pos) {
    for (let i = 0; i < 5; i++) {
      this.emit(pos, { spread: 4, size: 2.5, life: 0.55, grow: 5, from: DIRT, to: DIRT, gravity: 8, upBias: 1.8 });
    }
  }

  sparkHit(pos) {
    for (let i = 0; i < 4; i++) {
      this.emit(pos, { spread: 6, size: 1.2, life: 0.3, grow: 1, from: SPARK, to: FIRE_END, gravity: 10 });
    }
  }

  smokeTrail(pos) {
    this.emit(pos, { spread: 1.2, size: 2.6, life: 1.4, grow: 4, from: SMOKE, to: SMOKE, gravity: -2 });
  }

  // licking flames for critically damaged vehicles
  fireTrail(pos) {
    this.emit(pos, { spread: 0.9, size: 2.2, life: 0.5, grow: 2.5, from: FIRE, to: FIRE_END, gravity: -4 });
  }

  // bright muzzle bloom + a few forward sparks along the firing direction
  muzzleFlash(pos, dir, scale = 1) {
    _d.copy(dir).multiplyScalar(24 * scale);
    this.emit(pos, { spread: 0.6 * scale, size: 4.5 * scale, life: 0.09, grow: 3 * scale, from: FLASH, to: FIRE, gravity: 0 });
    for (let i = 0; i < 3; i++) {
      this.emit(pos, { spread: 2.5 * scale, size: 1.1 * scale, life: 0.18, grow: 0, from: SPARK, to: FIRE_END, gravity: 4, vel: _d });
    }
    this.emit(pos, { spread: 1.2 * scale, size: 3 * scale, life: 0.4, grow: 6 * scale, from: SMOKE, to: SMOKE, gravity: -1 });
  }

  // dust plume kicked up behind a moving tank
  dust(pos) {
    for (let i = 0; i < 2; i++) {
      this.emit(pos, { spread: 1.6, size: 2.4, life: 0.7, grow: 6, from: DUST, to: DUST, gravity: -1.2, upBias: 1.4 });
    }
  }

  // thin wingtip vapor trail
  contrail(pos) {
    this.emit(pos, { spread: 0.15, size: 1.1, life: 1.1, grow: 3.5, from: VAPOR, to: VAPOR, gravity: 0 });
  }

  update(dt) {
    for (let i = this.active.length - 1; i >= 0; i--) {
      const p = this.active[i];
      p.life -= dt;
      if (p.life <= 0) {
        p.sprite.visible = false;
        this.active.splice(i, 1);
        this.pool.push(p);
        continue;
      }
      const t = 1 - p.life / p.maxLife;
      p.vel.y -= p.gravity * dt;
      p.sprite.position.addScaledVector(p.vel, dt);
      const s = p.size + p.grow * t;
      p.sprite.scale.set(s, s, 1);
      p.sprite.material.color.copy(p.from).lerp(p.to, Math.min(1, t * 1.4));
      p.sprite.material.opacity = t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85;
    }
  }
}
