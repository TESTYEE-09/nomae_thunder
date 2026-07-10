import * as THREE from 'three';
import { World } from './world.js';
import { Effects } from './effects.js';
import { Projectiles } from './projectiles.js';
import { Plane, Tank, yawToward, solveBallisticPitch, TEAM_COLOR } from './vehicles.js';
import { PLANES, TANKS, pickRandom } from './catalog.js';
import { PlaneAI, TankAI } from './ai.js';
import { HUD } from './hud.js';
import { GameAudio } from './audio.js';
import { Input } from './input.js';
import { ModelCache } from './models.js';
import { Progress } from './progress.js';
import { Hangar } from './hangar.js';

const DISPLAY_POS = new THREE.Vector3(8000, 0, 8000); // hangar turntable, far from battle

const UP = new THREE.Vector3(0, 1, 0);
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _aim = new THREE.Vector3();

const NAMES = {
  blue: ['Lt. Baker', 'Sgt. Kowalski', 'Cpt. Reed', 'Maj. Duval', 'Lt. Novak', 'Sgt. Doyle', 'Cpl. Mason', 'Cpt. Leclerc', 'Lt. Hayes', 'Sgt. Brody'],
  red: ['Ofw. Krantz', 'Lt. Vogel', 'Hpt. Richter', 'Fw. Brandt', 'Lt. Seiler', 'Ofw. Lang', 'Hpt. Moritz', 'Fw. Adler', 'Lt. Falk', 'Ofw. Jäger'],
};

const BASE_Z = { blue: 1500, red: -1500 };
const BOTS = { blue: { plane: 4, tank: 4 }, red: { plane: 4, tank: 5 } };
const START_TICKETS = { arcade: 500, realistic: 350 };

