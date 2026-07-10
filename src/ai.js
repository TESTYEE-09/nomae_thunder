import * as THREE from 'three';
import { wrapAngle, yawToward, solveBallisticPitch } from './vehicles.js';

const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _aim = new THREE.Vector3();
const _fwd = new THREE.Vector3();
const _right = new THREE.Vector3();
const _iq = new THREE.Quaternion();

function pickNearest(game, self, kind, maxDist = Infinity) {
  let best = null, bestD = maxDist * maxDist;
  for (const v of game.vehicles) {
    if (!v.alive || v.team === self.team) continue;
    if (kind && v.kind !== kind) continue;
    const d = v.pos.distanceToSquared(self.pos);
    if (d < bestD) { bestD = d; best = v; }
  }
  return best;
}

// ---------------------------------------------------------------- PLANE AI

export class PlaneAI {
  constructor(game, plane) {
    this.game = game;
    this.plane = plane;
    this.target = null;
    this.retarget = Math.random() * 2;
    this.aggression = 0.7 + Math.random() * 0.5;
  }

  update(dt) {
    const p = this.plane, c = p.controls, game = this.game;
    this.retarget -= dt;
    if (this.retarget <= 0 || !this.target || !this.target.alive) {
      this.retarget = 2 + Math.random() * 2;
      const enemyPlane = pickNearest(game, p, 'plane');
      const enemyTank = pickNearest(game, p, 'tank');
      // mostly dogfight; sometimes go strafe/bomb ground targets
      this.target = enemyPlane && (Math.random() < 0.75 || !enemyTank) ? enemyPlane : enemyTank;
    }

    c.throttle = 1;
    c.fire = false;
    c.bomb = false;

    const alt = p.altitude();
    p.forward(_fwd);
    _right.set(1, 0, 0).applyQuaternion(p.group.quaternion);

    // hard overrides: ground avoidance, then map bounds
    const horiz = Math.hypot(p.pos.x, p.pos.z);
    const sink = Math.max(0, -p.vel.y);
    if (alt < 70 + sink * 1.3 && _fwd.y < 0.2) {
      // pull up and level the wings
      c.pitch = 1;
      c.roll = THREE.MathUtils.clamp(-_right.y * 4, -1, 1);
      c.yaw = 0;
      return;
    }
    let aimPoint;
    if (horiz > game.world.bound) {
      aimPoint = _aim.set(0, 320, 0);
    } else if (this.target) {
      const t = this.target;
      const dist = t.pos.distanceTo(p.pos);
      const tof = dist / 340;
      aimPoint = _aim.copy(t.pos).addScaledVector(t.vel, tof);
      if (t.kind === 'tank') {
        // strafe run: aim slightly above, pull off when close
        aimPoint.y += 2;
        if (dist < 120 || (alt < 60 && _fwd.y < 0)) {
          aimPoint = _aim.set(p.pos.x + _fwd.x * 500, p.pos.y + 180, p.pos.z + _fwd.z * 500);
        }
        // bomb drop: roughly overhead
        const dx = t.pos.x - p.pos.x, dz = t.pos.z - p.pos.z;
        if (p.bombs > 0 && Math.hypot(dx, dz) < 45 && alt > 60 && alt < 300) c.bomb = true;
      }
    } else {
      // patrol toward the point
      aimPoint = _aim.set(0, 260, 0);
    }

    // steer toward aim point in local space
    _v1.copy(aimPoint).sub(p.pos).normalize();
    _iq.copy(p.group.quaternion).invert();
    _v2.copy(_v1).applyQuaternion(_iq); // local dir; -z forward, +y up, +x right
    c.pitch = THREE.MathUtils.clamp(_v2.y * 3.5 * this.aggression, -1, 1);
    c.yaw = THREE.MathUtils.clamp(-_v2.x * 1.5, -1, 1);
    c.roll = THREE.MathUtils.clamp(-_v2.x * 2.2, -1, 1);
    // if the target is behind, commit to a hard bank-and-turn
    if (_v2.z > 0.3) {
      c.pitch = Math.max(c.pitch, 0.7);
      c.roll = _v2.x > 0 ? -1 : 1;
    }

    // guns
    if (this.target && this.target.alive) {
      const dist = this.target.pos.distanceTo(p.pos);
      const angle = _fwd.angleTo(_v1);
      const maxRange = this.target.kind === 'tank' ? 650 : 480;
      if (angle < 0.05 && dist < maxRange) c.fire = true;
    }
  }
}

