// Hangar menu: nation tabs, tech-tree vehicle list, stat card + deploy/research,
// top-bar balances, settings panel and the post-match results screen.
// All DOM lives here; economy/state lives on game.progress.
import { playerLines, statBars, findSpec } from './catalog.js';

const NATION_FLAG = { USA: '🇺🇸', UK: '🇬🇧', USSR: '☭' };
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const mmss = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class Hangar {
  constructor(game) {
    this.game = game;
    this.progress = game.progress;
    this.lines = playerLines();
    this.nation = 'USA';
    this.selected = findSpec('p51');

    this.$ = (id) => document.getElementById(id);
    this.buildNationTabs();
    this.bindTop();
    this.bindSettings();
    this.bindResults();

    this.renderList();
    this.renderCard();
    this.refreshBalances();
    this.game.setDisplayVehicle(this.selected);
  }

  // ---- top bar ------------------------------------------------------------
  bindTop() {
    this.$('modearcade').addEventListener('click', () => { this.game.setMode(false); this.game.audio.ui('switch'); });
    this.$('moderealistic').addEventListener('click', () => { this.game.setMode(true); this.game.audio.ui('switch'); });
    this.$('gearbtn').addEventListener('click', () => { this.openSettings(); this.game.audio.ui('click'); });
    this.$('tobattle').addEventListener('click', () => {
      if (this.progress.status(this.selected.id) === 'owned') {
        this.game.audio.ui('click');
        this.game.spawnPlayer(this.selected);
      } else this.game.audio.ui('hover');
    });
  }

  refreshBattleBtn() {
    const owned = this.progress.status(this.selected.id) === 'owned';
    this.$('tobattle').classList.toggle('disabled', !owned);
  }

  refreshBalances() {
    this.$('rpbal').textContent = fmt(this.progress.rp);
    this.$('lionbal').textContent = fmt(this.progress.lions);
  }

  // ---- nation tabs --------------------------------------------------------
  buildNationTabs() {
    const wrap = this.$('nationtabs');
    wrap.innerHTML = '';
    for (const nation of ['USA', 'UK', 'USSR']) {
      const b = document.createElement('button');
      b.className = 'nationtab' + (nation === this.nation ? ' active' : '');
      b.innerHTML = `<span class="nflag">${NATION_FLAG[nation]}</span>${nation}`;
      b.addEventListener('click', () => {
        this.nation = nation;
        for (const el of wrap.children) el.classList.remove('active');
        b.classList.add('active');
        this.renderList();
        this.game.audio.ui('hover');
      });
      wrap.appendChild(b);
    }
  }

  // ---- vehicle carousel (WT-style bottom strip) ----------------------------
  renderList() {
    const strip = this.$('vehstrip');
    strip.innerHTML = '';
    const data = this.lines[this.nation];
    for (const spec of data.air) strip.appendChild(this.vehCard(spec, '✈'));
    const div = document.createElement('div');
    div.className = 'strip-div';
    strip.appendChild(div);
    for (const spec of data.ground) strip.appendChild(this.vehCard(spec, '🛡'));
    this.refreshBattleBtn();
  }

  vehCard(spec, kindIcon) {
    const ROMAN = { 1: 'I', 2: 'II', 3: 'III', 4: 'IV' };
    const status = this.progress.status(spec.id);
    const card = document.createElement('button');
    card.className = `vcardw ${status}` + (spec.id === this.selected.id ? ' sel' : '');
    let tag = '';
    if (status === 'owned') tag = '<span class="vtag owned">OWNED</span>';
    else if (status === 'unlocked') tag = `<span class="vtag price">🦁 ${fmt(spec.price)}</span>`;
    else if (status === 'researchable') tag = `<span class="vtag rp">◆ ${fmt(spec.rpCost)}</span>`;
    else tag = '<span class="vtag locked">🔒</span>';
    card.innerHTML =
      `<div class="vcrow1"><span class="vckind">${kindIcon} ${spec.flag}</span>` +
      `<span class="tierbadge t${spec.tier}">${ROMAN[spec.tier]}</span></div>` +
      `<div class="vcname">${spec.name}</div>` +
      `<div class="vcstatus">${tag}</div>`;
    card.addEventListener('click', () => { this.selectVehicle(spec); this.game.audio.ui('click'); });
    return card;
  }

  selectVehicle(spec) {
    this.selected = spec;
    this.renderList();
    this.renderCard();
    this.game.setDisplayVehicle(spec);
  }

  // ---- stat card ----------------------------------------------------------
  renderCard() {
    const spec = this.selected;
    const status = this.progress.status(spec.id);
    const card = this.$('statcard');
    const bars = statBars(spec).map((b) =>
      `<div class="statrow"><span class="statlbl">${b.label}</span>` +
      `<span class="statbar"><span class="statfill" style="width:${b.v}%"></span></span></div>`
    ).join('');

    let action = '';
    if (status === 'owned') {
      action = '<button class="bigbtn deploy" id="deploybtn">DEPLOY</button>';
    } else if (status === 'unlocked') {
      const afford = this.progress.lions >= spec.price;
      action = `<button class="bigbtn buy${afford ? '' : ' disabled'}" id="buybtn">PURCHASE · 🦁 ${fmt(spec.price)}</button>`;
    } else if (status === 'researchable') {
      const active = this.progress.researching === spec.id;
      action = active
        ? `<button class="bigbtn researching" id="resbtn" disabled>RESEARCHING… ${fmt(this.progress.researchProgress)}/${fmt(spec.rpCost)}</button>`
        : `<button class="bigbtn research" id="resbtn">RESEARCH · ◆ ${fmt(spec.rpCost)}</button>`;
    } else {
      const pre = spec.prereq ? findSpec(spec.prereq).name : '';
      action = `<button class="bigbtn locked" disabled>🔒 UNLOCK ${pre.toUpperCase()} FIRST</button>`;
    }

    card.innerHTML =
      `<div class="cardhead"><span class="cardflag">${spec.flag}</span>` +
      `<div><div class="cardname">${spec.name}</div>` +
      `<div class="cardmeta"><span class="tierbadge t${spec.tier}">${spec.tier}</span> ${spec.nation} · ${spec.archetype.toUpperCase()}</div></div></div>` +
      `<div class="carddesc">${spec.desc}</div>` +
      `<div class="stats">${bars}</div>` +
      `<div class="cardaction">${action}</div>`;

    const dep = this.$('deploybtn');
    if (dep) dep.addEventListener('click', () => this.game.spawnPlayer(spec));
    const buy = this.$('buybtn');
    if (buy) buy.addEventListener('click', () => {
      if (this.progress.buy(spec.id)) { this.game.audio.ui('switch'); this.refreshBalances(); this.selectVehicle(spec); }
      else this.game.audio.ui('hover');
    });
    const res = this.$('resbtn');
    if (res && !res.disabled) res.addEventListener('click', () => {
      this.progress.setResearching(spec.id);
      this.game.audio.ui('switch');
      this.refreshBalances();
      this.renderCard(); this.renderList();
    });
    this.refreshBattleBtn();
  }

  // ---- open / close -------------------------------------------------------
  open() {
    this.$('menu').classList.remove('hidden');
    this.$('deathinfo').classList.add('hidden');
    this.refreshBalances();
    this.renderList();
    this.renderCard();
    this.game.setDisplayVehicle(this.selected);
  }

  close() { this.$('menu').classList.add('hidden'); }

  // ---- settings -----------------------------------------------------------
  bindSettings() {
    const s = this.game.settings;
    const vol = this.$('setvol'), sens = this.$('setsens'), inv = this.$('setinvert'), sh = this.$('setshadows');
    vol.value = s.volume; sens.value = s.sens; inv.checked = s.invertY; sh.checked = s.shadows;
    this.$('setvolval').textContent = Math.round(s.volume * 100) + '%';
    this.$('setsensval').textContent = s.sens.toFixed(2) + '×';
    vol.addEventListener('input', () => { this.game.setSetting('volume', +vol.value); this.$('setvolval').textContent = Math.round(vol.value * 100) + '%'; });
    sens.addEventListener('input', () => { this.game.setSetting('sens', +sens.value); this.$('setsensval').textContent = (+sens.value).toFixed(2) + '×'; });
    inv.addEventListener('change', () => this.game.setSetting('invertY', inv.checked));
    sh.addEventListener('change', () => this.game.setSetting('shadows', sh.checked));
    this.$('settingsclose').addEventListener('click', () => { this.closeSettings(); this.game.audio.ui('click'); });
  }

  openSettings() { this.$('settings').classList.remove('hidden'); }
  closeSettings() { this.$('settings').classList.add('hidden'); }

  // ---- results screen -----------------------------------------------------
  bindResults() {
    this._resultsCb = null;
    this.$('resultsbtn').addEventListener('click', () => {
      this.$('results').classList.add('hidden');
      this.game.audio.ui('click');
      const cb = this._resultsCb; this._resultsCb = null;
      if (cb) cb();
    });
  }

  // summary from progress.finishLife(); opts = { title, subtitle, button, victory, onClose }
  showResults(summary, opts) {
    this._resultsCb = opts.onClose || null;
    const win = opts.victory;
    this.$('resultstitle').textContent = opts.title;
    this.$('resultstitle').style.color = win == null ? '#ffd257' : win ? '#ffd257' : '#ff7a6f';
    this.$('resultssub').textContent = opts.subtitle || '';
    this.$('resultsbtn').textContent = opts.button || 'CONTINUE';

    const rows = [];
    if (summary) {
      rows.push(['Kills', summary.kills]);
      rows.push(['Time alive', mmss(summary.timeAlive)]);
      if (summary.captured) rows.push(['Objective', 'Captured']);
      rows.push(['Research points', '◆ ' + fmt(summary.rpEarned)]);
      rows.push(['Lions', '🦁 ' + fmt(summary.lionsEarned)]);
    }
    this.$('resultsstats').innerHTML = rows.map(([k, v]) =>
      `<div class="resrow"><span>${k}</span><span class="resval">${v}</span></div>`).join('');

    // research progress bar (animated)
    const rp = summary && summary.research;
    const bar = this.$('resultsresearch');
    if (rp) {
      bar.classList.remove('hidden');
      this.$('resresname').textContent = rp.unlocked ? `${rp.name} — UNLOCKED!` : `Researching ${rp.name}`;
      const startPct = Math.min(100, rp.before / rp.cost * 100);
      const endPct = Math.min(100, rp.after / rp.cost * 100);
      const fill = this.$('resresfill');
      fill.style.transition = 'none';
      fill.style.width = startPct + '%';
      // force reflow then animate
      void fill.offsetWidth;
      fill.style.transition = 'width 1.1s ease-out';
      fill.style.width = endPct + '%';
    } else {
      bar.classList.add('hidden');
    }

    this.refreshBalances();
    this.close();
    this.$('results').classList.remove('hidden');
    if (win != null) this.game.audio.sting(win ? 'victory' : 'defeat');
  }
}
