# Thunder Front 1943

A browser WW2 combined-arms arcade battler in the spirit of War Thunder. Fly fighters and attackers, drive tanks, capture the central point, bleed the enemy's tickets, and research your way up 39 vehicles across USA, UK, USSR, Germany, and Japan tech trees. Built with Three.js — no backend, progress persists in your browser.

## Play

```sh
npm install
npm run dev        # http://localhost:8452
```

## Ship

```sh
npm run build      # static site in dist/ — host it anywhere
npm run preview    # serve the production build locally
```

## Controls

| | |
|---|---|
| **Plane** | Mouse steer · A/D roll · W/S throttle · LMB/Space guns · B bomb (rearm with a low pass over your airfield) |
| **Tank** | WASD drive · mouse aims the turret · LMB cannon · Space coax MG · hold RMB sniper scope |
| **Modes** | Arcade (aim assist, forgiving flight) · Realistic (no enemy markers, minimap spotting, manual shell drop, deadlier guns) |

Earn Research Points and Lions each sortie (kills, captures, time alive, victory bonus), research one vehicle at a time in the hangar, then buy and deploy it.

## Credits

All third-party assets are CC0/public domain — see `public/sfx/CREDITS.md` (Kenney UI audio, Still North Media weapon recordings) and `public/models/CREDITS.md` (Quaternius tank models via Poly Pizza). Everything else is procedurally generated.
