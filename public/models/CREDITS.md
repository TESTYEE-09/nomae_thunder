# 3D Model Credits

All bundled 3D models are **CC0 1.0 (Public Domain)** — no attribution required,
but credited here as good practice.

| File | Source model | Author | License | Source URL |
|------|--------------|--------|---------|------------|
| `tankB.glb` | "Tank" (Sherman-style medium) | Quaternius | CC0 1.0 | https://poly.pizza/m/cW3zvvkMOM |
| `tankA.glb` | "Tank" (heavy, rounded turret) | Quaternius | CC0 1.0 | https://poly.pizza/m/FA5daiyZQq |
| `tankC.glb` | "Tank" (low-profile cruiser/TD) | Quaternius | CC0 1.0 | https://poly.pizza/m/jWS1CLA0RO |

Downloaded as GLB from Poly Pizza's static CDN (`https://static.poly.pizza/<uuid>.glb`).
Quaternius releases all assets under CC0 (https://quaternius.com/ , https://poly.pizza/u/Quaternius).

## Node convention used by the game
Each Quaternius tank exposes separate mesh nodes `Tank_Turret` and `Tank_Gun`
(the hull `Tank_body` + `TrackMesh.*` are skinned). The loader grafts the turret
node under the gameplay turret group (yaw) and the gun node under the barrel group
(elevation), keeping a code-defined `muzzle` Object3D for shell spawns.

## Aircraft
No suitably-licensed (CC0) low-poly WW2 aircraft glTF could be sourced — the
available Poly Pizza / OpenGameArt propeller-plane models are CC-BY, which the
task scope excluded. Aircraft therefore use the (enhanced) built-in primitive
airframes, which the engine keeps as a permanent fallback for every vehicle.
Drop a CC0 `.glb` into this folder and map it in `src/models.js` (`PLANE_MODELS`)
to hot-swap planes too.
