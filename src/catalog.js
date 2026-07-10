// Vehicle roster + tech-tree metadata. Allies (blue): USA / UK / USSR. Axis (red): Germany / Japan.
// Every spec carries progression fields:
//   tier      1-4    (1 = free starter, 4 = top of the line)
//   rpCost    research points needed to unlock  (tier 1 = 0, free)
//   price     lions needed to purchase          (tier 1 = 0, free)
//   prereq    id of the previous vehicle in this line, or null
//   archetype 'fighter'|'attacker'|'medium'|'heavy'|'td'|'light'  (drives model + stat card)
// Plane stats: maxSpeed/minSpeed m/s, agi = turn multiplier, gunDmg per bullet,
//   gunCd seconds between bursts, bombs carried.
// Tank stats: speed m/s, hp, shellDmg, reload s, shellV m/s muzzle velocity,
//   turretRate rad/s, scale = visual/collision size, barrelLen.
// EXISTING ids (p51, sherman, ...) are unchanged so saved games / model maps keep working.

const RP_BY_TIER = { 1: 0, 2: 1500, 3: 4500, 4: 12000 };
const PRICE_BY_TIER = { 1: 0, 2: 3000, 3: 9000, 4: 25000 };

export const PLANES = [
  // ---- USA (blue) : P-40 -> P-51 -> P-47 -> P-51D-30 ------------------------
  { id: 'p40', kind: 'plane', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'P-40 Warhawk',
    tier: 1, prereq: null, archetype: 'fighter',
    maxSpeed: 148, minSpeed: 40, agi: 0.95, hp: 80, gunDmg: 8, gunCd: 0.10, bombs: 1,
    desc: 'Sturdy early fighter · 1 bomb' },
  { id: 'p51', kind: 'plane', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'P-51 Mustang',
    tier: 2, prereq: 'p40', archetype: 'fighter',
    maxSpeed: 175, minSpeed: 40, agi: 1.0, hp: 100, gunDmg: 10, gunCd: 0.09, bombs: 2,
    desc: 'Fast energy fighter · 2 bombs' },
  { id: 'p47', kind: 'plane', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'P-47 Thunderbolt',
    tier: 3, prereq: 'p51', archetype: 'fighter',
    maxSpeed: 168, minSpeed: 44, agi: 0.85, hp: 135, gunDmg: 12, gunCd: 0.08, bombs: 4,
    desc: 'Rugged · heavy guns · 4 bombs' },
  { id: 'p51d30', kind: 'plane', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'P-51D-30',
    tier: 4, prereq: 'p47', archetype: 'fighter',
    maxSpeed: 188, minSpeed: 42, agi: 1.05, hp: 120, gunDmg: 14, gunCd: 0.08, bombs: 2,
    desc: 'Refined Mustang · deadly · fast' },

  // ---- UK (blue) : Hurricane -> Spitfire IX -> Typhoon -> Spitfire XIV -----
  { id: 'hurricane', kind: 'plane', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Hurricane',
    tier: 1, prereq: null, archetype: 'fighter',
    maxSpeed: 140, minSpeed: 34, agi: 1.15, hp: 82, gunDmg: 8, gunCd: 0.09, bombs: 0,
    desc: 'Steady turner · no bombs' },
  { id: 'spitfire', kind: 'plane', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Spitfire Mk IX',
    tier: 2, prereq: 'hurricane', archetype: 'fighter',
    maxSpeed: 162, minSpeed: 36, agi: 1.28, hp: 90, gunDmg: 11, gunCd: 0.10, bombs: 0,
    desc: 'Superb turner · no bombs' },
  { id: 'typhoon', kind: 'plane', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Typhoon',
    tier: 3, prereq: 'spitfire', archetype: 'fighter',
    maxSpeed: 176, minSpeed: 46, agi: 0.90, hp: 125, gunDmg: 15, gunCd: 0.10, bombs: 2,
    desc: 'Heavy hitter · ground pounder' },
  { id: 'spitfire14', kind: 'plane', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Spitfire Mk XIV',
    tier: 4, prereq: 'typhoon', archetype: 'fighter',
    maxSpeed: 190, minSpeed: 38, agi: 1.32, hp: 110, gunDmg: 14, gunCd: 0.10, bombs: 0,
    desc: 'Griffon-powered · peerless climb' },

  // ---- USSR (blue) : I-16 -> Yak-3 -> La-7 -> Yak-9U  (+ Il-2 attacker) ----
  { id: 'i16', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'I-16',
    tier: 1, prereq: null, archetype: 'fighter',
    maxSpeed: 138, minSpeed: 33, agi: 1.25, hp: 68, gunDmg: 8, gunCd: 0.11, bombs: 0,
    desc: 'Nimble barrel · fragile' },
  { id: 'yak3', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'Yak-3',
    tier: 2, prereq: 'i16', archetype: 'fighter',
    maxSpeed: 158, minSpeed: 35, agi: 1.2, hp: 85, gunDmg: 12, gunCd: 0.11, bombs: 0,
    desc: 'Light dogfighter · no bombs' },
  { id: 'il2', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'Il-2 Sturmovik',
    tier: 2, prereq: 'i16', archetype: 'attacker',
    maxSpeed: 125, minSpeed: 38, agi: 0.68, hp: 175, gunDmg: 14, gunCd: 0.14, bombs: 6,
    desc: 'Flying tank · 6 bombs' },
  { id: 'la7', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'La-7',
    tier: 3, prereq: 'yak3', archetype: 'fighter',
    maxSpeed: 178, minSpeed: 37, agi: 1.22, hp: 105, gunDmg: 13, gunCd: 0.10, bombs: 0,
    desc: 'Punchy low-alt brawler' },
  { id: 'yak9u', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'Yak-9U',
    tier: 4, prereq: 'la7', archetype: 'fighter',
    maxSpeed: 185, minSpeed: 36, agi: 1.28, hp: 115, gunDmg: 14, gunCd: 0.10, bombs: 0,
    desc: 'Refined Yak · fast & agile' },

  // ---- Germany (red, bots) : Bf109E -> Bf109G-6 -> Fw190A-5 -> Ta152 (+Ju87)
  { id: 'bf109e', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Bf 109 E',
    tier: 1, prereq: null, archetype: 'fighter',
    maxSpeed: 150, minSpeed: 38, agi: 1.05, hp: 78, gunDmg: 9, gunCd: 0.11, bombs: 0,
    desc: 'Early Emil · energy fighter' },
  { id: 'bf109', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Bf 109 G-6',
    tier: 2, prereq: 'bf109e', archetype: 'fighter',
    maxSpeed: 168, minSpeed: 38, agi: 1.1, hp: 95, gunDmg: 11, gunCd: 0.10, bombs: 0,
    desc: 'Balanced hunter · no bombs' },
  { id: 'fw190', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Fw 190 A-5',
    tier: 3, prereq: 'bf109', archetype: 'fighter',
    maxSpeed: 172, minSpeed: 44, agi: 0.9, hp: 115, gunDmg: 14, gunCd: 0.11, bombs: 2,
    desc: 'Heavy punch · 2 bombs' },
  { id: 'ta152', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Ta 152',
    tier: 4, prereq: 'fw190', archetype: 'fighter',
    maxSpeed: 192, minSpeed: 40, agi: 1.0, hp: 130, gunDmg: 15, gunCd: 0.09, bombs: 0,
    desc: 'High-alt monster · rare' },
  { id: 'ju87', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Ju 87 D Stuka',
    tier: 2, prereq: 'bf109e', archetype: 'attacker',
    maxSpeed: 118, minSpeed: 36, agi: 0.65, hp: 130, gunDmg: 8, gunCd: 0.12, bombs: 6,
    desc: 'Dive bomber · 6 bombs' },

  // ---- Japan (red, bots) : Ki-43 -> A6M3 Zero -> Ki-84 --------------------
  { id: 'ki43', kind: 'plane', team: 'red', nation: 'Japan', flag: '🇯🇵', name: 'Ki-43 Hayabusa',
    tier: 1, prereq: null, archetype: 'fighter',
    maxSpeed: 142, minSpeed: 30, agi: 1.4, hp: 66, gunDmg: 7, gunCd: 0.11, bombs: 0,
    desc: 'Feather-light turner' },
  { id: 'a6m', kind: 'plane', team: 'red', nation: 'Japan', flag: '🇯🇵', name: 'A6M3 Zero',
    tier: 2, prereq: 'ki43', archetype: 'fighter',
    maxSpeed: 145, minSpeed: 32, agi: 1.42, hp: 70, gunDmg: 10, gunCd: 0.10, bombs: 0,
    desc: 'Unmatched agility · fragile' },
  { id: 'ki84', kind: 'plane', team: 'red', nation: 'Japan', flag: '🇯🇵', name: 'Ki-84 Hayate',
    tier: 3, prereq: 'a6m', archetype: 'fighter',
    maxSpeed: 176, minSpeed: 34, agi: 1.3, hp: 100, gunDmg: 13, gunCd: 0.10, bombs: 0,
    desc: 'Fast & agile late fighter' },

  // ---- expansion: twin-engine heavies and branch fighters -------------------
  { id: 'p38', kind: 'plane', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'P-38 Lightning',
    tier: 2, prereq: 'p40', archetype: 'fighter', twin: true,
    maxSpeed: 172, minSpeed: 46, agi: 0.9, hp: 125, gunDmg: 12, gunCd: 0.09, bombs: 2,
    desc: 'Twin-boom heavy fighter' },
  { id: 'corsair', kind: 'plane', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'F4U Corsair',
    tier: 3, prereq: 'p38', archetype: 'fighter',
    maxSpeed: 180, minSpeed: 44, agi: 1.0, hp: 115, gunDmg: 13, gunCd: 0.09, bombs: 2,
    desc: 'Bent-wing brawler' },
  { id: 'beaufighter', kind: 'plane', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Beaufighter',
    tier: 2, prereq: 'hurricane', archetype: 'attacker', twin: true,
    maxSpeed: 145, minSpeed: 42, agi: 0.75, hp: 150, gunDmg: 13, gunCd: 0.11, bombs: 4,
    desc: 'Twin-engine gunship · 4 bombs' },
  { id: 'mig3', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'MiG-3',
    tier: 2, prereq: 'i16', archetype: 'fighter',
    maxSpeed: 160, minSpeed: 38, agi: 1.05, hp: 90, gunDmg: 10, gunCd: 0.10, bombs: 0,
    desc: 'High-altitude interceptor' },
  { id: 'pe2', kind: 'plane', team: 'blue', nation: 'USSR', flag: '☭', name: 'Pe-2',
    tier: 3, prereq: 'il2', archetype: 'attacker', twin: true,
    maxSpeed: 150, minSpeed: 42, agi: 0.72, hp: 160, gunDmg: 12, gunCd: 0.12, bombs: 6,
    desc: 'Fast dive bomber · 6 bombs' },
  { id: 'bf110', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Bf 110 G-2',
    tier: 2, prereq: 'bf109e', archetype: 'attacker', twin: true,
    maxSpeed: 150, minSpeed: 42, agi: 0.72, hp: 140, gunDmg: 14, gunCd: 0.11, bombs: 2,
    desc: 'Twin-engine destroyer' },
  { id: 'me410', kind: 'plane', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Me 410',
    tier: 3, prereq: 'bf110', archetype: 'attacker', twin: true,
    maxSpeed: 165, minSpeed: 46, agi: 0.75, hp: 155, gunDmg: 16, gunCd: 0.11, bombs: 4,
    desc: 'Heavy Zerstörer · big guns' },
  { id: 'n1k2', kind: 'plane', team: 'red', nation: 'Japan', flag: '🇯🇵', name: 'N1K2-J Shiden-Kai',
    tier: 4, prereq: 'ki84', archetype: 'fighter',
    maxSpeed: 182, minSpeed: 34, agi: 1.35, hp: 110, gunDmg: 14, gunCd: 0.09, bombs: 0,
    desc: 'Elite late-war fighter' },
];

