import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as skeletonClone } from 'three/addons/utils/SkeletonUtils.js';
import { NATION_TANK_COLOR, TEAM_COLOR } from './vehicles.js';

// catalog id -> bundled CC0 glTF (Quaternius). Archetype match:
//   tankB = Sherman-like medium · tankA = heavy w/ big rounded turret · tankC = low cruiser/TD
const TANK_MODELS = {
  // mediums -> tankB (Sherman-like)
  m3lee: 'tankB', sherman: 'tankB', cromwell: 'tankB', comet: 'tankB', pershing: 'tankB',
  centurion: 'tankB', t34: 'tankB', t3485: 'tankB', pz4: 'tankB', panther: 'tankB',
  // heavies / big rounded turret -> tankA
  kv1: 'tankA', is2: 'tankA', tiger: 'tankA', tiger2: 'tankA',
  // low cruisers / TDs / lights -> tankC
  hellcat: 'tankC', crusader: 'tankC', t26: 'tankC', pz2: 'tankC',
};
// Fallback by archetype for any id missing above.
const ARCHETYPE_MODEL = { heavy: 'tankA', medium: 'tankB', td: 'tankC', light: 'tankC' };
const TANK_FILES = { tankA: 'models/tankA.glb', tankB: 'models/tankB.glb', tankC: 'models/tankC.glb' };
// No CC0 plane models were sourced; planes stay primitive. Add files here to enable.
const PLANE_MODELS = {};

const _box = new THREE.Box3();
const _v = new THREE.Vector3();

export class ModelCache {
  constructor() {
    this.loader = new GLTFLoader();
    this.scenes = new Map();   // fileKey -> THREE.Object3D (template)
    this.waiters = new Map();  // fileKey -> [fns]
    this.failed = new Set();
  }

  // Kick off background downloads. Vehicles spawn with primitives immediately and
  // hot-swap when (if) their model arrives. If a download fails we simply never swap.
  preload() {
    for (const [key, url] of Object.entries(TANK_FILES)) this._load(key, url);
  }

  _load(key, url) {
    if (this.scenes.has(key) || this.failed.has(key)) return;
    this.waiters.set(key, this.waiters.get(key) ?? []);
    this.loader.load(
      url,
      (gltf) => {
        this.scenes.set(key, gltf.scene);
        const ws = this.waiters.get(key) ?? [];
        this.waiters.set(key, []);
        for (const fn of ws) { try { fn(gltf.scene); } catch (e) { console.warn('[models] graft failed', e); } }
      },
      undefined,
      (err) => { this.failed.add(key); console.warn('[models] load failed', url, err); }
    );
  }

  // Try to give a Tank its glTF visuals. Safe no-op if unavailable / on any error.
  applyTank(tank) {
    const key = TANK_MODELS[tank.spec.id] ?? ARCHETYPE_MODEL[tank.spec.archetype];
    if (!key) return;
    const doGraft = (scene) => { try { graftTank(tank, scene); } catch (e) { console.warn('[models] graftTank', e); } };
    const ready = this.scenes.get(key);
    if (ready) { doGraft(ready); return; }
    if (this.failed.has(key)) return;
    const ws = this.waiters.get(key) ?? [];
    ws.push((scene) => { if (tank.alive) doGraft(scene); });
    this.waiters.set(key, ws);
    this._load(key, TANK_FILES[key]);
  }

  applyPlane(_plane) { /* no CC0 plane models bundled — primitives are the model */ }
}

function tintMaterial(mat, spec, team) {
  const m = mat.clone();
  if (m.color) {
    const nat = new THREE.Color(NATION_TANK_COLOR[spec.nation] ?? 0x5c6b45);
    m.color.lerp(nat, 0.45).lerp(new THREE.Color(TEAM_COLOR[team]), 0.1);
  }
  m.metalness !== undefined && (m.metalness = Math.min(m.metalness ?? 0, 0.1));
  m.roughness !== undefined && (m.roughness = 0.85);
  return m;
}

function graftTank(tank, templateScene) {
  const spec = tank.spec;
  const root = skeletonClone(templateScene);
  let turretNode = null, gunNode = null;
  root.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      o.material = Array.isArray(o.material)
        ? o.material.map((m) => tintMaterial(m, spec, tank.team))
        : tintMaterial(o.material, spec, tank.team);
    }
    if (o.name === 'Tank_Turret') turretNode = o;
    else if (o.name === 'Tank_Gun') gunNode = o;
  });

  // Quaternius tanks face -X with gun forward; rotate so forward = -Z (game convention).
  root.rotation.y = -Math.PI / 2;
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  const size = _box.getSize(_v);
  const targetLen = 5.6 * (spec.scale ?? 1);
  const s = size.z > 0.01 ? targetLen / size.z : 1;
  root.scale.setScalar(s);
  root.updateMatrixWorld(true);
  _box.setFromObject(root);
  root.position.y -= _box.min.y;        // sit hull bottom on the ground plane
  root.updateMatrixWorld(true);

  tank.group.add(root);
  tank._modelRoot = root;

  // Graft articulated nodes onto the gameplay turret/barrel groups. Compute pivots in a
  // canonical (aim=0) frame, then restore aim. Physics (muzzle/barrel quaternion) is untouched.
  if (turretNode && gunNode) {
    const aim = tank.turret.rotation.y, pit = tank.barrel.rotation.x;
    tank.turret.rotation.y = 0; tank.barrel.rotation.x = 0;
    tank.group.updateMatrixWorld(true);

    _box.setFromObject(turretNode);
    const tc = _box.getCenter(new THREE.Vector3());
    tank.turret.parent.updateMatrixWorld(true);
    tank.turret.parent.worldToLocal(tc);   // turret lives under the (scaled) mesh group
    tank.turret.position.copy(tc);
    tank.turret.updateMatrixWorld(true);
    tank.turret.attach(turretNode);

    _box.setFromObject(gunNode);
    const glen = _box.getSize(new THREE.Vector3());
    const gc = _box.getCenter(new THREE.Vector3());
    tank.turret.worldToLocal(gc);
    tank.barrel.position.copy(gc);
    tank.barrel.updateMatrixWorld(true);
    tank.barrel.attach(gunNode);

    tank.muzzle.position.set(0, 0, -Math.max(glen.x, glen.z) / 2 - 0.25);

    tank.turret.rotation.y = aim; tank.barrel.rotation.x = pit;
  }

  // Hide the primitive stand-in visuals; keep the groups + muzzle for logic/physics.
  for (const mesh of tank._prim ?? []) mesh.visible = false;
}