// ---------------------------------------------------------------- TANK AI

export class TankAI {
  constructor(game, tank) {
    this.game = game;
    this.tank = tank;
    this.target = null;
    this.retarget = Math.random() * 1.5;
    // hold a personal offset inside the cap zone so bots spread out
    const a = Math.random() * Math.PI * 2, r = Math.random() * 60;
    this.holdPos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r).add(game.world.capturePoint);
    this.wiggle = Math.random() * 10;
  }

  update(dt) {
    const t = this.tank, c = t.controls, game = this.game;
    this.retarget -= dt;
    if (this.retarget <= 0 || (this.target && !this.target.alive)) {
      this.retarget = 1.2 + Math.random();
      this.target = pickNearest(game, t, 'tank', 700);
    }

    c.fire = false;
    c.mg = false;

    if (this.target && this.target.alive) {
      const tgt = this.target;
      const dist = tgt.pos.distanceTo(t.pos);
      // rattle the coax at anything close once the turret is roughly on
      c.mg = dist < 320 && t.turretError() < 0.1;
      // lead the shot with this gun's muzzle velocity
      const v0 = t.spec.shellV;
      const tof = dist / v0;
      _v1.copy(tgt.pos).addScaledVector(tgt.vel, tof);
      const dx = _v1.x - t.pos.x, dz = _v1.z - t.pos.z;
      const dxz = Math.hypot(dx, dz);
      c.turretYaw = yawToward(dx, dz);
      const dy = (_v1.y + 1.6) - (t.pos.y + 2.3);
      c.barrelPitch = solveBallisticPitch(v0, dxz, dy);

      // fight on the move: keep pushing the objective unless we already hold it
      const holdOwned = game.capOwner === t.team;
      const inZone = t.pos.distanceTo(game.world.capturePoint) < game.world.captureRadius * 0.85;
      if (inZone || (holdOwned && dist < 500)) { c.forward = 0; c.turn = 0; }
      else if (holdOwned) { c.forward = 0.8; this.steerToward(tgt.pos, c); }
      else { c.forward = 0.85; this.steerToward(this.holdPos, c); }

      if (t.turretError() < 0.035 && t.reload <= 0 && dist < 680 && this.lineClear(t.pos, tgt.pos)) {
        c.fire = true;
      }
    } else {
      // advance on the capture point
      const d = this.holdPos.distanceTo(t.pos);
      if (d > 25) {
        c.forward = 1;
        this.steerToward(this.holdPos, c);
        c.turretYaw = t.yaw + Math.sin(game.time * 0.5 + this.wiggle) * 0.6; // scan
        c.barrelPitch = 0;
      } else {
        c.forward = 0; c.turn = 0;
        c.turretYaw = t.yaw + Math.sin(game.time * 0.4 + this.wiggle) * 1.2;
        c.barrelPitch = 0;
      }
    }
  }

  steerToward(point, c) {
    const t = this.tank;
    const desired = yawToward(point.x - t.pos.x, point.z - t.pos.z);
    const diff = wrapAngle(desired - t.yaw);
    c.turn = THREE.MathUtils.clamp(diff * 2.5, -1, 1);
    if (Math.abs(diff) > 1.2) c.forward = 0.25;
  }

  // sample terrain along the shot line so bots don't shoot into hills
  lineClear(a, b) {
    const world = this.game.world;
    for (let f = 0.15; f < 0.95; f += 0.16) {
      const x = a.x + (b.x - a.x) * f;
      const y = a.y + 2.3 + (b.y + 1.6 - a.y - 2.3) * f;
      const z = a.z + (b.z - a.z) * f;
      if (world.getHeight(x, z) > y + 0.5) return false;
    }
    return true;
  }
}