export const TANKS = [
  // ---- USA (blue) : M3 Lee -> M4A1 Sherman -> M18 Hellcat -> M26 Pershing --
  { id: 'm3lee', kind: 'tank', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'M3 Lee',
    tier: 1, prereq: null, archetype: 'medium',
    speed: 12, hp: 220, shellDmg: 100, reload: 3.4, shellV: 200, turretRate: 1.6, scale: 1.0, barrelLen: 3.4,
    desc: 'Tall early medium' },
  { id: 'sherman', kind: 'tank', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'M4A1 Sherman',
    tier: 2, prereq: 'm3lee', archetype: 'medium',
    speed: 13, hp: 290, shellDmg: 135, reload: 3.2, shellV: 230, turretRate: 1.9, scale: 1.0, barrelLen: 4.0,
    desc: 'Reliable medium' },
  { id: 'hellcat', kind: 'tank', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'M18 Hellcat',
    tier: 3, prereq: 'sherman', archetype: 'td',
    speed: 20, hp: 200, shellDmg: 145, reload: 3.0, shellV: 300, turretRate: 2.2, scale: 0.92, barrelLen: 4.6,
    desc: 'Fast TD · thin armor' },
  { id: 'pershing', kind: 'tank', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'M26 Pershing',
    tier: 4, prereq: 'hellcat', archetype: 'heavy',
    speed: 15, hp: 380, shellDmg: 175, reload: 3.6, shellV: 300, turretRate: 1.8, scale: 1.08, barrelLen: 5.0,
    desc: 'Heavy · potent 90mm' },

  // ---- UK (blue) : Crusader -> Cromwell V -> Comet -> Centurion Mk 1 -------
  { id: 'crusader', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Crusader',
    tier: 1, prereq: null, archetype: 'light',
    speed: 18, hp: 200, shellDmg: 90, reload: 2.9, shellV: 210, turretRate: 1.9, scale: 0.95, barrelLen: 3.2,
    desc: 'Speedy cruiser · light gun' },
  { id: 'cromwell', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Cromwell V',
    tier: 2, prereq: 'crusader', archetype: 'medium',
    speed: 17, hp: 260, shellDmg: 120, reload: 2.8, shellV: 250, turretRate: 2.0, scale: 0.98, barrelLen: 3.8,
    desc: 'Quick cruiser · fast reload' },
  { id: 'comet', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Comet',
    tier: 3, prereq: 'cromwell', archetype: 'medium',
    speed: 18, hp: 290, shellDmg: 150, reload: 2.9, shellV: 300, turretRate: 2.0, scale: 1.0, barrelLen: 4.4,
    desc: 'Fast, deadly 77mm' },
  { id: 'centurion', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Centurion Mk 1',
    tier: 4, prereq: 'comet', archetype: 'heavy',
    speed: 16, hp: 400, shellDmg: 180, reload: 3.4, shellV: 330, turretRate: 1.9, scale: 1.1, barrelLen: 5.2,
    desc: 'Universal tank · superb gun' },

  // ---- USSR (blue) : T-26 -> T-34 1942 -> T-34-85 -> IS-2  (+ KV-1) --------
  { id: 't26', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'T-26',
    tier: 1, prereq: null, archetype: 'light',
    speed: 11, hp: 190, shellDmg: 85, reload: 3.2, shellV: 190, turretRate: 1.6, scale: 0.92, barrelLen: 3.0,
    desc: 'Slow infantry tank' },
  { id: 't34', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'T-34 (1942)',
    tier: 2, prereq: 't26', archetype: 'medium',
    speed: 15, hp: 300, shellDmg: 140, reload: 3.4, shellV: 240, turretRate: 1.7, scale: 1.0, barrelLen: 4.1,
    desc: 'Sloped armor workhorse' },
  { id: 't3485', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'T-34-85',
    tier: 3, prereq: 't34', archetype: 'medium',
    speed: 16, hp: 320, shellDmg: 160, reload: 3.4, shellV: 300, turretRate: 1.7, scale: 1.0, barrelLen: 4.6,
    desc: 'Up-gunned 85mm workhorse' },
  { id: 'kv1', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'KV-1',
    tier: 3, prereq: 't34', archetype: 'heavy',
    speed: 9, hp: 420, shellDmg: 150, reload: 4.4, shellV: 200, turretRate: 1.3, scale: 1.12, barrelLen: 4.0,
    desc: 'Heavy breakthrough · slow' },
  { id: 'is2', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'IS-2',
    tier: 4, prereq: 't3485', archetype: 'heavy',
    speed: 12, hp: 430, shellDmg: 220, reload: 5.2, shellV: 280, turretRate: 1.2, scale: 1.12, barrelLen: 5.0,
    desc: 'Devastating 122mm · slow load' },

  // ---- Germany (red, bots) : Pz II -> Pz IV G -> Panther/Tiger -> Tiger II -
  { id: 'pz2', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Panzer II',
    tier: 1, prereq: null, archetype: 'light',
    speed: 14, hp: 170, shellDmg: 60, reload: 2.4, shellV: 180, turretRate: 2.0, scale: 0.9, barrelLen: 2.6,
    desc: 'Light autocannon scout' },
  { id: 'pz4', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Panzer IV G',
    tier: 2, prereq: 'pz2', archetype: 'medium',
    speed: 13, hp: 280, shellDmg: 140, reload: 3.2, shellV: 240, turretRate: 1.8, scale: 1.0, barrelLen: 4.3,
    desc: 'Versatile medium' },
  { id: 'panther', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Panther D',
    tier: 3, prereq: 'pz4', archetype: 'medium',
    speed: 14, hp: 340, shellDmg: 170, reload: 3.8, shellV: 320, turretRate: 1.4, scale: 1.08, barrelLen: 5.2,
    desc: 'Deadly long 75 · slow turret' },
  { id: 'tiger', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Tiger H1',
    tier: 3, prereq: 'pz4', archetype: 'heavy',
    speed: 10, hp: 400, shellDmg: 180, reload: 4.6, shellV: 260, turretRate: 1.2, scale: 1.15, barrelLen: 5.0,
    desc: 'Feared heavy · 88mm' },
  { id: 'tiger2', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Tiger II',
    tier: 4, prereq: 'tiger', archetype: 'heavy',
    speed: 11, hp: 460, shellDmg: 210, reload: 5.0, shellV: 340, turretRate: 1.3, scale: 1.18, barrelLen: 5.6,
    desc: 'King Tiger · thick & lethal' },

  // ---- expansion: TD branches, lights, heavies, Japan ground ----------------
  { id: 'chaffee', kind: 'tank', team: 'blue', nation: 'USA', flag: '🇺🇸', name: 'M24 Chaffee',
    tier: 2, prereq: 'm3lee', archetype: 'light',
    speed: 19, hp: 210, shellDmg: 110, reload: 2.7, shellV: 240, turretRate: 2.3, scale: 0.9, barrelLen: 3.6,
    desc: 'Nimble light scout' },
  { id: 'archer', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Archer',
    tier: 2, prereq: 'crusader', archetype: 'td',
    speed: 10, hp: 220, shellDmg: 150, reload: 3.6, shellV: 320, turretRate: 1.0, scale: 0.95, barrelLen: 4.8,
    desc: '17-pdr tank destroyer' },
  { id: 'firefly', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Sherman Firefly',
    tier: 3, prereq: 'cromwell', archetype: 'medium',
    speed: 13, hp: 290, shellDmg: 175, reload: 3.6, shellV: 330, turretRate: 1.7, scale: 1.0, barrelLen: 5.0,
    desc: 'Sherman + 17-pdr punch' },
  { id: 'churchill', kind: 'tank', team: 'blue', nation: 'UK', flag: '🇬🇧', name: 'Churchill VII',
    tier: 3, prereq: 'cromwell', archetype: 'heavy',
    speed: 8, hp: 430, shellDmg: 130, reload: 3.2, shellV: 240, turretRate: 1.4, scale: 1.1, barrelLen: 4.0,
    desc: 'Fortress on tracks · slow' },
  { id: 'su85', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'SU-85',
    tier: 3, prereq: 't34', archetype: 'td',
    speed: 14, hp: 280, shellDmg: 165, reload: 3.6, shellV: 300, turretRate: 1.1, scale: 1.0, barrelLen: 4.6,
    desc: 'Casemate hunter' },
  { id: 'su100', kind: 'tank', team: 'blue', nation: 'USSR', flag: '☭', name: 'SU-100',
    tier: 4, prereq: 'su85', archetype: 'td',
    speed: 14, hp: 300, shellDmg: 200, reload: 4.0, shellV: 330, turretRate: 1.1, scale: 1.02, barrelLen: 5.2,
    desc: 'Lethal 100mm casemate' },
  { id: 'stug', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'StuG III G',
    tier: 2, prereq: 'pz2', archetype: 'td',
    speed: 12, hp: 260, shellDmg: 135, reload: 3.0, shellV: 260, turretRate: 1.0, scale: 0.92, barrelLen: 4.2,
    desc: 'Low assault gun' },
  { id: 'jagdpanzer4', kind: 'tank', team: 'red', nation: 'Germany', flag: '🇩🇪', name: 'Jagdpanzer IV',
    tier: 3, prereq: 'stug', archetype: 'td',
    speed: 13, hp: 300, shellDmg: 170, reload: 3.4, shellV: 320, turretRate: 1.0, scale: 0.98, barrelLen: 4.8,
    desc: 'Sleek ambush TD' },
  { id: 'chiha', kind: 'tank', team: 'red', nation: 'Japan', flag: '🇯🇵', name: 'Chi-Ha',
    tier: 1, prereq: null, archetype: 'light',
    speed: 12, hp: 180, shellDmg: 75, reload: 3.0, shellV: 170, turretRate: 1.7, scale: 0.9, barrelLen: 2.8,
    desc: 'Light infantry tank' },
  { id: 'chinu', kind: 'tank', team: 'red', nation: 'Japan', flag: '🇯🇵', name: 'Chi-Nu',
    tier: 2, prereq: 'chiha', archetype: 'medium',
    speed: 13, hp: 240, shellDmg: 120, reload: 3.2, shellV: 230, turretRate: 1.6, scale: 0.95, barrelLen: 3.8,
    desc: 'Late-war medium' },
];

