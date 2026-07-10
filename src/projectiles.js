import * as THREE from 'three';

const _v = new THREE.Vector3();
const GRAV = 9.8;

export class Projectiles {
  constructor(game) {
    this.game = game;
    this.list = [];

    // pooled tracer meshes
    this.tracerPool = [];
    const bulletGeo = new THREE.BoxGeometry(0.14, 0.14, 2.6);
    const bulletMat = new THREE.MeshBasicMaterial({ color: 0xffd070 });
    const shellGeo = new THREE.BoxGeometry(0.35, 0.35, 3.2);
    const shellMat = new THREE.MeshBasicMaterial({ color: 0xffb040 });
    const bombGeo = new THREE.CylinderGeometry(0.35, 0.2, 1.6, 6);
    const bombMat = new THREE.MeshLambertMaterial({ color: 0x333a33 });
    this.geos = { bullet: [bulletGeo, bulletMat], shell: [shellGeo, shellMat], bomb: [bombGeo, bombMat] };
  }

  _mesh(type) {
    const [geo, mat] = this.geos[type];
    const m = new THREE.Mesh(geo, mat);
    this.game.scene.add(m);
    return m;
  }

  spawnBullet(owner, pos, dir, dmg = 10) {
    if (this.list.length > 400) return;
    const mult = this.game.realistic ? 1.35 : 1;
    this.list.push({
      type: 'bullet', owner, mesh: this._mesh('bullet'),
      pos: pos.clone(), vel: dir.clone().multiplyScalar(340),
      life: 1.7, dmg: dmg * mult, dmgTank: dmg * 0.25 * mult, gravity: 0.15,
    });
  }

  spawnShell(owner, pos, dir, dmg = 145, speed = 240) {
    const mult = this.game.realistic ? 1.4 : 1;
    this.list.push({
      type: 'shell', owner, mesh: this._mesh('shell'),
      pos: pos.clone(), vel: dir.clone().multiplyScalar(speed),
      life: 6, dmg: dmg * mult, dmgTank: dmg * mult, gravity: 1, splash: 9, splashDmg: dmg * 0.4 * mult,
    });
  }

  spawnBomb(owner, pos, vel) {
    this.list.push({
      type: 'bomb', owner, mesh: this._mesh('bomb'),
      pos: pos.clone(), vel: vel.clone(),
      life: 15, dmg: 0, dmgTank: 0, gravity: 1, splash: 24, splashDmg: 250,
    });
  }

  explodeSplash(p) {
    this.game.effects.explosion(p.pos, p.type === 'bomb' ? 1.8 : 0.7);
    this.game.audio.boom(p.pos, p.type === 'bomb' ? 1.8 : 0.7);
    for (const v of this.game.vehicles) {
      if (!v.alive || v.team === p.owner.team) continue;
      const d = v.pos.distanceTo(p.pos);
      if (d < p.splash + v.radius) {
        const fall = 1 - Math.max(0, d - v.radius) / p.splash;
        v.takeDamage(p.splashDmg * fall, p.owner);
        if (v.isPlayer) {
          this.game.hud.flashDamage();
          this.game.addShake(0.5 * fall + 0.2);
        }
      }
    }
  }

  update(dt) {
    const world = this.game.world;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const p = this.list[i];
      p.life -= dt;
      p.vel.y -= GRAV * p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      p.mesh.position.copy(p.pos);
      if (p.vel.lengthSq() > 1) {
        _v.copy(p.pos).add(p.vel);
        p.mesh.lookAt(_v);
        if (p.type === 'bomb') p.mesh.rotateX(Math.PI / 2);
      }

      let dead = p.life <= 0;

      // terrain / water
      if (!dead && p.pos.y < Math.max(world.getHeight(p.pos.x, p.pos.z), 0)) {
        if (p.splash) this.explodeSplash(p);
        else this.game.effects.dirtHit(p.pos);
        dead = true;
      }

      // vehicles
      if (!dead) {
        for (const v of this.game.vehicles) {
          if (!v.alive || v === p.owner || v.team === p.owner.team) continue;
          const rr = v.radius + (p.type === 'bullet' ? 0.5 : 1.0);
          if (v.pos.distanceToSquared(p.pos) < rr * rr) {
            if (p.splash) {
              this.explodeSplash(p);
            } else {
              const raw = v.kind === 'tank' ? p.dmgTank : p.dmg;
              v.takeDamage(p.type === 'shell' ? raw * (0.85 + Math.random() * 0.3) : raw, p.owner);
              this.game.effects.sparkHit(p.pos);
              if (v.isPlayer) {
                this.game.hud.flashDamage();
                this.game.addShake(p.type === 'shell' ? 0.7 : 0.15);
              }
              if (p.owner.isPlayer) this.game.hud.hitMarker();
            }
            dead = true;
            break;
          }
        }
      }

      if (dead) {
        this.game.scene.remove(p.mesh);
        this.list.splice(i, 1);
      }
    }
  }
}
