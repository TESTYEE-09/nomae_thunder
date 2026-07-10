import * as THREE from 'three';
import { PLANES, TANKS } from './catalog.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q1 = new THREE.Quaternion();
const _q2 = new THREE.Quaternion();
const UP = new THREE.Vector3(0, 1, 0);
const AX = new THREE.Vector3(1, 0, 0);
const AY = new THREE.Vector3(0, 1, 0);
const AZ = new THREE.Vector3(0, 0, 1);

export const TEAM_COLOR = { blue: 0x4a90e2, red: 0xe25c4a };

function makeMarker(team) {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  ctx.fillStyle = team === 'blue' ? '#5aa0f0' : '#f0604a';
  ctx.beginPath();
  ctx.moveTo(32, 44); ctx.lineTo(14, 16); ctx.lineTo(50, 16);
  ctx.closePath(); ctx.fill();
  const mat = new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false, opacity: 0.9 });
  const sp = new THREE.Sprite(mat);
  sp.scale.set(6, 6, 1);
  sp.renderOrder = 5;
  return sp;
}

export class Vehicle {
  constructor(game, team, isPlayer) {
    this.game = game;
    this.team = team;
    this.isPlayer = isPlayer;
    this.alive = true;
    this.name = isPlayer ? 'You' : game.nextBotName(team);
    this.group = new THREE.Group();
    this.vel = new THREE.Vector3();
    this.lastAttacker = null;
    this.smokeTimer = 0;
    game.scene.add(this.group);
    this.marker = makeMarker(team);
    this.marker.position.y = 7;
    if (!isPlayer) this.group.add(this.marker);
  }

  // realistic mode strips enemy nameplates (player is always on blue)
  refreshMarker() {
    this.marker.visible = !this.isPlayer && (!this.game.realistic || this.team === 'blue');
  }

  get pos() { return this.group.position; }

  takeDamage(amount, attacker) {
    if (!this.alive) return;
    this.hp -= amount;
    if (attacker) this.lastAttacker = attacker;
    if (this.hp <= 0) this.die(attacker);
  }

  die(attacker) {
    if (!this.alive) return;
    this.alive = false;
    this.game.effects.explosion(this.pos, this.kind === 'tank' ? 1.4 : 1.1);
    this.game.audio.boom(this.pos, this.kind === 'tank' ? 1.4 : 1.1);
    this.game.onVehicleKilled(this, attacker ?? this.lastAttacker);
  }

  updateSmoke(dt) {
    if (this.hp < this.maxHp * 0.4) {
      this.smokeTimer -= dt;
      if (this.smokeTimer <= 0) {
        this.smokeTimer = 0.08;
        this.game.effects.smokeTrail(this.pos);
        // critically damaged: burning
        if (this.hp < this.maxHp * 0.18) this.game.effects.fireTrail(this.pos);
      }
    }
  }

  forward(out) {
    return out.set(0, 0, -1).applyQuaternion(this.group.quaternion);
  }
}

// ---------------------------------------------------------------- PLANE

const NATION_PLANE_COLOR = {
  USA: 0x5a6b3f, UK: 0x4f5f45, USSR: 0x4f6b35, Germany: 0x59605f, Japan: 0x707a68,
};

function makeProp(dark, scale = 1) {
  const prop = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.24 * scale, 2.9 * scale, 0.08), dark);
    blade.rotation.z = i * Math.PI * 2 / 3;
    blade.position.y = 0;
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(1.5 * scale, 16),
    new THREE.MeshBasicMaterial({ color: 0x20221f, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false })
  );
  prop.add(disc);
  return prop;
}

// stacked discs that read as a national roundel from a distance
const ROUNDEL = {
  USA: [[0.62, 0x2a4d8f], [0.3, 0xf0f0f0]],
  UK: [[0.62, 0x2a4d8f], [0.42, 0xf0f0f0], [0.2, 0xc03a2b]],
  USSR: [[0.62, 0xc03a2b], [0.26, 0xf0f0f0]],
  Germany: [[0.6, 0xf0f0f0], [0.36, 0x1c1c1c]],
  Japan: [[0.62, 0xf0f0f0], [0.4, 0xc03a2b]],
};