// Fill economy defaults from tier where not explicitly set.
for (const spec of [...PLANES, ...TANKS]) {
  if (spec.rpCost === undefined) spec.rpCost = RP_BY_TIER[spec.tier] ?? 0;
  if (spec.price === undefined) spec.price = PRICE_BY_TIER[spec.tier] ?? 0;
}

export const ALL_VEHICLES = [...PLANES, ...TANKS];

// Vehicles a fresh account starts with (owned + unlocked): every tier-1 plus the
// historical defaults so old model mappings / muscle memory keep working.
export const STARTER_IDS = [
  ...ALL_VEHICLES.filter((s) => s.tier === 1 && s.team === 'blue').map((s) => s.id),
  'p51', 'sherman',
];

// Bots draw weighted toward the middle of the tree (mostly tier 2-3).
const TIER_WEIGHT = { 1: 1, 2: 3, 3: 3, 4: 1.2 };

export function pickRandom(list, team, kind) {
  const pool = list.filter((s) => s.team === team && (!kind || s.kind === kind));
  if (!pool.length) return undefined;
  let total = 0;
  for (const s of pool) total += TIER_WEIGHT[s.tier] ?? 1;
  let r = Math.random() * total;
  for (const s of pool) {
    r -= TIER_WEIGHT[s.tier] ?? 1;
    if (r <= 0) return s;
  }
  return pool[pool.length - 1];
}

