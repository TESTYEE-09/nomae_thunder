export class HUD {
  constructor(game) {
    this.game = game;
    const $ = (id) => document.getElementById(id);
    this.el = {
      tblue: $('tblue'), tred: $('tred'), capfill: $('capfill'), capstatus: $('capstatus'),
      spd: $('spd'), alt: $('alt'), altrow: $('altrow'), ammo: $('ammo'), ammolbl: $('ammolbl'),
      hpfill: $('hpfill'), reloadfill: $('reloadfill'), stickdot: $('stickdot'),
      killfeed: $('killfeed'), centermsg: $('centermsg'), warnmsg: $('warnmsg'),
      hints: $('hints'), crosshair: $('crosshair'), hud: $('hud'), scope: $('scope'),
    };
    this.map = $('minimap').getContext('2d');
    this.centerTimer = 0;
    this.damageFlash = 0;
    this.hitTimer = 0;
  }

  setHints(kind) {
    this.el.hints.innerHTML = kind === 'plane'
      ? '<b>Mouse</b> steer &nbsp;<b>A/D</b> roll &nbsp;<b>W/S</b> throttle<br><b>LMB/Space</b> guns &nbsp;<b>B</b> bomb'
      : '<b>WASD</b> drive &nbsp;<b>Mouse</b> aim turret<br><b>LMB</b> cannon &nbsp;<b>Space</b> MG &nbsp;<b>RMB</b> scope';
    this.el.altrow.style.display = kind === 'plane' ? 'flex' : 'none';
    this.el.ammolbl.textContent = kind === 'plane' ? 'Bombs' : 'Shell';
    this.el.stickdot.classList.toggle('hidden', kind !== 'plane');
  }

  showCenter(msg, seconds = 2.5) {
    this.el.centermsg.textContent = msg;
    this.el.centermsg.classList.remove('hidden');
    this.centerTimer = seconds;
  }

  addKill(killerName, killerTeam, victimName, victimTeam, weapon) {
    const div = document.createElement('div');
    div.innerHTML = `<span class="${killerTeam}">${killerName}</span> ${weapon} <span class="${victimTeam}">${victimName}</span>`;
    this.el.killfeed.prepend(div);
    while (this.el.killfeed.children.length > 6) this.el.killfeed.lastChild.remove();
    setTimeout(() => div.remove(), 7000);
  }

  flashDamage() { this.damageFlash = 0.25; }
  hitMarker() {
    this.hitTimer = 0.18;
    this.el.crosshair.style.opacity = '1';
    this.el.crosshair.style.filter = 'drop-shadow(0 0 4px #ff5040)';
  }

  update(dt) {
    const g = this.game;
    this.el.tblue.textContent = Math.max(0, Math.ceil(g.tickets.blue));
    this.el.tred.textContent = Math.max(0, Math.ceil(g.tickets.red));

    // capture bar: -1 (red) .. +1 (blue)
    const cp = g.capProgress;
    this.el.capfill.style.width = `${50 + cp * 50}%`;
    this.el.capfill.style.background = cp > 0.05 ? '#6fb3ff' : cp < -0.05 ? '#ff7a6f' : '#888';
    this.el.capstatus.textContent =
      g.capOwner ? `POINT: ${g.capOwner === 'blue' ? 'ALLIES' : 'AXIS'}` : 'POINT: NEUTRAL';
    this.el.capstatus.style.color = g.capOwner === 'blue' ? '#8cc3ff' : g.capOwner === 'red' ? '#ff9a8f' : '#e8eef2';

    const p = g.player;
    if (p && p.alive) {
      const kmh = Math.round((p.kind === 'plane' ? p.speed : Math.abs(p.speed)) * 3.6);
      this.el.spd.textContent = `${kmh} km/h`;
      if (p.kind === 'plane') {
        this.el.alt.textContent = `${Math.round(p.altitude())} m`;
        this.el.ammo.textContent = p.bombs;
        this.el.reloadfill.style.width = '100%';
        // stick dot
        const s = g.stick;
        this.el.stickdot.style.left = `${50 + s.x * 14}%`;
        this.el.stickdot.style.top = `${50 + s.y * 14}%`;
      } else {
        this.el.ammo.textContent = p.reload <= 0 ? 'READY' : `${p.reload.toFixed(1)}s`;
        this.el.reloadfill.style.width = `${Math.max(0, Math.min(1, 1 - p.reload / p.reloadTotal)) * 100}%`;
      }
      this.el.hpfill.style.width = `${Math.max(0, p.hp / p.maxHp) * 100}%`;
      this.el.hpfill.style.background = p.hp > p.maxHp * 0.5 ? '#6fd96f' : p.hp > p.maxHp * 0.25 ? '#ffd257' : '#ff6f5f';
    }

    if (this.centerTimer > 0) {
      this.centerTimer -= dt;
      if (this.centerTimer <= 0) this.el.centermsg.classList.add('hidden');
    }
    if (this.hitTimer > 0) {
      this.hitTimer -= dt;
      if (this.hitTimer <= 0) this.el.crosshair.style.filter = '';
    }
    if (this.damageFlash > 0) {
      this.damageFlash -= dt;
      document.body.style.boxShadow = this.damageFlash > 0 ? 'inset 0 0 120px rgba(255,40,20,.5)' : '';
    }

    this.el.warnmsg.classList.toggle('hidden', !g.outOfBounds);
    this.el.scope.classList.toggle('hidden', !g.scoped);
    this.el.crosshair.style.visibility = g.scoped ? 'hidden' : '';

    this.drawMinimap();
  }

  drawMinimap() {
    const g = this.game, ctx = this.map, S = 190;
    const scale = (S / 2 - 6) / g.world.bound;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = 'rgba(20,32,20,.75)';
    ctx.fillRect(0, 0, S, S);

    const toMap = (x, z) => [S / 2 + x * scale, S / 2 + z * scale];

    // capture zone
    const [cx, cy] = toMap(g.world.capturePoint.x, g.world.capturePoint.z);
    ctx.beginPath();
    ctx.arc(cx, cy, g.world.captureRadius * scale, 0, Math.PI * 2);
    ctx.strokeStyle = g.capOwner === 'blue' ? '#6fb3ff' : g.capOwner === 'red' ? '#ff7a6f' : '#aaa';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const blues = g.realistic ? g.vehicles.filter(u => u.alive && u.team === 'blue') : null;
    for (const v of g.vehicles) {
      if (!v.alive || v.isPlayer) continue;
      // realistic: enemies appear only when spotted by a friendly within 600m
      if (g.realistic && v.team === 'red' && !blues.some(u => u.pos.distanceTo(v.pos) < 600)) continue;
      const [x, y] = toMap(v.pos.x, v.pos.z);
      ctx.fillStyle = v.team === 'blue' ? '#6fb3ff' : '#ff7a6f';
      if (v.kind === 'plane') {
        ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
      } else {
        ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
      }
    }

    const p = g.player;
    if (p && p.alive) {
      const [x, y] = toMap(p.pos.x, p.pos.z);
      let heading;
      if (p.kind === 'tank') heading = p.yaw;
      else {
        const f = p.forward(_tmpv);
        heading = Math.atan2(-f.x, -f.z);
      }
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(-heading);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.moveTo(0, -5); ctx.lineTo(-3.5, 4); ctx.lineTo(3.5, 4);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    }
  }
}

import * as THREE from 'three';
const _tmpv = new THREE.Vector3();