function addRoundels(g, nation, x, y, z) {
  const spec = ROUNDEL[nation] ?? ROUNDEL.USA;
  for (const side of [-1, 1]) {
    let h = 0;
    for (const [r, col] of spec) {
      h += 0.015;
      const disc = new THREE.Mesh(
        new THREE.CylinderGeometry(r, r, 0.02, 12),
        new THREE.MeshLambertMaterial({ color: col })
      );
      disc.position.set(side * x, y + h, z);
      g.add(disc);
    }
  }
}

// tapered, slightly swept wing half with dihedral
function wingHalf(mat, span, root, tipChord, side) {
  const geo = new THREE.BoxGeometry(span, 0.2, root, 6, 1, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getX(i) + span / 2) / span;      // 0 root -> 1 tip
    pos.setZ(i, pos.getZ(i) * (1 - (1 - tipChord / root) * t) + t * 0.35); // taper + sweep back
    pos.setY(i, pos.getY(i) + t * 0.3);             // dihedral
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.position.x = side * span / 2;
  if (side < 0) m.scale.x = -1;
  return m;
}

function buildPlaneMesh(team, spec) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: NATION_PLANE_COLOR[spec.nation] ?? 0x5a6b3f });
  const accent = new THREE.MeshLambertMaterial({ color: TEAM_COLOR[team] });
  const dark = new THREE.MeshLambertMaterial({ color: 0x2a2d2a });
  const props = [];

  // fuselage: lathe profile, nose at -Z
  const pts = [
    new THREE.Vector2(0.04, 4.7), new THREE.Vector2(0.42, 4.2), new THREE.Vector2(0.72, 3.2),
    new THREE.Vector2(0.85, 1.6), new THREE.Vector2(0.82, 0.2), new THREE.Vector2(0.6, -1.6),
    new THREE.Vector2(0.34, -3.0), new THREE.Vector2(0.12, -3.6),
  ];
  const fusGeo = new THREE.LatheGeometry(pts, 12);
  fusGeo.rotateX(-Math.PI / 2);
  const fus = new THREE.Mesh(fusGeo, body);
  g.add(fus);

  // wings
  const halfSpan = 5.2;
  for (const side of [-1, 1]) {
    const w = wingHalf(body, halfSpan, 2.4, 1.1, side);
    w.position.set(side * 0.4 + w.position.x * 0, -0.25, -0.5);
    w.position.x = side * halfSpan / 2 + side * 0.35;
    g.add(w);
    const tip = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.22, 1.1), accent);
    tip.position.set(side * (halfSpan + 0.55), 0.02, -0.35);
    g.add(tip);
  }
  addRoundels(g, spec.nation, 3.4, -0.1, -0.5);

  // tail
  const hstab = new THREE.Mesh(new THREE.BoxGeometry(4.0, 0.16, 1.2), body);
  hstab.position.set(0, 0.15, 2.9);
  g.add(hstab);
  const vGeo = new THREE.BoxGeometry(0.16, 1.7, 1.5);
  const vp = vGeo.attributes.position;
  for (let i = 0; i < vp.count; i++) {
    const t = (vp.getY(i) + 0.85) / 1.7;
    vp.setZ(i, vp.getZ(i) * (1 - 0.45 * t) + t * 0.5);
  }
  vGeo.computeVertexNormals();
  const vstab = new THREE.Mesh(vGeo, accent);
  vstab.position.set(0, 1.0, 3.1);
  g.add(vstab);

  // bubble canopy
  const canopy = new THREE.Mesh(
    new THREE.SphereGeometry(0.55, 10, 8),
    new THREE.MeshLambertMaterial({ color: 0x8fc0e0, transparent: true, opacity: 0.85 })
  );
  canopy.scale.set(0.85, 0.75, 1.7);
  canopy.position.set(0, 0.72, -0.4);
  g.add(canopy);

  if (spec.twin) {
    // twin-engine: nacelles on the wings, no nose prop
    for (const side of [-1, 1]) {
      const nac = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.5, 2.6, 8), body);
      nac.rotation.x = Math.PI / 2;
      nac.position.set(side * 2.5, -0.15, -1.2);
      g.add(nac);
      const cone = new THREE.Mesh(new THREE.ConeGeometry(0.42, 0.8, 8), dark);
      cone.rotation.x = -Math.PI / 2;
      cone.position.set(side * 2.5, -0.15, -2.75);
      g.add(cone);
      const prop = makeProp(dark, 0.75);
      prop.position.set(side * 2.5, -0.15, -3.0);
      g.add(prop);
      props.push(prop);
    }
  } else {
    const spinner = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.9, 8), dark);
    spinner.rotation.x = -Math.PI / 2;
    spinner.position.z = -4.85;
    g.add(spinner);
    const prop = makeProp(dark, 1.1);
    prop.position.z = -4.95;
    g.add(prop);
    props.push(prop);
  }

  // attackers read as bigger, beefier airframes
  if (spec.bombs >= 4 || spec.twin) g.scale.setScalar(1.18);
  g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { mesh: g, props };
}

