// Economy + tech-tree persistence. Single localStorage blob under 'tf_progress'.
//
// WT-style rules:
//   * Research points (RP) go toward ONE selected vehicle at a time (researching).
//     Overflow past the cost banks nothing. RP earned while nothing is selected
//     collects in a free `rp` pool that is poured into the next vehicle you pick.
//   * Unlocking makes a vehicle buyable; buying (lions) makes it deployable.
//   * Tier-1 vehicles + the historical defaults start unlocked & owned.
import { findSpec, STARTER_IDS } from './catalog.js';

const KEY = 'tf_progress';

// Earning rates.
const RP_PER_KILL = 120;
const LIONS_PER_KILL = 400;
const RP_CAPTURE = 80;
const RP_PER_MIN = 20;
const LIONS_PARTICIPATION = 150;   // flat, so a scoreless sortie still pays a little
const VICTORY_MULT = 1.5;

export class Progress {
  constructor() {
    this.load();
    this.match = null;   // per-life earnings tracker
  }

  load() {
    let data = {};
    try { data = JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { data = {}; }
    this.rp = data.rp ?? 0;
    this.lions = data.lions ?? 0;
    this.unlocked = new Set(data.unlocked ?? []);
    this.owned = new Set(data.owned ?? []);
    this.researching = data.researching ?? null;
    this.researchProgress = data.researchProgress ?? 0;
    this.stats = data.stats ?? { matches: 0, kills: 0, wins: 0 };
    for (const id of STARTER_IDS) { this.unlocked.add(id); this.owned.add(id); }
    if (this.researching && (!findSpec(this.researching) || this.isUnlocked(this.researching))) {
      this.researching = null; this.researchProgress = 0;
    }
  }

  save() {
    const data = {
      rp: this.rp, lions: this.lions,
      unlocked: [...this.unlocked], owned: [...this.owned],
      researching: this.researching, researchProgress: this.researchProgress,
      stats: this.stats,
    };
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore quota */ }
  }

  isUnlocked(id) { return this.unlocked.has(id); }
  isOwned(id) { return this.owned.has(id); }

  // A vehicle can be researched once its prereq is unlocked (or it has none).
  canResearch(id) {
    if (this.isUnlocked(id)) return false;
    const spec = findSpec(id);
    return !spec.prereq || this.isUnlocked(spec.prereq);
  }

  // status: 'owned' | 'unlocked' | 'researchable' | 'locked'
  status(id) {
    if (this.isOwned(id)) return 'owned';
    if (this.isUnlocked(id)) return 'unlocked';
    if (this.canResearch(id)) return 'researchable';
    return 'locked';
  }

  setResearching(id) {
    if (!this.canResearch(id)) return;
    this.researching = id;
    this.researchProgress = 0;
    if (this.rp > 0) { const bank = this.rp; this.rp = 0; this.gainRP(bank); }
    this.save();
  }

  gainRP(amount) {
    if (this.researching) {
      const spec = findSpec(this.researching);
      this.researchProgress += amount;
      if (this.researchProgress >= spec.rpCost) {
        this.unlocked.add(this.researching);
        this.researching = null;
        this.researchProgress = 0;   // overflow banks nothing
      }
    } else {
      this.rp += amount;
    }
  }

  buy(id) {
    if (!this.isUnlocked(id) || this.isOwned(id)) return false;
    const spec = findSpec(id);
    if (this.lions < spec.price) return false;
    this.lions -= spec.price;
    this.owned.add(id);
    this.save();
    return true;
  }

  // ---- per-life earning ---------------------------------------------------

  beginLife() { this.match = { kills: 0, timeAlive: 0, captured: false }; }
  addTime(dt) { if (this.match) this.match.timeAlive += dt; }
  recordKill() { if (this.match) this.match.kills++; }
  recordCapture() { if (this.match) this.match.captured = true; }

  // Bank a completed life's earnings and return a summary for the results screen.
  finishLife(victory) {
    const m = this.match || { kills: 0, timeAlive: 0, captured: false };
    const minutes = m.timeAlive / 60;
    let rp = m.kills * RP_PER_KILL + (m.captured ? RP_CAPTURE : 0) + minutes * RP_PER_MIN;
    let lions = m.kills * LIONS_PER_KILL + LIONS_PARTICIPATION;
    const mult = victory ? VICTORY_MULT : 1;
    rp = Math.round(rp * mult);
    lions = Math.round(lions * mult);

    const resId = this.researching;
    const spec = resId ? findSpec(resId) : null;
    const before = this.researchProgress;

    this.gainRP(rp);
    this.lions += lions;
    this.stats.kills += m.kills;

    const unlocked = !!spec && !this.researching;
    const summary = {
      kills: m.kills,
      timeAlive: m.timeAlive,
      captured: m.captured,
      rpEarned: rp,
      lionsEarned: lions,
      victory,
      research: spec ? {
        id: resId, name: spec.name, cost: spec.rpCost,
        before, after: unlocked ? spec.rpCost : this.researchProgress, unlocked,
      } : null,
    };
    this.match = null;
    this.save();
    return summary;
  }

  recordMatchResult(victory) {
    this.stats.matches++;
    if (victory) this.stats.wins++;
    this.save();
  }
}