export function findSpec(id) {
  return ALL_VEHICLES.find((s) => s.id === id);
}

// Player-facing (blue) lines grouped by nation + branch (air/ground), each ordered
// from tier 1 up its prereq chain. Used to build the hangar list.
export function playerLines() {
  const nations = ['USA', 'UK', 'USSR'];
  const out = {};
  for (const nation of nations) {
    const air = orderByPrereq(PLANES.filter((s) => s.team === 'blue' && s.nation === nation));
    const ground = orderByPrereq(TANKS.filter((s) => s.team === 'blue' && s.nation === nation));
    out[nation] = { air, ground };
  }
  return out;
}

function orderByPrereq(specs) {
  // Stable order: tier asc, then keep prereq chains adjacent.
  return specs.slice().sort((a, b) => a.tier - b.tier || (a.prereq ? 1 : 0) - (b.prereq ? 1 : 0));
}

// Normalized 0-100 stat bars for the hangar stat card.
export function statBars(spec) {
  const clamp = (v) => Math.round(Math.max(4, Math.min(100, v)));
  if (spec.kind === 'plane') {
    const speed = (spec.maxSpeed - 110) / (195 - 110) * 100;
    const agility = (spec.agi - 0.6) / (1.45 - 0.6) * 100;
    const dps = spec.gunDmg / spec.gunCd;                 // sustained bullet dps
    const firepower = (dps - 60) / (170 - 60) * 100 + spec.bombs * 4;
    const toughness = (spec.hp - 60) / (180 - 60) * 100;
    return [
      { label: 'Speed', v: clamp(speed) },
      { label: 'Agility', v: clamp(agility) },
      { label: 'Firepower', v: clamp(firepower) },
      { label: 'Toughness', v: clamp(toughness) },
    ];
  }
  const speed = (spec.speed - 8) / (22 - 8) * 100;
  const turret = (spec.turretRate - 1.1) / (2.3 - 1.1) * 100;
  const firepower = (spec.shellDmg / spec.reload - 25) / (55 - 25) * 100;
  const toughness = (spec.hp - 160) / (470 - 160) * 100;
  return [
    { label: 'Mobility', v: clamp(speed) },
    { label: 'Turret', v: clamp(turret) },
    { label: 'Firepower', v: clamp(firepower) },
    { label: 'Toughness', v: clamp(toughness) },
  ];
}