export class Plane extends Vehicle {
  constructor(game, team, isPlayer, spec) {
    super(game, team, isPlayer);
    this.kind = 'plane';
    this.spec = spec ?? PLANES.find((s) => s.team === team);
    this.maxHp = this.hp = this.spec.hp;
    this.radius = this.spec.bombs >= 4 ? 5.2 : 4.5;
    const { mesh, props } = buildPlaneMesh(team, this.spec);
    this.group.add(mesh);
    this.props = props;

    this.speed = 90;
    this.minSpeed = this.spec.minSpeed;
    this.maxSpeed = this.spec.maxSpeed;
    this.throttle = 0.8;
    this.bombs = this.spec.bombs;
    this.gunCd = 0;
    this.bombCd = 0;
    this.refreshMarker();
    // pitch/yaw/roll in [-1,1]; +pitch = nose up, +yaw = nose left, +roll = bank left
    this.controls = { pitch: 0, yaw: 0, roll: 0, throttle: 0.8, fire: false, bomb: false };
  }

  update(dt) {
    const c = this.controls;
    this.throttle = THREE.MathUtils.clamp(c.throttle, 0.15, 1);

    const realistic = this.game.realistic;
    const fwd = this.forward(_v1);
    const target = this.minSpeed + this.throttle * (this.maxSpeed - this.minSpeed) - fwd.y * (realistic ? 70 : 55);
    this.speed += (target - this.speed) * Math.min(1, dt * 0.5);
    this.speed = THREE.MathUtils.clamp(this.speed, 22, 210);

    // realistic: energy matters — turns bleed harder at low speed
    const agility = realistic
      ? THREE.MathUtils.clamp(this.speed / 100, 0.28, 1.1) * this.spec.agi
      : THREE.MathUtils.clamp(this.speed / 85, 0.45, 1.15) * this.spec.agi;
    const q = this.group.quaternion;
    q.multiply(_q1.setFromAxisAngle(AX, c.pitch * 1.5 * agility * dt));
    q.multiply(_q1.setFromAxisAngle(AY, c.yaw * 0.55 * agility * dt));
    q.multiply(_q1.setFromAxisAngle(AZ, c.roll * 2.6 * Math.min(1, this.spec.agi + 0.15) * dt));
    q.normalize();

    this.forward(fwd);
    this.vel.copy(fwd).multiplyScalar(this.speed);
    // sag when slow — stall
    const sink = Math.max(0, 1 - this.speed / (realistic ? 65 : 55)) * (realistic ? 42 : 25);
    this.vel.y -= sink;
    this.pos.addScaledVector(this.vel, dt);

    for (const pr of this.props) pr.rotation.z += dt * (10 + this.throttle * 40);

    // wingtip vapor trails when pulling G (hard maneuver) or streaking low & fast
    const gLoad = Math.abs(c.pitch) + Math.abs(c.roll) * 0.5;
    const low = this.altitude() < 90 && this.speed > 120;
    if (gLoad > 0.75 || low) {
      this.trailTimer = (this.trailTimer ?? 0) - dt;
      if (this.trailTimer <= 0) {
        this.trailTimer = 0.045;
        for (const side of [-1, 1]) {
          _v2.set(side * 5.4, -0.15, -0.5).applyQuaternion(q).add(this.pos);
          this.game.effects.contrail(_v2);
        }
      }
    }

    // guns
    this.gunCd -= dt;
    if (c.fire && this.gunCd <= 0) {
      this.gunCd = this.spec.gunCd;
      for (const side of [-1, 1]) {
        _v2.set(side * 1.7, -0.1, -1.4).applyQuaternion(q).add(this.pos);
        const dir = _v1.set((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02, -1)
          .normalize().applyQuaternion(q);
        this.game.projectiles.spawnBullet(this, _v2, dir, this.spec.gunDmg);
      }
      _v2.set(0, -0.1, -4).applyQuaternion(q).add(this.pos);
      _v1.set(0, 0, -1).applyQuaternion(q);
      this.game.effects.muzzleFlash(_v2, _v1, 0.7);
      this.game.audio.gun(this.pos, this.isPlayer);
    }

    // bombs
    // rearm bombs on a low pass over the home airfield
    if (this.bombs < this.spec.bombs) {
      const bz = this.game.baseZ ? this.game.baseZ[this.team] : (this.team === 'blue' ? 1500 : -1500);
      if (Math.hypot(this.pos.x, this.pos.z - bz) < 320 && this.altitude() < 200) {
        this.rearmT = (this.rearmT ?? 0) + dt;
        if (this.rearmT >= 6) {
          this.rearmT = 0;
          this.bombs++;
          if (this.isPlayer) this.game.hud.showCenter('BOMB REARMED', 1.2);
        }
      } else this.rearmT = 0;
    }

    this.bombCd -= dt;
    if (c.bomb && this.bombs > 0 && this.bombCd <= 0) {
      this.bombCd = 0.6;
      this.bombs--;
      _v2.set(0, -1.2, 0).applyQuaternion(q).add(this.pos);
      this.game.projectiles.spawnBomb(this, _v2, this.vel);
    }

    // terrain crash
    const h = this.game.world.getHeight(this.pos.x, this.pos.z);
    if (this.pos.y < Math.max(h, 0) + 1.3) {
      this.pos.y = Math.max(h, 0) + 1.3;
      this.die(this.lastAttacker);
    }
    if (this.pos.y > 1400) this.pos.y = 1400;

    this.updateSmoke(dt);
  }

  altitude() {
    return this.pos.y - Math.max(this.game.world.getHeight(this.pos.x, this.pos.z), 0);
  }
}

// ---------------------------------------------------------------- TANK

export const NATION_TANK_COLOR = {
  USA: 0x5c6b45, UK: 0x585f3f, USSR: 0x50653a, Germany: 0x6b6558, Japan: 0x6e6a50,
};

function buildTankMesh(team, spec) {
  const g = new THREE.Group();
  const body = new THREE.MeshLambertMaterial({ color: NATION_TANK_COLOR[spec.nation] ?? 0x5c6b45 });
  const dark = new THREE.MeshLambertMaterial({ color: 0x33362e });
  const accent = new THREE.MeshLambertMaterial({ color: TEAM_COLOR[team] });
  // primitive stand-in meshes — hidden when a glTF model grafts in
  const prim = [];
  const track = (m) => { m.castShadow = true; m.receiveShadow = true; prim.push(m); return m; };

  const hull = track(new THREE.Mesh(new THREE.BoxGeometry(3.0, 1.15, 5.6), body));
  hull.position.y = 1.15;
  g.add(hull);
  for (const side of [-1, 1]) {
    const t = track(new THREE.Mesh(new THREE.BoxGeometry(0.85, 1.0, 5.9), dark));
    t.position.set(side * 1.75, 0.62, 0);
    g.add(t);
  }
  const glacis = track(new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.8, 1.2), body));
  glacis.position.set(0, 0.9, -3.1);
  glacis.rotation.x = 0.5;
  g.add(glacis);

  const turretGroup = new THREE.Group();
  turretGroup.position.set(0, 1.95, -0.3);
  const turret = track(new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.45, 0.85, 10), body));
  turret.position.y = 0.3;
  turretGroup.add(turret);
  const stripe = track(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 1.8), accent));
  stripe.position.set(0, 0.78, 0.2);
  turretGroup.add(stripe);

  const barrelGroup = new THREE.Group();
  barrelGroup.position.set(0, 0.35, -0.9);
  const len = spec.barrelLen ?? 4.2;
  const barrel = track(new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.18, len, 8), dark));
  barrel.rotation.x = Math.PI / 2;
  barrel.position.z = -len / 2;
  barrelGroup.add(barrel);
  const muzzle = new THREE.Object3D();
  muzzle.position.z = -(len + 0.2);
  barrelGroup.add(muzzle);
  turretGroup.add(barrelGroup);
  g.add(turretGroup);
  g.scale.setScalar(spec.scale ?? 1);

  return { mesh: g, turretGroup, barrelGroup, muzzle, prim };
}

