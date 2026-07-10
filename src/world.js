import * as THREE from 'three';

// Deterministic value noise so terrain geometry and collision queries agree.
function hash(ix, iz) {
  let n = (ix * 374761393 + iz * 668265263) | 0;
  n = Math.imul(n ^ (n >>> 13), 1274126177);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function valueNoise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const sx = fx * fx * (3 - 2 * fx), sz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return a + (b - a) * sx + (c - a) * sz + (a - b - c + d) * sx * sz;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export class World {
  constructor(scene) {
    this.scene = scene;
    this.size = 4000;          // terrain extent
    this.bound = 1900;         // playable radius, beyond this = return-to-battle
    this.capturePoint = new THREE.Vector3(0, 0, 0);
    this.captureRadius = 95;

    this.buildSky();
    this.buildLights();
    this.buildTerrain();
    this.buildWater();
    this.buildTrees();
    this.buildVillage();
    this.buildCaptureZone();
    this.buildClouds();

    this.capturePoint.y = this.getHeight(0, 0);
  }

  // Per-frame: animate water and keep the shadow frustum centered on the action.
  update(dt, focus) {
    this._t = (this._t ?? 0) + dt;
    if (this.waterMat && this.waterMat.normalMap) {
      this.waterMat.normalMap.offset.set(this._t * 0.015, this._t * 0.009);
    }
    if (this.sun && focus) {
      // move the directional light with its target so the tight shadow map covers the player
      this.sun.target.position.set(focus.x, this.getHeight(focus.x, focus.z), focus.z);
      this.sun.target.updateMatrixWorld();
      this.sun.position.set(focus.x - 300, this.getHeight(focus.x, focus.z) + 450, focus.z + 200);
    }
  }

  // Fractal noise height. A flat north-south corridor (small |x|) links the two
  // bases; mountains rise to the east/west and past the base lines.
  getHeight(x, z) {
    let n = 0, amp = 1, freq = 1 / 950, total = 0;
    for (let o = 0; o < 4; o++) {
      n += (valueNoise(x * freq + 57.3, z * freq + 91.7) - 0.5) * 2 * amp;
      total += amp;
      amp *= 0.5;
      freq *= 2.1;
    }
    n /= total;
    const rough = Math.max(
      smoothstep(350, 1100, Math.abs(x)),
      smoothstep(1650, 2000, Math.abs(z))
    );
    return 12 + n * (15 + 125 * rough);
  }

  getNormal(x, z, out) {
    const e = 2.5;
    const hl = this.getHeight(x - e, z), hr = this.getHeight(x + e, z);
    const hd = this.getHeight(x, z - e), hu = this.getHeight(x, z + e);
    out.set(hl - hr, 2 * e, hd - hu).normalize();
    return out;
  }

  buildLights() {
    const hemi = new THREE.HemisphereLight(0xbfd8ee, 0x4a5a3a, 0.85);
    this.scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xfff2dd, 1.35);
    sun.position.set(-300, 450, 200);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const cam = sun.shadow.camera;
    cam.near = 10; cam.far = 1100;
    cam.left = -150; cam.right = 150; cam.top = 150; cam.bottom = -150;
    sun.shadow.bias = -0.0006;
    sun.shadow.normalBias = 0.8;
    this.scene.add(sun);
    this.scene.add(sun.target);
    this.sun = sun;
  }

  buildSky() {
    const c = document.createElement('canvas');
    c.width = 16; c.height = 256;
    const ctx = c.getContext('2d');
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0.0, '#3f77b8');   // zenith
    g.addColorStop(0.45, '#7fb0da');
    g.addColorStop(0.72, '#bcd7e8');
    g.addColorStop(1.0, '#dfe8ea');   // horizon haze
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 16, 256);
    const tex = new THREE.CanvasTexture(c);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(6000, 24, 16),
      new THREE.MeshBasicMaterial({ map: tex, side: THREE.BackSide, fog: false, depthWrite: false })
    );
    this.scene.add(dome);

    // sun glow sprite roughly toward the directional light
    const sc = document.createElement('canvas');
    sc.width = sc.height = 128;
    const sx = sc.getContext('2d');
    const sg = sx.createRadialGradient(64, 64, 4, 64, 64, 64);
    sg.addColorStop(0, 'rgba(255,250,225,1)');
    sg.addColorStop(0.25, 'rgba(255,240,190,0.7)');
    sg.addColorStop(1, 'rgba(255,240,190,0)');
    sx.fillStyle = sg; sx.fillRect(0, 0, 128, 128);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
    glow.scale.set(900, 900, 1);
    glow.position.set(-1800, 2400, 1200);
    this.scene.add(glow);
  }

  buildTerrain() {
    const segs = 140;
    const geo = new THREE.PlaneGeometry(this.size, this.size, segs, segs);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const c = new THREE.Color();
    const grass = new THREE.Color(0x5d7a3a), dry = new THREE.Color(0x8a8a55);
    const rock = new THREE.Color(0x77736b), snow = new THREE.Color(0xdfe4e8);
    const sand = new THREE.Color(0x9a8f66);
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const h = this.getHeight(x, z);
      pos.setY(i, h);
      // color by height with a little noise-driven variation
      const v = valueNoise(x * 0.01, z * 0.01);
      if (h < 3) c.copy(sand);
      else if (h < 45) c.copy(grass).lerp(dry, Math.min(1, h / 55) * 0.6 + v * 0.35);
      else if (h < 95) c.copy(dry).lerp(rock, (h - 45) / 50);
      else c.copy(rock).lerp(snow, Math.min(1, (h - 95) / 45));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    const mat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.terrain = new THREE.Mesh(geo, mat);
    this.terrain.receiveShadow = true;
    this.scene.add(this.terrain);
  }

  buildWater() {
    const geo = new THREE.PlaneGeometry(this.size * 1.5, this.size * 1.5, 1, 1);
    geo.rotateX(-Math.PI / 2);
    const normal = makeWaterNormal();
    normal.wrapS = normal.wrapT = THREE.RepeatWrapping;
    normal.repeat.set(60, 60);
    const mat = new THREE.MeshPhongMaterial({
      color: 0x2f5f80, transparent: true, opacity: 0.88,
      shininess: 90, specular: 0x9fc4dd,
      normalMap: normal, normalScale: new THREE.Vector2(0.35, 0.35),
    });
    const water = new THREE.Mesh(geo, mat);
    water.position.y = 0;
    water.receiveShadow = true;
    this.waterMat = mat;
    this.scene.add(water);
  }

  buildTrees() {
    const count = 520;
    const trunkGeo = new THREE.CylinderGeometry(0.35, 0.55, 3.5, 5);
    const trunkMat = new THREE.MeshLambertMaterial({ color: 0x5a4630 });
    const canopyGeo = new THREE.ConeGeometry(2.6, 7, 6);
    const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3a5c2a });
    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, count);
    const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, count);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3();
    let placed = 0, tries = 0;
    while (placed < count && tries < count * 12) {
      tries++;
      const x = (hash(tries * 7, 3) - 0.5) * 2 * 1800;
      const z = (hash(tries * 13, 11) - 0.5) * 2 * 1800;
      const h = this.getHeight(x, z);
      if (h < 4 || h > 60) continue;
      if (x * x + z * z < 160 * 160) continue; // keep the point clear
      const sc = 0.8 + hash(tries, 29) * 1.1;
      s.setScalar(sc);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), hash(tries, 31) * 6.28);
      m.compose(new THREE.Vector3(x, h + 1.6 * sc, z), q, s);
      trunks.setMatrixAt(placed, m);
      m.compose(new THREE.Vector3(x, h + (3.5 + 3) * sc, z), q, s);
      canopies.setMatrixAt(placed, m);
      placed++;
    }
    trunks.count = placed; canopies.count = placed;
    trunks.castShadow = canopies.castShadow = true;
    trunks.receiveShadow = canopies.receiveShadow = true;
    this.scene.add(trunks, canopies);
  }

  buildVillage() {
    const wallMat = new THREE.MeshLambertMaterial({ color: 0xb8a888 });
    const roofMat = new THREE.MeshLambertMaterial({ color: 0x7a4a3a });
    for (let i = 0; i < 14; i++) {
      const ang = hash(i * 3, 5) * Math.PI * 2;
      const r = 130 + hash(i * 7, 9) * 220;
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      const h = this.getHeight(x, z);
      const w = 8 + hash(i, 17) * 8, d = 8 + hash(i, 19) * 10, ht = 5 + hash(i, 23) * 4;
      const house = new THREE.Mesh(new THREE.BoxGeometry(w, ht, d), wallMat);
      house.position.set(x, h + ht / 2, z);
      house.rotation.y = hash(i, 27) * Math.PI;
      const roof = new THREE.Mesh(new THREE.ConeGeometry(Math.max(w, d) * 0.72, 3.5, 4), roofMat);
      roof.position.y = ht / 2 + 1.75;
      roof.rotation.y = Math.PI / 4;
      house.castShadow = true; house.receiveShadow = true;
      roof.castShadow = true;
      house.add(roof);
      this.scene.add(house);
    }
  }

  buildCaptureZone() {
    const h = this.getHeight(0, 0);
    const ringGeo = new THREE.RingGeometry(this.captureRadius - 6, this.captureRadius, 48);
    ringGeo.rotateX(-Math.PI / 2);
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xcccccc, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false });
    const ring = new THREE.Mesh(ringGeo, this.ringMat);
    ring.position.set(0, h + 1.5, 0);
    this.scene.add(ring);

    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 26, 6), new THREE.MeshLambertMaterial({ color: 0x999999 }));
    pole.position.set(0, h + 13, 0);
    this.scene.add(pole);
    this.flagMat = new THREE.MeshLambertMaterial({ color: 0xbbbbbb, side: THREE.DoubleSide });
    const flag = new THREE.Mesh(new THREE.PlaneGeometry(9, 5), this.flagMat);
    flag.position.set(4.6, h + 23, 0);
    this.scene.add(flag);
  }

  setZoneColor(hex) {
    this.ringMat.color.setHex(hex);
    this.flagMat.color.setHex(hex);
  }

  buildClouds() {
    const tex = makeCloudTexture();
    for (let i = 0; i < 26; i++) {
      const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, opacity: 0.5 + hash(i, 41) * 0.25, depthWrite: false });
      const sp = new THREE.Sprite(mat);
      const sc = 260 + hash(i, 43) * 320;
      sp.scale.set(sc, sc * 0.38, 1);
      sp.position.set(
        (hash(i, 47) - 0.5) * 2 * 2400,
        420 + hash(i, 53) * 520,
        (hash(i, 59) - 0.5) * 2 * 2400
      );
      this.scene.add(sp);
    }
  }
}

function makeWaterNormal() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(128, 128);
  // cheap smooth value-noise bumps encoded as a tangent-space normal map
  const h = (x, y) => {
    const s = Math.sin(x * 0.19) + Math.sin(y * 0.23) + Math.sin((x + y) * 0.13) + Math.sin((x - y) * 0.17);
    return s * 0.25;
  };
  for (let y = 0; y < 128; y++) {
    for (let x = 0; x < 128; x++) {
      const dx = h(x + 1, y) - h(x - 1, y);
      const dy = h(x, y + 1) - h(x, y - 1);
      const nx = -dx, ny = -dy, nz = 1;
      const l = Math.hypot(nx, ny, nz);
      const i = (y * 128 + x) * 4;
      img.data[i] = (nx / l * 0.5 + 0.5) * 255;
      img.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
      img.data[i + 2] = (nz / l * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return new THREE.CanvasTexture(c);
}

function makeCloudTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 62);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.5)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  return tex;
}