class Game {
  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.className = 'game';
    document.getElementById('app').appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87b5d9);
    this.scene.fog = new THREE.Fog(0x9cc0d8, 700, 4200);
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 0.5, 8000);
    this.camera.position.set(0, 300, 600);
    this.baseFov = 65;

    this.world = new World(this.scene);
    this.effects = new Effects(this.scene);
    this.projectiles = new Projectiles(this);
    this.audio = new GameAudio();
    this.input = new Input(this.renderer.domElement);
    this.hud = new HUD(this);
    this.models = new ModelCache();
    this.models.preload();
    this.progress = new Progress();

    // ---- settings (persisted in 'tf_settings') ----
    this.mouseSens = 1;
    this.invertY = false;
    this.settings = { volume: 0.8, sens: 1, invertY: false, shadows: true };
    this.loadSettings();

    this.displayVehicle = null;

    this.realistic = false;
    this.vehicles = [];
    this.respawnQueue = [];
    this.killQueue = [];
    this.tickets = { blue: 500, red: 500 };
    this.capProgress = 0;
    this.capOwner = null;
    this.time = 0;
    this.state = 'menu'; // menu | playing | dead | end
    this.player = null;
    this.stick = { x: 0, y: 0 };
    this.camYaw = 0;
    this.camPitch = 0.08;
    this.outOfBounds = false;
    this.oobTimer = 0;
    this.nameIdx = { blue: 0, red: 0 };
    this.camPos = new THREE.Vector3(0, 300, 600);
    this.baseZ = BASE_Z;
    this.shakeT = 0;

    this.restartMatch();
    this.bindUI();
    this.hangar = new Hangar(this);
    addEventListener('resize', () => {
      this.camera.aspect = innerWidth / innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(innerWidth, innerHeight);
    });

    this.clock = new THREE.Clock();
    this.renderer.setAnimationLoop(() => this.frame());
  }

  bindUI() {
    // Mode buttons + hangar UI are wired by the Hangar module. Here we only need
    // the canvas click to (re)acquire pointer lock while playing.
    this.renderer.domElement.addEventListener('mousedown', () => {
      if (this.state === 'playing') this.input.requestLock();
    });
  }

  setMode(realistic) {
    if (this.realistic === realistic || this.state === 'playing') return;
    this.realistic = realistic;
    document.getElementById('modearcade').classList.toggle('active', !realistic);
    document.getElementById('moderealistic').classList.toggle('active', realistic);
    document.getElementById('modebadge').classList.toggle('hidden', !realistic);
    this.restartMatch();
    if (this.hangar) this.hangar.open();
  }

  // ------------------------------------------------------------- settings

  loadSettings() {
    let s = {};
    try { s = JSON.parse(localStorage.getItem('tf_settings') || '{}') || {}; } catch { s = {}; }
    this.settings = {
      volume: s.volume ?? 0.8,
      sens: s.sens ?? 1,
      invertY: s.invertY ?? false,
      shadows: s.shadows ?? true,
    };
    this.applySettings();
  }

  setSetting(key, value) {
    this.settings[key] = value;
    this.applySettings();
    try { localStorage.setItem('tf_settings', JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  applySettings() {
    const s = this.settings;
    this.audio.setMasterVolume(s.volume);
    this.mouseSens = s.sens;
    this.invertY = s.invertY;
    if (this.renderer.shadowMap.enabled !== s.shadows) {
      this.renderer.shadowMap.enabled = s.shadows;
      if (this.world?.sun) this.world.sun.castShadow = s.shadows;
      this.scene.traverse((o) => { if (o.isMesh && o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        for (const m of mats) m.needsUpdate = true;
      } });
    }
  }

  // ------------------------------------------------------------- hangar display

  setDisplayVehicle(spec) {
    if (this.displayVehicle) { this.scene.remove(this.displayVehicle.group); this.displayVehicle = null; }
    if (!spec) return;
    const v = spec.kind === 'plane'
      ? new Plane(this, 'blue', true, spec)
      : new Tank(this, 'blue', true, spec);
    v.ai = null;
    const h = this.world.getHeight(DISPLAY_POS.x, DISPLAY_POS.z);
    v.pos.set(DISPLAY_POS.x, spec.kind === 'plane' ? h + 12 : h, DISPLAY_POS.z);
    if (spec.kind === 'tank') v.yaw = 0;
    this._displaySpin = 0.4;
    this.displayVehicle = v;
  }

  openMenu() {
    this.state = 'menu';
    if (this.hangar) this.hangar.open();
  }

  restartMatch() {
    for (const v of this.vehicles) this.scene.remove(v.group);
    this.vehicles.length = 0;
    for (const p of this.projectiles.list) this.scene.remove(p.mesh);
    this.projectiles.list.length = 0;
    this.respawnQueue.length = 0;
    this.killQueue.length = 0;
    const t = START_TICKETS[this.realistic ? 'realistic' : 'arcade'];
    this.tickets = { blue: t, red: t };
    this.capProgress = 0;
    this.capOwner = null;
    this.world.setZoneColor(0xcccccc);
    this.player = null;
    for (const team of ['blue', 'red']) {
      for (let i = 0; i < BOTS[team].plane; i++) this.spawnBot(team, 'plane', i);
      for (let i = 0; i < BOTS[team].tank; i++) this.spawnBot(team, 'tank', i);
    }
  }

  nextBotName(team) {
    const list = NAMES[team];
    return list[this.nameIdx[team]++ % list.length];
  }

  volumeAt(pos) {
    const d = this.camera.position.distanceTo(pos);
    return THREE.MathUtils.clamp(1 - d / 950, 0, 1) ** 1.5;
  }

  // ------------------------------------------------------------- spawning

  spawnPos(team, kind, slot = 0) {
    const zBase = BASE_Z[team];
    const x = (slot - 1.5) * 90 + (Math.random() - 0.5) * 60;
    const z = zBase + (Math.random() - 0.5) * 120;
    const y = this.world.getHeight(x, z);
    return new THREE.Vector3(x, kind === 'plane' ? Math.max(y, 0) + 280 + Math.random() * 80 : y, z);
  }

  spawnBot(team, kind, slot = 0) {
    const spec = pickRandom(kind === 'plane' ? PLANES : TANKS, team);
    const v = kind === 'plane' ? new Plane(this, team, false, spec) : new Tank(this, team, false, spec);
    const p = this.spawnPos(team, kind, slot);
    v.pos.copy(p);
    const yaw = yawToward(-p.x * 0.3, (team === 'blue' ? -1 : 1) * 1000);
    if (kind === 'tank') {
      v.yaw = yaw;
      v.controls.turretYaw = yaw;
      v.group.rotation.y = yaw;
      v.ai = new TankAI(this, v);
    } else {
      v.group.quaternion.setFromAxisAngle(UP, yaw);
      v.ai = new PlaneAI(this, v);
    }
    this.vehicles.push(v);
    return v;
  }

  spawnPlayer(spec) {
    if (this.state === 'playing') return;
    if (!this.progress.isOwned(spec.id)) return; // safety: only owned vehicles deploy
    this.audio.ensure(this.camera);
    this.applySettings(); // re-apply master volume now that the audio graph exists
    this.setDisplayVehicle(null);
    this.progress.beginLife();
    const kind = spec.kind;
    const v = kind === 'plane' ? new Plane(this, 'blue', true, spec) : new Tank(this, 'blue', true, spec);
    const p = this.spawnPos('blue', kind, 1.5);
    v.pos.copy(p);
    const yaw = yawToward(-p.x * 0.3, -1000);
    if (kind === 'tank') {
      v.yaw = yaw;
      v.controls.turretYaw = yaw;
      v.group.rotation.y = yaw;
      this.camYaw = yaw;
      this.camPitch = 0.08;
    } else {
      v.group.quaternion.setFromAxisAngle(UP, yaw);
      this.stick.x = 0; this.stick.y = 0;
    }
    this.vehicles.push(v);
    this.player = v;
    this.state = 'playing';
    this.hangar.close();
    this.hud.setHints(kind);
    this.input.requestLock();
    this.audio.startEngine(kind);
    document.getElementById('vname').textContent = `${spec.flag} ${spec.name}`;
    this.hud.showCenter(`${spec.name.toUpperCase()} ${kind === 'plane' ? 'AIRBORNE' : 'DEPLOYED'}`, 2);
    // snap camera behind the new vehicle
    this.updateCamera(0.001, true);
  }

  // ------------------------------------------------------------- kills

  onVehicleKilled(victim, attacker) {
    this.killQueue.push(victim);
    this.tickets[victim.team] = Math.max(0, this.tickets[victim.team] - (victim.kind === 'tank' ? 14 : 10));
    if (attacker && attacker.team !== victim.team) {
      this.hud.addKill(attacker.name, attacker.team, victim.name, victim.team, '☠');
      if (attacker.isPlayer) {
        this.hud.showCenter(`DESTROYED ${victim.name.toUpperCase()}`, 1.6);
        this.progress.recordKill();
      }
    } else {
      this.hud.addKill('', victim.team, victim.name, victim.team, '💥 crashed:');
    }
    if (victim.isPlayer) {
      this.state = 'dead';
      this.audio.stopEngine();
      const killer = attacker && attacker !== victim ? `Destroyed by ${attacker.name}` : 'You crashed';
      setTimeout(() => {
        if (this.state !== 'dead') return;
        this.input.releaseLock();
        // bank this sortie's earnings and show the results panel; the match plays on
        const summary = this.progress.finishLife(false);
        this.hangar.showResults(summary, {
          title: 'SORTIE COMPLETE',
          subtitle: killer,
          button: 'Back to Hangar',
          victory: null,
          onClose: () => this.openMenu(),
        });
      }, 2200);
    }
  }

  sweepKills() {
    for (const v of this.killQueue) {
      this.scene.remove(v.group);
      const i = this.vehicles.indexOf(v);
      if (i >= 0) this.vehicles.splice(i, 1);
      if (v === this.player) this.player = null;
      else this.respawnQueue.push({ team: v.team, kind: v.kind, at: this.time + 9 });
    }
    this.killQueue.length = 0;
    for (let i = this.respawnQueue.length - 1; i >= 0; i--) {
      if (this.respawnQueue[i].at <= this.time) {
        const r = this.respawnQueue.splice(i, 1)[0];
        this.spawnBot(r.team, r.kind, Math.floor(Math.random() * 4));
      }
    }
  }

  // ------------------------------------------------------------- player controls

  updatePlayerControls(dt) {
    const p = this.player;
    const raw = this.input.consumeMouse();
    const dx = raw.dx * this.mouseSens;
    let dy = raw.dy * this.mouseSens;
    if (!p || !p.alive || this.state !== 'playing') return;
    const k = (key) => this.input.key(key);

    if (p.kind === 'plane') {
      if (this.invertY) dy = -dy;
      this.stick.x = THREE.MathUtils.clamp(this.stick.x + dx * 0.0023, -1, 1);
      this.stick.y = THREE.MathUtils.clamp(this.stick.y + dy * 0.0023, -1, 1);
      const decay = Math.max(0, 1 - dt * 1.4);
      this.stick.x *= decay;
      this.stick.y *= decay;

      const c = p.controls;
      c.pitch = -this.stick.y;
      c.yaw = -this.stick.x * 0.5;
      c.roll = -this.stick.x + (k('a') ? 1 : 0) + (k('d') ? -1 : 0);
      c.throttle = THREE.MathUtils.clamp(c.throttle + (k('w') ? dt * 0.55 : 0) - (k('s') ? dt * 0.55 : 0), 0.15, 1);
      c.fire = this.input.mouse[0] || k(' ');
      c.bomb = k('b');
      this.audio.setEngine(p.throttle);
    } else {
      // scope slows the mouse for fine aim
      const sens = 0.0023 * (this.input.mouse[2] ? 0.35 : 1);
      this.camYaw -= dx * sens;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch - dy * sens, -0.2, 0.45);

      const c = p.controls;
      c.forward = (k('w') ? 1 : 0) + (k('s') ? -1 : 0);
      c.turn = (k('a') ? 1 : 0) + (k('d') ? -1 : 0);
      // converge the gun on the exact point under the crosshair (camera-ray hit),
      // so shots land where the sight points instead of parallel to the camera.
      const aim = this.computeAimPoint(_aim);
      const adx = aim.x - p.pos.x, adz = aim.z - p.pos.z;
      const dxz = Math.hypot(adx, adz);
      c.turretYaw = yawToward(adx, adz);
      const muzzleY = p.pos.y + 2.3 * (p.spec.scale ?? 1);
      // arcade aim assist: exact ballistic solution onto the aim point.
      // realistic mode: raw geometric aim — you hold over the target yourself.
      c.barrelPitch = this.realistic
        ? Math.atan2(aim.y - muzzleY, Math.max(dxz, 1))
        : solveBallisticPitch(p.spec.shellV, dxz, aim.y - muzzleY);
      c.fire = this.input.mouse[0];
      c.mg = k(' ');
      this.audio.setEngine(Math.abs(p.speed) / 14);
    }
  }

  // march the screen-centre camera ray out to the first vehicle or terrain hit;
  // that world point is what the crosshair is actually on.
  computeAimPoint(out) {
    this.camera.getWorldDirection(_v1);
    const o = this.camera.position;
    for (let d = 6; d < 1400; d += 8) {
      const x = o.x + _v1.x * d, y = o.y + _v1.y * d, z = o.z + _v1.z * d;
      for (const v of this.vehicles) {
        if (!v.alive || v.isPlayer) continue;
        const rr = v.radius + 1;
        if (v.pos.distanceToSquared(_v2.set(x, y, z)) < rr * rr) return out.set(x, y, z);
      }
      if (this.world.getHeight(x, z) > y) return out.set(x, y, z);
    }
    return out.copy(o).addScaledVector(_v1, 1400);
  }

  // ------------------------------------------------------------- capture & tickets

  updateBattle(dt) {
    if (this.state === 'playing' && this.player && this.player.alive) this.progress.addTime(dt);
    let blueN = 0, redN = 0;
    let playerInZone = false;
    for (const v of this.vehicles) {
      if (!v.alive || v.kind !== 'tank') continue;
      if (v.pos.distanceTo(this.world.capturePoint) < this.world.captureRadius) {
        if (v.team === 'blue') blueN++; else redN++;
        if (v.isPlayer) playerInZone = true;
      }
    }
    if (playerInZone && blueN > 0 && redN === 0) this.progress.recordCapture();
    const prevOwner = this.capOwner;
    if (blueN > 0 && redN === 0) this.capProgress = Math.min(1, this.capProgress + dt * 0.055 * Math.min(blueN, 3));
    else if (redN > 0 && blueN === 0) this.capProgress = Math.max(-1, this.capProgress - dt * 0.055 * Math.min(redN, 3));
    if (this.capProgress >= 1) this.capOwner = 'blue';
    else if (this.capProgress <= -1) this.capOwner = 'red';
    else if (this.capOwner === 'blue' && this.capProgress <= 0) this.capOwner = null;
    else if (this.capOwner === 'red' && this.capProgress >= 0) this.capOwner = null;

    if (this.capOwner !== prevOwner) {
      this.world.setZoneColor(this.capOwner ? TEAM_COLOR[this.capOwner] : 0xcccccc);
      if (this.capOwner) {
        this.hud.showCenter(`${this.capOwner === 'blue' ? 'ALLIES' : 'AXIS'} CAPTURED THE POINT`, 2.5);
        this.audio.sting('capture');
      }
    }

    if (this.capOwner === 'blue') this.tickets.red = Math.max(0, this.tickets.red - dt * 2.4);
    if (this.capOwner === 'red') this.tickets.blue = Math.max(0, this.tickets.blue - dt * 2.4);

    if (this.state !== 'end' && (this.tickets.blue <= 0 || this.tickets.red <= 0)) this.endGame(this.tickets.red <= 0 ? 'blue' : 'red');

    // out-of-bounds pressure on the player
    const p = this.player;
    if (p && p.alive && p.kind === 'plane') {
      const horiz = Math.hypot(p.pos.x, p.pos.z);
      this.outOfBounds = horiz > this.world.bound;
      if (this.outOfBounds) {
        this.oobTimer += dt;
        if (this.oobTimer > 8) p.takeDamage(20 * dt, null);
      } else this.oobTimer = 0;
    } else this.outOfBounds = false;
  }

  endGame(winner) {
    if (this.state === 'end') return;
    const wasDeployed = this.state === 'playing' || this.state === 'dead';
    this.state = 'end';
    this.audio.stopEngine();
    this.input.releaseLock();
    const playerWon = winner === 'blue';
    this.progress.recordMatchResult(playerWon);

    // If the player was still deployed, bank their sortie with the victory bonus.
    const summary = wasDeployed && this.progress.match ? this.progress.finishLife(playerWon) : null;

    this.hangar.showResults(summary, {
      title: playerWon ? 'VICTORY' : 'DEFEAT',
      subtitle: playerWon ? 'Axis forces are in full retreat.' : 'Allied lines have collapsed.',
      button: 'Play Again',
      victory: playerWon,
      onClose: () => { this.restartMatch(); this.openMenu(); },
    });
  }

  // ------------------------------------------------------------- camera

  updateCamera(dt, snap = false) {
    const p = this.player;
    const lerp = snap ? 1 : 1 - Math.exp(-6 * dt);
    // default un-scoped each frame; the scope branch below re-asserts it
    this.scoped = false;
    if (p && p.group) p.group.visible = true;
    if (p && p.alive && this.state === 'playing') {
      if (p.kind === 'plane') {
        _v1.set(0, 4.5, 17).applyQuaternion(p.group.quaternion).add(p.pos);
        // keep chase cam above terrain
        const th = this.world.getHeight(_v1.x, _v1.z);
        if (_v1.y < th + 2) _v1.y = th + 2;
        this.camPos.lerp(_v1, snap ? 1 : 1 - Math.exp(-5 * dt));
        this.camera.position.copy(this.camPos);
        p.forward(_v2).multiplyScalar(60).add(p.pos);
        _v3.set(0, 1, 0).applyQuaternion(p.group.quaternion).lerp(UP, 0.4).normalize();
        this.camera.up.copy(_v3);
        this.camera.lookAt(_v2);
        this.setFov(this.baseFov);
      } else if (this.input.mouse[2]) {
        // sniper scope: camera sits at the gunsight, looking exactly along the aim
        this.scoped = true;
        p.group.visible = false;
        const sc = p.spec.scale ?? 1;
        const cp = Math.cos(this.camPitch);
        _v3.set(-Math.sin(this.camYaw) * cp, Math.sin(this.camPitch), -Math.cos(this.camYaw) * cp);
        _v2.copy(p.pos);
        _v2.y += 2.9 * sc;
        _v2.addScaledVector(_v3, 1.6);
        this.camPos.copy(_v2);
        this.camera.position.copy(_v2);
        this.camera.up.copy(UP);
        _v1.copy(_v2).addScaledVector(_v3, 50);
        this.camera.lookAt(_v1);
        this.setFov(19);
      } else {
        const f = _v1.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
        _v2.copy(p.pos).addScaledVector(f, -15).add(_v3.set(0, 6.5 - this.camPitch * 6, 0));
        const th = this.world.getHeight(_v2.x, _v2.z);
        if (_v2.y < th + 1.5) _v2.y = th + 1.5;
        this.camPos.lerp(_v2, snap ? 1 : 1 - Math.exp(-10 * dt));
        this.camera.position.copy(this.camPos);
        _v2.copy(p.pos).addScaledVector(f, 40);
        _v2.y += 4 + this.camPitch * 42;
        this.camera.up.copy(UP);
        this.camera.lookAt(_v2);
        this.setFov(this.baseFov);
      }
    } else if (this.state === 'menu' && this.displayVehicle) {
      // hangar turntable: frame the selected vehicle rotating slowly
      const dv = this.displayVehicle;
      const plane = dv.kind === 'plane';
      _v1.set(plane ? 16 : 11, plane ? 5 : 5.5, plane ? 24 : 16).add(dv.pos);
      this.camPos.lerp(_v1, snap ? 1 : 1 - Math.exp(-4 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.up.copy(UP);
      _v2.copy(dv.pos); _v2.y += plane ? 1 : 2.4;
      this.camera.lookAt(_v2);
      this.setFov(this.baseFov);
    } else {
      // spectator orbit of the capture point
      const a = this.time * 0.06;
      _v1.set(Math.cos(a) * 620, 300, Math.sin(a) * 620).add(this.world.capturePoint);
      this.camPos.lerp(_v1, 1 - Math.exp(-2 * dt));
      this.camera.position.copy(this.camPos);
      this.camera.up.copy(UP);
      this.camera.lookAt(this.world.capturePoint);
      this.setFov(this.baseFov);
    }
  }

  setFov(target) {
    if (Math.abs(this.camera.fov - target) > 0.1) {
      this.camera.fov += (target - this.camera.fov) * 0.18;
      this.camera.updateProjectionMatrix();
    }
  }

  addShake(amount) {
    this.shakeT = Math.min(1, this.shakeT + amount);
  }

  applyShake(dt) {
    if (this.shakeT <= 0.01) { this.shakeT = 0; return; }
    const s = this.shakeT * (this.scoped ? 0.12 : 0.35);
    this.camera.position.x += (Math.random() - 0.5) * s;
    this.camera.position.y += (Math.random() - 0.5) * s;
    this.camera.position.z += (Math.random() - 0.5) * s;
    this.shakeT *= Math.exp(-7 * dt);
  }

  // ------------------------------------------------------------- frame

  frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.time += dt;

    this.updatePlayerControls(dt);
    for (const v of this.vehicles) {
      if (!v.alive) continue;
      if (v.ai) v.ai.update(dt);
      v.update(dt);
    }
    if (this.displayVehicle) this.displayVehicle.group.rotation.y += dt * (this._displaySpin || 0.4);
    this.projectiles.update(dt);
    this.effects.update(dt);
    this.sweepKills();
    this.updateBattle(dt);
    this.world.update(dt, (this.player && this.player.alive) ? this.player.pos : this.world.capturePoint);
    this.updateCamera(dt);
    this.applyShake(dt);
    this.audio.update(dt, this);
    this.hud.update(dt);
    this.renderer.render(this.scene, this.camera);
  }
}

const game = new Game();
window.game = game; // debugging & automation hook