export class Tank extends Vehicle {
  constructor(game, team, isPlayer, spec) {
    super(game, team, isPlayer);
    this.kind = 'tank';
    this.spec = spec ?? TANKS.find((s) => s.team === team);
    this.maxHp = this.hp = this.spec.hp;
    this.radius = 3.4 * (this.spec.scale ?? 1);
    const { mesh, turretGroup, barrelGroup, muzzle, prim } = buildTankMesh(team, this.spec);
    this.group.add(mesh);
    this.refreshMarker();
    this.turret = turretGroup;
    this.barrel = barrelGroup;
    this.muzzle = muzzle;
    this._prim = prim;
    this.marker.position.y = 5.5;
    this.dustTimer = 0;
    game.models?.applyTank(this);

    this.yaw = 0;            // hull heading, source of truth
    this.speed = 0;
    this.reload = 0;
    this.reloadTime = this.spec.reload;
    // turretYaw is a desired WORLD yaw; barrelPitch desired pitch (+up)
    this.controls = { forward: 0, turn: 0, turretYaw: 0, barrelPitch: 0, fire: false, mg: false };
    this.mgCd = 0;
    this._normal = new THREE.Vector3(0, 1, 0);
  }

  update(dt) {
    const c = this.controls;
    const targetSpeed = c.forward > 0 ? c.forward * this.spec.speed : c.forward * this.spec.speed * 0.45;
    this.speed += (targetSpeed - this.speed) * Math.min(1, dt * 1.8);
    this.yaw += c.turn * 1.05 * dt;

    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
    this.pos.x += fx * this.speed * dt;
    this.pos.z += fz * this.speed * dt;
    // keep tanks inside the playable square
    const lim = this.game.world.bound;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -lim, lim);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -lim, lim);
    const h = this.game.world.getHeight(this.pos.x, this.pos.z);
    this.pos.y = h;

    // orient: yaw + terrain tilt
    this.game.world.getNormal(this.pos.x, this.pos.z, this._normal);
    _q1.setFromUnitVectors(UP, this._normal);
    _q2.setFromAxisAngle(AY, this.yaw);
    _q1.multiply(_q2);
    this.group.quaternion.slerp(_q1, Math.min(1, dt * 6));

    // turret slew toward desired world yaw
    const desiredLocal = wrapAngle(c.turretYaw - this.yaw);
    const diff = wrapAngle(desiredLocal - this.turret.rotation.y);
    const rate = this.spec.turretRate;
    const slew = THREE.MathUtils.clamp(diff, -rate * dt, rate * dt);
    this.turret.rotation.y = wrapAngle(this.turret.rotation.y + slew);
    const pdes = THREE.MathUtils.clamp(c.barrelPitch, -0.12, 0.42);
    this.barrel.rotation.x += THREE.MathUtils.clamp(pdes - this.barrel.rotation.x, -1.2 * dt, 1.2 * dt);

    // main gun
    this.reload -= dt;
    if (c.fire && this.reload <= 0) {
      this.reload = this.reloadTotal;
      this.muzzle.getWorldPosition(_v1);
      this.barrel.getWorldQuaternion(_q2);
      _v2.set(0, 0, -1).applyQuaternion(_q2);
      // realistic: a touch of gun dispersion
      if (this.game.realistic) {
        _v2.x += (Math.random() - 0.5) * 0.006;
        _v2.y += (Math.random() - 0.5) * 0.006;
        _v2.normalize();
      }
      this.game.projectiles.spawnShell(this, _v1, _v2, this.spec.shellDmg, this.spec.shellV);
      this.game.effects.sparkHit(_v1);
      this.game.effects.muzzleFlash(_v1, _v2, 1.5);
      this.game.audio.cannon(this.pos);
      if (this.isPlayer) this.game.addShake(0.4);
    }

    // coaxial machine gun — fires alongside the main gun, good vs planes
    this.mgCd -= dt;
    if (c.mg && this.mgCd <= 0) {
      this.mgCd = 0.1;
      this.muzzle.getWorldPosition(_v1);
      this.barrel.getWorldQuaternion(_q2);
      _v2.set((Math.random() - 0.5) * 0.02, (Math.random() - 0.5) * 0.02 - 0.012, -1)
        .normalize().applyQuaternion(_q2);
      this.game.projectiles.spawnBullet(this, _v1, _v2, this.spec.mgDmg ?? 7);
      this.game.effects.muzzleFlash(_v1, _v2, 0.4);
      this.game.audio.gun(this.pos, this.isPlayer);
    }

    this.vel.set(fx * this.speed, 0, fz * this.speed);
    // dust kicked up behind moving tracks
    if (Math.abs(this.speed) > 3) {
      this.dustTimer -= dt;
      if (this.dustTimer <= 0) {
        this.dustTimer = 0.09;
        _v1.set(-fx, 0, -fz).multiplyScalar(2.6 * (this.spec.scale ?? 1)).add(this.pos);
        _v1.y += 0.4;
        this.game.effects.dust(_v1);
      }
    }
    this.updateSmoke(dt);
  }

  get reloadTotal() {
    return this.reloadTime * (this.game.realistic ? 1.35 : 1);
  }

  // how far off the turret is from the commanded direction (for AI fire gating)
  turretError() {
    return Math.abs(wrapAngle(this.controls.turretYaw - this.yaw - this.turret.rotation.y));
  }
}

export function wrapAngle(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// world-space yaw that points -Z-forward objects toward direction (dx, dz)
export function yawToward(dx, dz) {
  return Math.atan2(-dx, -dz);
}

// Exact low-arc launch angle to hit a point dxz metres out and dy metres up
// with muzzle velocity v0 under gravity. Falls back to the 45° max-range arc
// when the target is beyond reach.
export function solveBallisticPitch(v0, dxz, dy) {
  const g = 9.8;
  const d = Math.max(dxz, 1);
  const disc = v0 * v0 * v0 * v0 - g * (g * d * d + 2 * dy * v0 * v0);
  if (disc <= 0) return Math.PI / 4;
  return Math.atan((v0 * v0 - Math.sqrt(disc)) / (g * d));
}
