"use strict";

(() => {
  const SAVE_KEY = "gangho-bloodwind-v1";
  const LEGACY_KEY = "gangho-bloodwind-legacy";
  const MARKS = new Set(["검흔", "타격", "출혈", "중독", "빙결", "뇌전", "둔화"]);
  const DOT = { 출혈: 7, 중독: 6, 혈독: 10, 뇌전: 4 };
  const world = { w: 2400, h: 1680 };
  const inn = { rect: true, x: 640, y: 0, w: 1120, h: 360 };
  const zoom = 2.55;
  const pillars = [
    { x: 480, y: 560, r: 34 },
    { x: 1920, y: 560, r: 34 },
    { x: 480, y: 1180, r: 34 },
    { x: 1920, y: 1180, r: 34 },
  ];
  const obstacles = [inn, ...pillars];
  const puddles = Array.from({ length: 16 }, (_, i) => ({
    x: 260 + ((i * 347) % 1900),
    y: 430 + ((i * 211) % 1100),
    rx: 36 + (i % 5) * 16,
    ry: 12 + (i % 3) * 6,
  }));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const minimap = document.getElementById("minimap");
  const mctx = minimap.getContext("2d");

  let mode = "title";
  let run = null;
  let player = null;
  let combat = null;
  let selectedId = null;
  let uid = 1;
  let eid = 1;
  let floorCanvas = null;
  let pixelRatio = 1;
  let viewW = 1280;
  let viewH = 800;
  let lastDt = 0.016;
  let stopUsed = false;
  let fatalOn = false;
  let soundOn = localStorage.getItem("gangho-sound") !== "0";
  let changeArmed = false;
  let shopBook = "field";
  const cam = { x: 0, y: 0 };
  const input = { keys: {}, mouseDown: false, cx: 0, cy: 0, wx: 0, wy: 0, hasMouse: false };
  const slotEls = {};
  const rain = Array.from({ length: 130 }, () => ({
    x: Math.random(),
    y: Math.random(),
    len: 14 + Math.random() * 18,
    v: 0.55 + Math.random() * 0.7,
  }));

  const sfx = {
    ctx: null,
    ensure() {
      if (!soundOn) return null;
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return null;
        this.ctx = new AC();
      }
      if (this.ctx.state === "suspended") this.ctx.resume();
      return this.ctx;
    },
    tone(freq, dur, type, gain, slide) {
      if (!soundOn) return;
      try {
        const actx = this.ensure();
        if (!actx) return;
        const t = actx.currentTime;
        const o = actx.createOscillator();
        const g = actx.createGain();
        o.type = type || "sine";
        o.frequency.setValueAtTime(freq, t);
        if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq * slide), t + dur);
        g.gain.setValueAtTime(gain, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + dur);
        o.connect(g).connect(actx.destination);
        o.start(t);
        o.stop(t + dur + 0.02);
      } catch (err) { /* 소리 장치는 전투를 막지 않는다 */ }
    },
    noise(dur, gain) {
      if (!soundOn) return;
      try {
        const actx = this.ensure();
        if (!actx) return;
        const n = Math.max(1, Math.floor(actx.sampleRate * dur));
        const buf = actx.createBuffer(1, n, actx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
        const src = actx.createBufferSource();
        const filter = actx.createBiquadFilter();
        const g = actx.createGain();
        src.buffer = buf;
        filter.type = "highpass";
        filter.frequency.value = 900;
        g.gain.value = gain;
        src.connect(filter).connect(g).connect(actx.destination);
        src.start();
      } catch (err) { /* ignore */ }
    },
  };

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function angDiff(a, b) {
    let d = a - b;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    return Math.abs(d);
  }
  function charById(id) { return GANGHO.characters.find((c) => c.id === id); }
  function currentChar() {
    const c = charById(run.charId);
    if (!c || !c.forms) return c;
    const form = c.forms.find((f) => f.id === run.form) || c.forms[0];
    return Object.assign({}, c, {
      title: form.title,
      color: form.color || c.color,
      basic: form.basic,
      skills: form.skills,
      formName: form.name,
      formSummary: form.summary,
      critBonus: form.critBonus || 0,
      dropBonus: form.dropBonus || 0,
      lifestealBonus: c.lifestealBonus || 0,
    });
  }
  function xpNeed(level) { return 24 + (level - 1) * 18; }
  function living() {
    return combat.enemies.filter((e) => !e.dead && !e.down && !e.ally && e.spawnT <= 0);
  }
  function hostile(e) {
    return !e.dead && !e.dummy && !e.pillar && !e.ally;
  }
  function weaponLook() {
    const name = (run.equip.weapon && run.equip.weapon.name) || "";
    if (name.includes("권") || name.includes("선장")) return "fist";
    if (name.includes("도") || name.includes("언월")) return "blade";
    return "sword";
  }

  function toast(text) {
    const root = document.getElementById("toast-root");
    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = text;
    root.appendChild(el);
    while (root.children.length > 4) root.firstChild.remove();
    setTimeout(() => el.remove(), 2400);
  }

  function showScreen(id) {
    document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
    document.getElementById(id).classList.add("active");
    mode = id.replace("screen-", "");
    document.body.classList.toggle("combat-mode", id === "screen-combat");
    window.scrollTo(0, 0);
  }

  function createItem(id) {
    const src = GANGHO.items[id];
    if (!src) return null;
    return Object.assign({ uid: uid++, id }, src);
  }
  function slim(it) {
    if (!it) return null;
    const raw = { id: it.id, uid: it.uid };
    if (it.inlay) raw.inlay = it.inlay;
    return raw;
  }
  function rehydrate(raw) {
    if (!raw || !GANGHO.items[raw.id]) return null;
    const item = Object.assign({ uid: raw.uid || uid++ }, GANGHO.items[raw.id], { id: raw.id });
    if (raw.inlay) item.inlay = raw.inlay;
    return item;
  }
  function maxUid(data) {
    let m = 1;
    const all = [data.equip && data.equip.weapon, data.equip && data.equip.armor, data.equip && data.equip.charm, data.equip && data.equip.jewel, ...(data.bag || []), ...(data.stash || [])];
    for (const it of all) if (it && it.uid > m) m = it.uid;
    return m + 1;
  }

  function freshRun(charId) {
    return {
      charId,
      level: 1,
      xp: 0,
      points: 1,
      nodes: {},
      materials: 0,
      clears: 0,
      bestTime: null,
      fragment: false,
      stars: {},
      raids: {},
      dragon: false,
      dragonReward: false,
      polaris: false,
      polarisReward: false,
      form: null,
      stock: {},
      frontier: {},
      unmasked: false,
      sanhae: false,
      gems: {},
      gemsBoss: {},
      ownedGems: [],
      stash: [],
      companion: false,
      equip: { weapon: createItem("mokgeom"), armor: null, charm: null, jewel: null },
      bag: [],
    };
  }

  function readLegacy() {
    try { return JSON.parse(localStorage.getItem(LEGACY_KEY)) || {}; } catch (err) { return {}; }
  }

  function markLegacy() {
    if (!run) return;
    const prev = readLegacy();
    const next = {
      polaris: !!(prev.polaris || run.polaris),
      sanhae: !!(prev.sanhae || run.sanhae),
    };
    try { localStorage.setItem(LEGACY_KEY, JSON.stringify(next)); } catch (err) { /* ignore */ }
  }

  function persist() {
    if (!run) return;
    const data = {
      charId: run.charId,
      level: run.level,
      xp: run.xp,
      points: run.points,
      nodes: run.nodes,
      materials: run.materials,
      clears: run.clears,
      bestTime: run.bestTime,
      fragment: run.fragment,
      stars: run.stars || {},
      raids: run.raids || {},
      dragon: !!run.dragon,
      dragonReward: !!run.dragonReward,
      polaris: !!run.polaris,
      polarisReward: !!run.polarisReward,
      form: run.form || null,
      stock: run.stock || {},
      frontier: run.frontier || {},
      unmasked: !!run.unmasked,
      sanhae: !!run.sanhae,
      gems: run.gems || {},
      gemsBoss: run.gemsBoss || {},
      ownedGems: run.ownedGems || [],
      companion: !!run.companion,
      stash: (run.stash || []).map(slim),
      equip: {
        weapon: slim(run.equip.weapon),
        armor: slim(run.equip.armor),
        charm: slim(run.equip.charm),
        jewel: slim(run.equip.jewel),
      },
      bag: run.bag.map(slim),
    };
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (err) { /* ignore */ }
    markLegacy();
  }

  function loadRun() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !charById(data.charId)) return null;
      data.nodes = data.nodes || {};
      data.bag = (data.bag || []).map(rehydrate).filter(Boolean);
      data.equip = data.equip || {};
      data.equip.weapon = rehydrate(data.equip.weapon) || createItem("mokgeom");
      data.equip.armor = rehydrate(data.equip.armor);
      data.equip.charm = rehydrate(data.equip.charm);
      data.equip.jewel = rehydrate(data.equip.jewel);
      data.level = data.level || 1;
      data.xp = data.xp || 0;
      data.points = data.points || 0;
      data.materials = data.materials || 0;
      data.clears = data.clears || 0;
      data.fragment = !!data.fragment;
      data.stars = data.stars || {};
      data.raids = data.raids || {};
      data.dragon = !!data.dragon;
      data.dragonReward = !!data.dragonReward;
      data.polaris = !!data.polaris;
      data.polarisReward = !!data.polarisReward;
      data.form = data.form || null;
      data.stock = data.stock || {};
      data.frontier = data.frontier || {};
      data.unmasked = !!data.unmasked;
      data.sanhae = !!data.sanhae;
      data.gems = data.gems || {};
      data.gemsBoss = data.gemsBoss || {};
      data.ownedGems = data.ownedGems || [];
      data.companion = !!data.companion;
      data.stash = (data.stash || []).map(rehydrate).filter(Boolean);
      uid = maxUid(data);
      return data;
    } catch (err) {
      return null;
    }
  }

  function applyFx(stats, fx) {
    if (!fx) return;
    if (fx.hp) stats.hp += fx.hp;
    if (fx.shield) stats.shield += fx.shield;
    if (fx.qi) stats.qi += fx.qi;
    if (fx.qiRegen) stats.qiRegen += fx.qiRegen;
    if (fx.dmg) stats.dmgAdd += fx.dmg;
    if (fx.aspd) stats.aspd += fx.aspd;
    if (fx.shieldMul) stats.shieldMul += fx.shieldMul;
    if (fx.qiCost) stats.qiCostMul += fx.qiCost;
    if (fx.armor) stats.armor += fx.armor;
    if (fx.move) stats.move *= 1 + fx.move;
    if (fx.potion) stats.potion += fx.potion;
    if (fx.projResist) stats.projResist += fx.projResist;
    if (fx.crit) stats.crit += fx.crit;
    if (fx.lifesteal) stats.lifesteal += fx.lifesteal;
    if (fx.shieldOnHit) stats.shieldOnHit += fx.shieldOnHit;
    if (fx.dashCd) stats.dashCd *= 1 + fx.dashCd;
    if (fx.potionsBonus) stats.potionsBonus += fx.potionsBonus;
    if (fx.guardProc) stats.guardProc = Math.max(stats.guardProc, fx.guardProc);
    if (fx.guardShield) stats.guardShield += fx.guardShield;
  }

  function computeStats() {
    const c = currentChar();
    const stats = {
      hp: 156 + (run.level - 1) * 10,
      shield: 42,
      qi: 100,
      qiRegen: 10,
      shieldRegen: 5,
      move: 236,
      dmgAdd: 0,
      aspd: 1,
      shieldMul: c.mechanic === "shred" ? 1.6 : 1,
      qiCostMul: 1,
      armor: 12,
      potion: 0.4,
      projResist: 0,
      crit: 0.06,
      lifesteal: 0,
      shieldOnHit: 0,
      dashCd: 0.88,
      potionsBonus: 0,
      guardProc: 0,
      guardShield: 0,
      power: c.power,
    };
    if (c.critBonus) stats.crit += c.critBonus;
    if (c.lifestealBonus) stats.lifesteal += c.lifestealBonus;
    for (const node of GANGHO.nodes) {
      if (run.nodes[node.id]) applyFx(stats, node.fx);
    }
    for (const slot of ["weapon", "armor", "charm", "jewel"]) {
      applyFx(stats, run.equip[slot]);
      if (run.equip[slot] && run.equip[slot].inlay === "han") applyFx(stats, { dmg: 0.05, qiCost: -0.08 });
    }
    stats.dmgMul = stats.power * (1 + stats.dmgAdd);
    if (run.nodes.juhwa) {
      stats.dmgMul *= 1.5;
      stats.taken = 1.3;
    } else stats.taken = 1;
    stats.qiCostMul = Math.max(0.55, stats.qiCostMul);
    stats.projResist = clamp(stats.projResist, 0, 0.6);
    stats.aspd = Math.max(0.6, stats.aspd);
    return stats;
  }

  function applyMaxStats(fill) {
    const stats = computeStats();
    const prevHp = player.hpMax || stats.hp;
    const prevSh = player.shieldMax || stats.shield;
    const prevQi = player.qiMax || stats.qi;
    player.stats = stats;
    player.hpMax = stats.hp;
    player.shieldMax = stats.shield;
    player.qiMax = stats.qi;
    if (fill) {
      player.hp = stats.hp;
      player.shield = stats.shield;
      player.qi = stats.qi;
    } else {
      player.hp = Math.min(stats.hp, player.hp + Math.max(0, stats.hp - prevHp));
      player.shield = Math.min(stats.shield * 1.85, player.shield + Math.max(0, stats.shield - prevSh));
      player.qi = Math.min(stats.qi, player.qi + Math.max(0, stats.qi - prevQi));
    }
  }

  function gainShield(n) {
    player.shield = Math.min(player.shieldMax * 1.85, player.shield + n);
  }

  function skillCost(sk) {
    return Math.max(0, Math.round(sk.qi * ((player.stats && player.stats.qiCostMul) || 1)));
  }

  function withTag(list, tag) {
    const arr = (list || []).map((s) => Object.assign({}, s));
    if (tag && MARKS.has(tag) && !arr.some((s) => s.id === tag)) arr.push({ id: tag, t: 5, stacks: 1 });
    return arr;
  }

  function collide(ent) {
    const r = ent.r || 16;
    if (ent.x < r || ent.y < r || ent.x > world.w - r || ent.y > world.h - r) return true;
    for (const o of obstacles) {
      if (o.rect) {
        const cx = clamp(ent.x, o.x, o.x + o.w);
        const cy = clamp(ent.y, o.y, o.y + o.h);
        const dx = ent.x - cx;
        const dy = ent.y - cy;
        if (dx * dx + dy * dy < r * r) return true;
      } else {
        const dx = ent.x - o.x;
        const dy = ent.y - o.y;
        const rr = r + o.r;
        if (dx * dx + dy * dy < rr * rr) return true;
      }
    }
    return false;
  }

  function moveCircle(ent, dx, dy) {
    ent.x += dx;
    if (collide(ent)) ent.x -= dx;
    ent.y += dy;
    if (collide(ent)) ent.y -= dy;
  }

  function unstuck(ent) {
    if (!collide(ent)) return;
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2;
      ent.x += Math.cos(a) * 6;
      ent.y += Math.sin(a) * 6;
      if (!collide(ent)) return;
    }
  }

  function fxText(x, y, text, color) {
    combat.floats.push({ x, y, text, color: color || "#f2e6d0", life: 0.7, max: 0.7 });
    if (combat.floats.length > 50) combat.floats.shift();
  }

  function burstParticles(x, y, color, n, speed) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random());
      combat.particles.push({
        x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
        life: 0.28 + Math.random() * 0.28, max: 0.5, color, size: 2 + Math.random() * 2.4,
      });
    }
    if (combat.particles.length > 260) combat.particles.splice(0, combat.particles.length - 220);
  }

  function addHitstop(t) {
    if (!t || reduceMotion || stopUsed) return;
    stopUsed = true;
    combat.hitstop = Math.max(combat.hitstop, t);
  }

  function shake(n) {
    if (reduceMotion || !combat) return;
    combat.shake = Math.min(16, (combat.shake || 0) + n);
  }

  function recordHit(amount, crit) {
    combat.total += amount;
    combat.hits += 1;
    if (crit) combat.crits += 1;
    combat.dmgEvents.push({ t: combat.elapsed, v: amount });
    if (combat.dmgEvents.length > 500) combat.dmgEvents.splice(0, combat.dmgEvents.length - 350);
  }

  function applyStatus(target, spec, opts) {
    if (!target || target.dead || !spec) return;
    opts = opts || {};
    const id = spec.id;
    const prev = target.statuses[id];
    const stacks = Math.min(5, ((prev && prev.stacks) || 0) + (spec.stacks || 1));
    target.statuses[id] = { t: spec.t || 4, stacks, dps: DOT[id] || 0 };
    if (!prev || stacks > prev.stacks) combat.statusApplies += 1;
    if (opts.noCombo) return;
    const st = target.statuses;
    if ((id === "검흔" || id === "타격") && st["검흔"] && st["타격"] && !st["내상"]) {
      st["내상"] = { t: 6, stacks: 1, dps: 0 };
      combat.statusApplies += 1;
      fxText(target.x, target.y - 36, "내상", "#ffd27a");
      dealDamage(target, 32, { player: true, noStatus: true, noMechanic: true, canCrit: false, hitstop: 0.02 });
    }
    if ((id === "출혈" || id === "중독") && st["출혈"] && st["중독"] && !st["혈독"]) {
      st["혈독"] = { t: 8, stacks: 1, dps: DOT["혈독"] };
      combat.statusApplies += 1;
      fxText(target.x, target.y - 46, "혈독", "#c6f59a");
    }
    if (id === "뇌전" && st["빙결"] && (target.superIc || 0) <= 0) {
      target.superIc = 0.85;
      fxText(target.x, target.y - 36, "초전도", "#d7efff");
      chainLightning(target, 4, 44);
    }
  }

  function chainLightning(from, n, dmg) {
    const hits = living()
      .filter((e) => e !== from && Math.hypot(e.x - from.x, e.y - from.y) < 190)
      .sort((a, b) => Math.hypot(a.x - from.x, a.y - from.y) - Math.hypot(b.x - from.x, b.y - from.y))
      .slice(0, n);
    let prev = from;
    for (const e of hits) {
      combat.bolts.push({ x1: prev.x, y1: prev.y, x2: e.x, y2: e.y, life: 0.16 });
      dealDamage(e, dmg, { player: true, noMechanic: true, canCrit: false, hitstop: 0 });
      applyStatus(e, { id: "뇌전", t: 2, stacks: 1 }, { noCombo: true });
      prev = e;
    }
  }

  function dealDamage(target, base, opts) {
    opts = opts || {};
    if (!target || target.dead || target.down || target.spawnT > 0) return 0;
    if (!base || base <= 0) return 0;
    let amount = base;
    if (opts.player) amount *= player.stats.dmgMul;
    if (opts.player && currentChar().mechanic === "rage" && player.hpMax) {
      amount *= 1 + (1 - player.hp / player.hpMax) * 0.85;
    }
    if (!opts.dot && !opts.noMechanic && opts.mods && opts.mods.burst) {
      amount *= 1.7;
      if (!opts.mods.announced) {
        opts.mods.announced = true;
        const label = currentChar().mechanic === "samjae" ? "삼재" : "만류귀종";
        fxText(player.x, player.y - 52, label, "#ffe08a");
      }
    }
    let manak = false;
    if (!opts.dot && !opts.noMechanic && currentChar().mechanic === "manak" && target.statuses["출혈"] && target.statuses["중독"]) {
      amount *= 1.75;
      manak = true;
      if (opts.mods && !opts.mods.manakText) {
        opts.mods.manakText = true;
        fxText(target.x, target.y - 30, "만악귀종", "#e4c6ff");
      }
    }
    if (target.groggy > 0) amount *= 1.5;
    if (opts.player && run.bukdu && target.hpMax && target.hp / target.hpMax <= 0.28) {
      amount *= 1.4;
      if (!target.executeText) {
        target.executeText = true;
        fxText(target.x, target.y - 36, "북두주사", "#d7c6ff");
      }
    }
    let crit = false;
    if (opts.player && opts.canCrit !== false && !opts.dot && Math.random() < player.stats.crit) {
      crit = true;
      amount *= 1.6;
    }
    if (combat && target.boss && combat.enemies.some((o) => o.pillar && !o.dead && !o.down)) {
      if (combat.gimmick === "pillars" || combat.gimmick === "balance") amount *= 0.34;
    }
    let armor = opts.armorPierce ? 0 : (target.armor || 0);
    if (target.statuses["내상"]) armor *= 0.7;
    if (armor > 0) amount *= 100 / (100 + armor);
    const packet = amount;

    if (!opts.noStatus && opts.statuses) {
      for (const st of opts.statuses) applyStatus(target, st);
      if (target.dead) return packet;
    }

    if (opts.player) recordHit(packet, crit);
    target.flash = 0.1;
    target.sinceHit = 0;

    if (!target.dummy) {
      let rest = packet;
      if (target.shield > 0) {
        const mul = opts.dot ? 1 : (opts.player ? player.stats.shieldMul : 1);
        const shieldHit = rest * mul;
        const absorbed = Math.min(target.shield, shieldHit);
        target.shield -= absorbed;
        rest = Math.max(0, rest - absorbed / mul);
        if (target.shield <= 0 && target.shieldMax > 0 && !target.shieldBroken) {
          target.shield = 0;
          target.shieldBroken = true;
          target.groggy = target.boss ? 2.7 : 2.15;
          fxText(target.x, target.y - 44, "호신강기 파쇄", "#9fd0ea");
          shake(6);
          addHitstop(0.08);
        }
      }
      if (rest > 0) target.hp -= rest;
    }

    if (opts.player && !opts.dot && packet >= 1) {
      const color = crit ? "#ffd56a" : manak ? "#e4c6ff" : "#f4ecdf";
      fxText(target.x + (Math.random() * 16 - 8), target.y - target.r - 8, String(Math.round(packet)), color);
      burstParticles(target.x, target.y, color, crit ? 7 : 3, 80);
      if (opts.hitstop) addHitstop(opts.hitstop);
      else if (!opts.bonus) addHitstop(0.028);
    } else if (opts.player && opts.dot && packet >= 2) {
      fxText(target.x, target.y - target.r, String(Math.round(packet)), "#d7c2c2");
    }

    if (opts.knock && !target.dummy) {
      const ang = Math.atan2(target.y - player.y, target.x - player.x);
      target.kx = (target.kx || 0) + Math.cos(ang) * opts.knock;
      target.ky = (target.ky || 0) + Math.sin(ang) * opts.knock;
    }

    if (opts.player && !opts.dot) {
      let heal = packet * (player.stats.lifesteal || 0);
      if (opts.lifesteal) heal += packet * opts.lifesteal;
      if (manak) heal += packet * 0.18;
      if (heal > 0) player.hp = Math.min(player.hpMax, player.hp + Math.min(46, heal));
      if (player.stats.shieldOnHit && opts.mods && !opts.mods.shielded) {
        opts.mods.shielded = true;
        gainShield(player.stats.shieldOnHit);
      }
    }

    if (opts.player && !opts.dot && !opts.noEcho && !opts.noMechanic && opts.mods && opts.mods.echo) {
      if (!opts.mods.echoAnnounced) {
        opts.mods.echoAnnounced = true;
        fxText(target.x, target.y - 58, "마기 공명", "#ff9d8a");
      }
      dealDamage(target, base * 0.4, {
        player: true, noEcho: true, noMechanic: true, noStatus: true, canCrit: false, hitstop: 0, mods: opts.mods,
      });
    }

    if (!target.dummy && target.hp <= 0) killEnemy(target, opts);
    return packet;
  }

  function becomeEgg(e) {
    e.eggPending = false;
    e.egg = true;
    e.bossHp = e.hpMax;
    e.eggName = e.name;
    e.eggColor = e.color;
    e.hpMax = Math.max(200, Math.round(e.bossHp * 0.2));
    e.hp = e.hpMax;
    e.shield = 0;
    e.shieldMax = 0;
    e.speed = 0;
    e.name = "불사의 알";
    e.color = "#e07a3d";
    e.r = 30;
    e.eggT = 8;
    fxText(e.x, e.y - 40, "열반", "#ffb080");
    showBanner("불사의 알", "부화하기 전에 껍질을 깨라.");
  }

  function hatchEgg(e) {
    e.egg = false;
    e.hpMax = e.bossHp || e.hpMax;
    e.hp = Math.round(e.hpMax * 0.55);
    e.shieldMax = Math.round((GANGHO.enemies.boss.shield || 400) * ((combat && combat.danger) || 1));
    e.shield = e.shieldMax;
    e.shieldBroken = false;
    e.speed = GANGHO.enemies.boss.speed;
    e.name = e.eggName || "주작";
    e.color = e.eggColor || "#e08a62";
    e.r = GANGHO.enemies.boss.r;
    combat.gimmickOk = false;
    showBanner("알이 부화했다", "불사를 끊지 못했다.");
  }

  function shredBosses(label) {
    for (const b of combat.enemies) {
      if (b.boss && !b.dead) {
        b.shield = 0;
        b.shieldBroken = true;
        b.groggy = Math.max(b.groggy, 2.4);
        fxText(b.x, b.y - 48, label, "#9fd0ea");
      }
    }
  }

  function onPillars() {
    if (!combat) return;
    const g = combat.gimmick;
    if (g === "balance") { onBalance(); return; }
    if (g === "regen") {
      if (combat.enemies.some((o) => o.pillar && !o.dead && !o.down)) return;
      combat.healBlock = true;
      combat.gimmickOk = true;
      showBanner("생이 끊겼다", "재생이 멈추고, 쓰러져도 변이하지 않는다.");
      return;
    }
    if (g === "fate") {
      if (combat.enemies.some((o) => o.pillar && !o.dead && !o.down)) return;
      combat.fateT = 0;
      combat.gimmickOk = true;
      shredBosses("각인 해제");
      showBanner("생사부가 닫혔다", "수명의 각인이 풀렸다.");
      return;
    }
    if (g !== "pillars") return;
    if (combat.enemies.some((o) => o.pillar && !o.dead && !o.down)) return;
    combat.gimmickOk = true;
    shredBosses("용린 파쇄");
    showBanner("기둥이 무너졌다", "비늘이 갈라지고 빈틈이 열렸다.");
  }

  function onBalance() {
    const pillars = combat.enemies.filter((o) => o.pillar);
    const standing = pillars.filter((o) => !o.down && !o.dead);
    if (standing.length === 0 && combat.balanceT > 0) {
      combat.balanceT = 0;
      combat.gimmickOk = true;
      shredBosses("음양 합일");
      showBanner("음양이 맞았다", "생과 사가 한 박자로 가라앉았다.");
      return;
    }
    if (standing.length === 1) {
      combat.balanceT = 4;
      showBanner("음양이 기운다", "남은 기둥을 이어서 부숴야 한다.");
    }
  }

  function beginFate(e) {
    if (!combat || combat.gimmick !== "fate" || combat.fateStarted) return;
    combat.fateStarted = true;
    combat.fateT = 14;
    const spots = [[900, 720], [1200, 880], [1500, 720]];
    for (let i = 0; i < spots.length; i++) {
      combat.enemies.push(makeEnemy("pillar", spots[i][0], spots[i][1], 0.15, {
        color: "#c9b6f2", name: "생사 기둥", optional: true,
      }));
    }
    showBanner("생사부 각인", "기둥이 무너지기 전에 수명이 다한다.");
  }

  function markDead(e, opts) {
    e.dead = true;
    e.corpse = 0;
    combat.kills += 1;
    gainXp(e.xp || 0);
    dropLoot(e);
    dropMaterials(e);
    burstParticles(e.x, e.y, "#6a2030", 14, 160);
    combat.decals.push({ x: e.x, y: e.y, r: e.r * 1.7, a: 0.45 });
    if (combat.decals.length > 40) combat.decals.shift();
    sfx.tone(90, 0.08, "triangle", 0.04, 0.4);
    if (e.statuses["혈독"]) {
      fxText(e.x, e.y - 10, "혈독 폭발", "#b6e38c");
      const depth = (opts && opts.explosion) || 0;
      if (depth < 2) {
        shake(4);
        for (const o of living()) {
          if (Math.hypot(o.x - e.x, o.y - e.y) < 112 + o.r) {
            dealDamage(o, 62, {
              player: true, noStatus: true, noMechanic: true, canCrit: false, hitstop: 0, explosion: depth + 1,
            });
          }
        }
      }
    }
  }

  function killEnemy(e, opts) {
    if (!e || e.dead || e.dummy) return;
    if (e.ally) {
      e.dead = true;
      e.corpse = 0;
      return;
    }
    if (e.eggPending && combat && combat.gimmick === "egg") {
      becomeEgg(e);
      return;
    }
    if (e.pillar && combat && combat.gimmick === "balance") {
      e.down = true;
      e.hp = 0;
      onBalance();
      return;
    }
    if (combat && combat.gimmick === "regen" && e.boss && !e.rebirthed && !combat.healBlock) {
      e.rebirthed = true;
      e.hpMax = Math.round(e.hpMax * 1.12);
      e.hp = Math.round(e.hpMax * 0.72);
      e.shield = e.shieldMax * 0.4;
      e.shieldBroken = false;
      e.dmg *= 1.25;
      e.color = "#f2c14e";
      if (!e.name.includes("변이")) e.name += " · 변이";
      combat.gimmickOk = false;
      fxText(e.x, e.y - 40, "생의 폭주", "#f0d28a");
      showBanner("생의 폭주", "기둥을 부수지 못하면 더 강한 몸으로 돌아온다.");
      return;
    }
    if (e.duo && combat && combat.gimmick === "duo") {
      const other = combat.enemies.find((o) => o.id === e.partner);
      if (other && !other.dead && other.reviving > 0) {
        other.reviving = 0;
        other.hp = 0;
        markDead(e, opts);
        markDead(other, opts);
        combat.gimmickOk = true;
        return;
      }
      if (other && !other.dead) {
        e.reviving = 8;
        e.hp = 1;
        e.shield = 0;
        fxText(e.x, e.y - 36, "되살아난다", "#9fd0ea");
        return;
      }
    }
    markDead(e, opts);
    if (e.pillar) onPillars();
    if (e.egg) {
      combat.gimmickOk = true;
      showBanner("껍질이 깨졌다", "불사의 고리가 끊겼다.");
    }
  }

  function gainXp(n) {
    if (!n || !combat || combat.mode === "training") return;
    run.xp += n;
    let up = false;
    while (run.xp >= xpNeed(run.level)) {
      run.xp -= xpNeed(run.level);
      run.level += 1;
      run.points += 1;
      up = true;
    }
    if (up) {
      applyMaxStats(false);
      player.hp = Math.min(player.hpMax, player.hp + player.hpMax * 0.2);
      player.qi = player.qiMax;
      fxText(player.x, player.y - 64, "경맥이 열렸다", "#ffe08a");
      toast("혈점이 하나 열렸다");
      persist();
    }
  }

  const LOOT = {
    grunt: [["iron", 0.18], ["cloth", 0.16], ["jade", 0.06]],
    thrower: [["baek", 0.18], ["silk", 0.16], ["hwando", 0.1]],
    elite: [["muk", 0.36], ["mongol", 0.24], ["charm", 0.16], ["snow", 0.12], ["bottle", 0.1]],
    boss: [["muk", 0.55], ["mongol", 0.45]],
  };

  function ensureStock() {
    if (!run.stock) run.stock = {};
    return run.stock;
  }

  function gainOre(id, n) {
    const stock = ensureStock();
    stock[id] = (stock[id] || 0) + n;
  }

  function canPay(cost) {
    const stock = ensureStock();
    return Object.keys(cost).every((id) => (stock[id] || 0) >= cost[id]);
  }

  function pay(cost) {
    const stock = ensureStock();
    for (const id of Object.keys(cost)) stock[id] -= cost[id];
  }

  function oreName(id) {
    const ore = GANGHO.ores.find((o) => o.id === id);
    return ore ? ore.name : id;
  }

  function costLine(cost) {
    return Object.keys(cost).map((id) => oreName(id) + " " + cost[id]).join(" · ");
  }

  function dropMaterials(e) {
    if (!e || e.dummy || e.pillar || e.egg || e.ally) return;
    const table = GANGHO.oreDrop[e.type];
    if (!table) return;
    let gained = false;
    for (const row of table) {
      if (Math.random() >= row[1]) continue;
      gainOre(row[0], 1);
      fxText(e.x, e.y - 28, oreName(row[0]), "#e4d7a8");
      gained = true;
    }
    if (gained) persist();
  }

  function dropLoot(e) {
    if (!e || e.ally) return;
    const table = LOOT[e.type] || [];
    const bonus = currentChar().dropBonus || 0;
    let roll = Math.random();
    let picked = null;
    for (const [id, p] of table) {
      if (roll < p * (1 + bonus)) { picked = id; break; }
      roll -= p;
    }
    if (!picked) return;
    const item = createItem(picked);
    if (!item) return;
    combat.drops.push({
      x: e.x + (Math.random() * 24 - 12),
      y: e.y + (Math.random() * 16 - 8),
      item,
      life: 20,
    });
  }

  function collectAll() {
    if (!combat) return;
    for (const d of combat.drops) run.bag.push(d.item);
    combat.drops = [];
  }

  function pickup(drop) {
    run.bag.push(drop.item);
    toast(drop.item.name + " 획득");
    sfx.tone(640, 0.05, "sine", 0.03, 1.6);
    persist();
  }

  function makeEnemy(type, x, y, spawnT, extra) {
    extra = extra || {};
    const t = GANGHO.enemies[type];
    const danger = t.dummy || t.pillar ? 1 : ((combat && combat.danger) || 1);
    const scale = (1 + Math.max(0, run.level - 1) * 0.07) * danger;
    const hp = Math.round(t.hp * (t.dummy ? 1 : scale) * (extra.hpMul || 1));
    const shield = Math.round((t.shield || 0) * (type === "boss" ? 1 + (run.level - 1) * 0.04 : scale) * (extra.hpMul || 1));
    return {
      id: eid++,
      type,
      name: extra.name || t.name,
      title: extra.title || t.title || "",
      x, y,
      r: t.r,
      hp, hpMax: hp,
      shield, shieldMax: shield,
      shieldBroken: false,
      dmg: t.dmg,
      speed: t.speed,
      range: t.range,
      prefer: t.prefer || t.range,
      cd: t.cd,
      atkCd: 0.45 + Math.random() * 0.3,
      windup: 0,
      windupTime: t.windup,
      armor: t.armor,
      xp: t.xp,
      color: extra.color || t.color,
      ranged: !!t.ranged,
      boss: !!t.boss,
      dummy: !!t.dummy,
      pillar: !!t.pillar,
      optional: !!extra.optional,
      duo: !!extra.duo,
      partner: extra.partner || 0,
      bleedMark: !!extra.bleedMark,
      reviving: 0,
      egg: false,
      eggPending: !!extra.eggPending,
      eggT: 0,
      eggName: "",
      eggColor: "",
      bossHp: 0,
      rebirthed: false,
      down: false,
      age: 0,
      statuses: {},
      spawnT: spawnT || 0,
      dead: false,
      corpse: 0,
      groggy: 0,
      kx: 0,
      ky: 0,
      aim: 0,
      special: 2.2,
      pattern: 0,
      did2: false,
      did3: false,
      sinceHit: 0,
      dotAcc: 0,
      flash: 0,
      superIc: 0,
    };
  }

  function randomSpawn() {
    for (let i = 0; i < 24; i++) {
      const x = 140 + Math.random() * (world.w - 280);
      const y = 400 + Math.random() * (world.h - 520);
      if (collide({ x, y, r: 22 })) continue;
      if (player && Math.hypot(x - player.x, y - player.y) < 300) continue;
      return { x, y };
    }
    return { x: 220, y: 980 };
  }

  function activeScript() {
    return (combat && combat.script) || GANGHO.waves;
  }

  function spawnWave(index) {
    const wave = activeScript()[index];
    combat.wave = index;
    showBanner(wave.title, wave.hint);
    if (wave.boss) {
      spawnBossWave(wave);
      return;
    }
    let delay = 0.12;
    for (const g of wave.groups) {
      for (let i = 0; i < g.n; i++) {
        const p = randomSpawn();
        combat.enemies.push(makeEnemy(g.type, p.x, p.y, delay, { color: wave.tint }));
        delay += 0.16;
      }
    }
  }

  function spawnBossWave(wave) {
    const gimmick = combat.gimmick;
    const tint = wave.color || "#4c141c";
    if (gimmick === "duo") {
      const a = makeEnemy("boss", 1040, 520, 0.4, {
        name: wave.leftName || "거북", title: wave.bossTitle || "북방", color: "#8fb4d4", hpMul: wave.hpMul || 0.72, duo: true,
      });
      const b = makeEnemy("boss", 1360, 520, 0.55, {
        name: wave.rightName || "뱀", title: wave.bossTitle || "북방", color: "#6f8f62", hpMul: wave.hpMul || 0.72, duo: true,
      });
      a.partner = b.id;
      b.partner = a.id;
      combat.enemies.push(a, b);
      combat.gimmickOk = true;
      return;
    }
    const boss = makeEnemy("boss", 1200, 500, 0.45, {
      name: wave.bossName || "야율한",
      title: wave.bossTitle || (wave.bossName ? "" : "혈사단주"),
      color: tint,
      hpMul: wave.hpMul || 1,
      bleedMark: gimmick === "bleed",
      eggPending: gimmick === "egg",
    });
    combat.enemies.push(boss);
    if (gimmick === "pillars") {
      combat.gimmickOk = false;
      const spots = [[980, 680], [1420, 680], [1200, 820], [860, 560]];
      const n = wave.pillars || 2;
      for (let i = 0; i < n; i++) {
        combat.enemies.push(makeEnemy("pillar", spots[i][0], spots[i][1], 0.25, { color: tint, optional: true }));
      }
    } else if (gimmick === "regen") {
      combat.gimmickOk = false;
      combat.healBlock = false;
      combat.enemies.push(makeEnemy("pillar", 1200, 820, 0.3, { color: "#f0d28a", name: "생의 기둥", optional: true }));
    } else if (gimmick === "fate") {
      combat.gimmickOk = false;
      combat.fateStarted = false;
      combat.fateT = 0;
    } else if (gimmick === "balance") {
      combat.gimmickOk = false;
      combat.balanceT = 0;
      combat.enemies.push(makeEnemy("pillar", 980, 760, 0.25, { color: "#f0d28a", name: "생의 빛", optional: true }));
      combat.enemies.push(makeEnemy("pillar", 1420, 760, 0.35, { color: "#c9b6f2", name: "사의 어둠", optional: true }));
    } else if (gimmick === "egg" || gimmick === "bleed") {
      combat.gimmickOk = gimmick !== "egg";
      player.bleed = 0;
    } else combat.gimmickOk = true;
    const adds = wave.adds != null ? wave.adds : 2;
    for (let i = 0; i < adds; i++) {
      const p = randomSpawn();
      combat.enemies.push(makeEnemy("grunt", p.x, p.y, 0.7 + i * 0.12, { color: tint }));
    }
  }

  function showBanner(title, sub) {
    combat.banner = { title, sub: sub || "", t: 2.35 };
  }

  function enemiesInArc(x, y, ang, range, arc) {
    const list = [];
    for (const e of living()) {
      const dx = e.x - x;
      const dy = e.y - y;
      const dist = Math.hypot(dx, dy);
      if (dist > range + e.r) continue;
      if (dist > 10 && angDiff(Math.atan2(dy, dx), ang) > arc / 2 + 0.12) continue;
      list.push(e);
    }
    return list;
  }

  function hitsPlayer(x, y, ang, range, arc) {
    const dx = player.x - x;
    const dy = player.y - y;
    const dist = Math.hypot(dx, dy);
    if (dist > range + player.r) return false;
    if (dist <= 12) return true;
    return angDiff(Math.atan2(dy, dx), ang) <= arc / 2 + 0.1;
  }

  function damageArc(x, y, ang, range, arc, dmg, pack) {
    const hits = enemiesInArc(x, y, ang, range, arc);
    for (const e of hits) dealDamage(e, dmg, pack);
    return hits.length;
  }

  function damageRadius(x, y, radius, dmg, pack) {
    let n = 0;
    for (const e of living()) {
      if (Math.hypot(e.x - x, e.y - y) <= radius + e.r) {
        dealDamage(e, dmg, pack);
        n += 1;
      }
    }
    return n;
  }

  function beginCast(src) {
    const school = src.school || null;
    const alt = !!(school && player.lastSchool && player.lastSchool !== school);
    if (school) player.lastSchool = school;
    const mods = { alt, echo: false, burst: false };
    const c = currentChar();
    if (c.mechanic === "magi" && alt) mods.echo = true;
    if (c.mechanic === "manryu" && alt) {
      player.synergy = Math.min(5, player.synergy + 1);
      if (player.synergy >= 5) {
        mods.burst = true;
        player.synergy = 0;
      }
    }
    if (c.mechanic === "samjae" && src.key) {
      player.samjae = (player.samjae || 0) + 1;
      if (player.samjae % 3 === 0) mods.burst = true;
    }
    return mods;
  }

  function canMove() {
    return mode === "combat" && combat && player && player.hp > 0
      && (combat.overlay === null || combat.overlay === "intro");
  }

  function canFight() {
    return canMove() && combat.overlay === null && player.dashT <= 0 && player.hitstun <= 0
      && (combat.phase === "fight" || combat.phase === "break");
  }

  function tryBasic() {
    const allow = canFight() || (canMove() && combat.overlay === "intro" && player.dashT <= 0 && player.hitstun <= 0);
    if (!allow || player.swing || player.atkCd > 0) return;
    const c = currentChar();
    const step = player.combo;
    const spec = c.basic.steps[step];
    player.swing = {
      step,
      t: 0,
      dur: spec.dur / player.stats.aspd,
      hit: false,
      spec,
      tag: c.basic.tag,
      school: c.basic.school,
      mods: beginCast({ school: c.basic.school, tag: c.basic.tag }),
    };
    player.comboGap = 0.58;
    sfx.noise(0.05, 0.045);
  }

  function castSkill(sk) {
    if (!canFight() || !sk) return;
    if ((player.cds[sk.key] || 0) > 0) return;
    const cost = skillCost(sk);
    if (player.qi < cost) {
      if (player.qiWarn <= 0) {
        player.qiWarn = 0.55;
        fxText(player.x, player.y - 30, "내공 부족", "#7dcea8");
      }
      return;
    }
    const tuned = tuneSkill(sk);
    player.qi -= cost;
    player.cds[sk.key] = tuned.cd;
    player.swing = null;
    const mods = beginCast(tuned);
    const statuses = withTag(tuned.statuses, tuned.tag);
    const pack = {
      player: true, mods, statuses, knock: tuned.knock || 0, canCrit: true,
      hitstop: 0.04, lifesteal: tuned.lifesteal || 0, armorPierce: !!tuned.armorPierce,
    };
    executeSkill(tuned, pack);
    if (tuned.selfHp && player.hp > 1) player.hp = Math.max(1, player.hp - player.hpMax * tuned.selfHp);
    sfx.tone(230, 0.09, "triangle", 0.04, 1.7);
  }

  function executeSkill(sk, pack) {
    const color = currentChar().color;
    if (sk.kind === "arc") {
      damageArc(player.x, player.y, player.facing, sk.range, sk.arc, sk.dmg, pack);
      combat.slashes.push({ x: player.x, y: player.y, ang: player.facing, arc: sk.arc, range: sk.range, life: 0.16, max: 0.16, color });
    } else if (sk.kind === "proj") {
      const spread = sk.spread || 0;
      const count = sk.count || 1;
      for (let i = 0; i < count; i++) {
        const ang = player.facing + (count === 1 ? 0 : (i - (count - 1) / 2) * (spread || 0.22));
        spawnProj({
          team: "player", x: player.x, y: player.y, ang, speed: sk.speed || 560,
          dmg: sk.dmg, r: 8, life: 0.85, pierce: sk.pierce || 1, color, opts: pack,
        });
      }
    } else if (sk.kind === "nova") {
      damageRadius(player.x, player.y, sk.radius, sk.dmg, pack);
      combat.slashes.push({ x: player.x, y: player.y, ang: 0, arc: Math.PI * 2, range: sk.radius, life: 0.2, max: 0.2, color });
      burstParticles(player.x, player.y, color, 18, 180);
    } else if (sk.kind === "dash") {
      const ang = player.facing;
      const steps = 8;
      for (let i = 0; i < steps; i++) moveCircle(player, Math.cos(ang) * sk.dist / steps, Math.sin(ang) * sk.dist / steps);
      player.iframes = Math.max(player.iframes, 0.12);
      damageArc(player.x, player.y, ang, 90, 1.25, sk.dmg, pack);
      combat.slashes.push({ x: player.x, y: player.y, ang, arc: 1.25, range: 90, life: 0.14, max: 0.14, color });
    } else if (sk.kind === "guard") {
      player.guardT = sk.duration;
      player.dr = sk.dr || 0;
      gainShield(sk.shield || 0);
      fxText(player.x, player.y - 28, "호신강기", "#9fd0ea");
    } else if (sk.kind === "zone") {
      combat.zones.push({
        x: player.x, y: player.y, radius: sk.radius, t: sk.duration, every: sk.every || 0.45,
        acc: sk.every || 0.45, dmg: sk.dmg, mods: pack.mods, statuses: pack.statuses, lifesteal: pack.lifesteal,
      });
    } else if (sk.kind === "blink") {
      let best = null;
      let bestD = sk.reach || 340;
      for (const e of living()) {
        const d = Math.hypot(e.x - player.x, e.y - player.y);
        if (d < bestD) { bestD = d; best = e; }
      }
      if (!best) {
        executeSkill(Object.assign({}, sk, { kind: "dash", dist: 120 }), pack);
        return;
      }
      const ang = Math.atan2(best.y - player.y, best.x - player.x);
      player.x = best.x - Math.cos(ang) * (best.r + player.r + 6);
      player.y = best.y - Math.sin(ang) * (best.r + player.r + 6);
      unstuck(player);
      player.facing = ang;
      player.iframes = Math.max(player.iframes, 0.14);
      dealDamage(best, sk.dmg, pack);
      burstParticles(player.x, player.y, color, 8, 120);
    } else if (sk.kind === "bolt") {
      const target = pickAimTarget(sk.reach || 380);
      if (!target) {
        fxText(player.x, player.y - 20, "허공", "#9fb0b8");
        return;
      }
      combat.bolts.push({ x1: player.x, y1: player.y, x2: target.x, y2: target.y, life: 0.14 });
      dealDamage(target, sk.dmg, pack);
    } else if (sk.kind === "storm") {
      const origin = { x: input.wx, y: input.wy };
      const strikes = sk.strikes || 6;
      for (let i = 0; i < strikes; i++) {
        combat.timers.push({
          t: i * 0.09,
          fn() {
            const x = origin.x + (Math.random() - 0.5) * sk.radius;
            const y = origin.y + (Math.random() - 0.5) * sk.radius;
            combat.bolts.push({ x1: x, y1: y - 90, x2: x, y2: y, life: 0.12 });
            damageRadius(x, y, 56, sk.dmg, {
              player: true, mods: pack.mods, statuses: withTag([], sk.tag), canCrit: true, hitstop: 0.02,
            });
          },
        });
      }
    } else if (sk.kind === "burst") {
      const shield = player.shield;
      const dmg = sk.base + shield * sk.ratio;
      player.shield = 0;
      if (shield < 8) fxText(player.x, player.y - 24, "모은 강기가 옅다", "#f0d7a8");
      damageRadius(player.x, player.y, sk.radius, dmg, pack);
      burstParticles(player.x, player.y, "#f0d7a8", 22, 220);
      shake(7);
    } else if (sk.kind === "grace") {
      damageRadius(player.x, player.y, sk.radius, sk.dmg, pack);
      player.hp = Math.min(player.hpMax, player.hp + player.hpMax * (sk.heal || 0.16));
      if (sk.shield) gainShield(sk.shield);
      fxText(player.x, player.y - 36, "숨이 돌아온다", "#f0e2b0");
      burstParticles(player.x, player.y, color, 14, 140);
    } else if (sk.kind === "counter") {
      player.counterT = sk.duration || 1.3;
      fxText(player.x, player.y - 32, "이화접목", "#d2c4ef");
    }
  }

  function pickAimTarget(reach) {
    let best = null;
    let score = 1e9;
    for (const e of living()) {
      const dx = e.x - player.x;
      const dy = e.y - player.y;
      const dist = Math.hypot(dx, dy);
      if (dist > reach) continue;
      const diff = angDiff(Math.atan2(dy, dx), player.facing);
      if (diff > 0.95 && dist > 80) continue;
      const mouseD = Math.hypot(e.x - input.wx, e.y - input.wy);
      const s = mouseD * 0.7 + diff * 70;
      if (s < score) { score = s; best = e; }
    }
    return best;
  }

  function spawnProj(p) {
    combat.projs.push({
      team: p.team,
      x: p.x,
      y: p.y,
      vx: Math.cos(p.ang) * p.speed,
      vy: Math.sin(p.ang) * p.speed,
      dmg: p.dmg,
      r: p.r,
      life: p.life,
      pierce: p.pierce,
      color: p.color,
      opts: p.opts || null,
      hit: new Set(),
      bleedMark: !!p.bleedMark,
    });
  }

  function tryDash() {
    if (!canMove() || player.dashT > 0 || player.dashCd > 0 || player.hitstun > 0) return;
    player.dashT = 0.13;
    player.dashA = player.facing;
    if (player.bleed > 0 && combat && combat.gimmick === "bleed") {
      player.bleed = 0;
      fxText(player.x, player.y - 36, "경공으로 끊었다", "#e4c6ff");
    }
    player.iframes = Math.max(player.iframes, 0.16);
    player.dashCd = player.stats.dashCd;
    player.swing = null;
    sfx.noise(0.07, 0.05);
  }

  function drink() {
    if (!canMove() || combat.overlay === "intro") return;
    if (player.potionCd > 0 || combat.potions <= 0 || player.hp <= 0) return;
    combat.potions -= 1;
    const heal = player.hpMax * player.stats.potion;
    player.hp = Math.min(player.hpMax, player.hp + heal);
    player.potionCd = 0.7;
    fxText(player.x, player.y - 26, "영약 +" + Math.round(heal), "#9dcea8");
    sfx.tone(520, 0.08, "sine", 0.035, 1.5);
  }

  function noteBleed() {
    if (!combat || combat.gimmick !== "bleed" || player.hp <= 0) return;
    player.bleed = (player.bleed || 0) + 1;
    fxText(player.x, player.y - 36, "출혈 " + player.bleed, "#e07070");
    if (player.bleed < 5) return;
    player.bleed = 0;
    combat.gimmickOk = false;
    player.hitstun = Math.max(player.hitstun, 0.55);
    fxText(player.x, player.y - 54, "살성", "#ffd0d0");
    showBanner("살성의 반격", "출혈 다섯 겹을 경공으로 끊지 못했다.");
  }

  function hurtPlayer(raw, kind) {
    if (!player || player.hp <= 0) return false;
    if (player.counterT > 0) {
      player.counterT = 0;
      player.iframes = Math.max(player.iframes, 0.35);
      damageRadius(player.x, player.y, 124, Math.max(70, raw * 4), {
        player: true, canCrit: true, armorPierce: true, knock: 90,
      });
      fxText(player.x, player.y - 40, "이화접목", "#d2c4ef");
      showBanner("이화접목", "빼앗은 초식을 되돌렸다.");
      return false;
    }
    if (player.iframes > 0 || player.dashT > 0) return false;
    if (combat.phase === "dead" || combat.phase === "victory") return;
    let amount = raw * player.stats.taken;
    if (kind === "proj") amount *= 1 - player.stats.projResist;
    if (player.guardT > 0) amount *= 1 - (player.dr || 0);
    amount *= 100 / (100 + player.stats.armor);
    if (player.shield > 0) {
      const absorbed = Math.min(player.shield, amount);
      player.shield -= absorbed;
      amount -= absorbed;
    }
    if (amount > 0) {
      player.hp -= amount;
      fxText(player.x, player.y - 22, String(Math.round(amount)), "#ff8d8d");
    }
    player.hitstun = 0.12;
    player.hurtFlash = 0.16;
    player.iframes = Math.max(player.iframes, 0.32);
    player.shieldDelay = 3.2;
    if (player.stats.guardProc && player.guardIcd <= 0 && Math.random() < player.stats.guardProc) {
      gainShield(player.stats.guardShield || 22);
      player.guardIcd = 6;
      fxText(player.x, player.y - 40, "호신부", "#9fd0ea");
    }
    sfx.tone(78, 0.1, "sawtooth", 0.04, 0.45);
    shake(3.2);
    if (player.hp <= 0) {
      if (run.namdu && combat && !combat.revived) {
        combat.revived = true;
        player.hp = Math.max(1, Math.round(player.hpMax * 0.35));
        player.iframes = Math.max(player.iframes, 1.1);
        fxText(player.x, player.y - 48, "남두주생", "#f0d28a");
        showBanner("남두주생", "끊긴 숨이 한 번 돌아온다.");
        return true;
      }
      player.hp = 0;
      onDeath();
      return false;
    }
    return true;
  }

  function tickStatuses(e, dt) {
    if (e.superIc) e.superIc = Math.max(0, e.superIc - dt);
    let dot = 0;
    for (const id of Object.keys(e.statuses)) {
      const st = e.statuses[id];
      st.t -= dt;
      if (st.dps) dot += st.dps * (st.stacks || 1);
      if (st.t <= 0) delete e.statuses[id];
    }
    e.dotAcc = (e.dotAcc || 0) + dt;
    if (dot > 0 && e.dotAcc >= 0.25) {
      const step = e.dotAcc;
      e.dotAcc = 0;
      dealDamage(e, dot * step, { player: true, dot: true, noStatus: true, noMechanic: true, canCrit: false, hitstop: 0 });
    }
  }

  function doEnemyAttack(e) {
    if (e.ranged) {
      const ang = Math.atan2(player.y - e.y, player.x - e.x);
      spawnProj({ team: "enemy", x: e.x, y: e.y, ang, speed: 270, dmg: e.dmg, r: 6, life: 1.7, pierce: 1, color: "#e7d2a8" });
      return;
    }
    if (hitsPlayer(e.x, e.y, e.aim, e.range + 10, e.boss ? 1.45 : 1.15)) {
      if (hurtPlayer(e.dmg, "melee") && e.bleedMark) noteBleed();
    }
  }

  function checkPhase(e) {
    const ratio = e.hp / e.hpMax;
    let triggered = false;
    if (!e.did2 && ratio <= 0.7) { e.did2 = true; triggered = true; }
    if (!e.did3 && ratio <= 0.4) { e.did3 = true; triggered = true; }
    if (e.name === "태고 황룡" && !e.did1 && ratio <= 0.85) { e.did1 = true; triggered = true; }
    if (e.name === "태고 황룡" && !e.did4 && ratio <= 0.15) { e.did4 = true; triggered = true; }
    if (!triggered) return;
    e.shieldBroken = false;
    e.shield = e.shieldMax * (e.did3 ? 0.5 : 0.72);
    e.groggy = 0.28;
    if (e.duo) {
      showBanner("현무가 껍질을 다시 두른다", "거북과 뱀을 함께 쓰러뜨려야 한다.");
      return;
    }
    for (let i = 0; i < 3; i++) {
      const p = randomSpawn();
      combat.enemies.push(makeEnemy("grunt", p.x, p.y, 0.25 + i * 0.12, { color: e.color }));
    }
    const who = e.name === "야율한";
    const dragon = e.name === "태고 황룡";
    const dragonLine = e.did4 ? "황룡이 네 번째 비늘을 벗는다" : (e.did3 ? "황룡이 광폭해진다" : (e.did1 && !e.did2 ? "황룡이 첫 비늘을 세운다" : "황룡이 무리를 부른다"));
    showBanner(who ? (e.did3 ? "야율한이 광폭해진다" : "담 너머에서 살수가 더 넘는다") : (dragon ? dragonLine : (e.did3 ? "영물이 광폭해진다" : "영물이 무리를 부른다")), "호신강기가 다시 둘러졌다.");
  }

  function updateBoss(e, dt) {
    checkPhase(e);
    e.age = (e.age || 0) + dt;
    if (combat.gimmick === "fate" && (e.hp / e.hpMax <= 0.62 || e.age > 8)) beginFate(e);
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const slow = (e.statuses["빙결"] || e.statuses["둔화"]) ? 0.75 : 1;
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) doEnemyAttack(e);
      return;
    }
    e.aim = Math.atan2(dy, dx);
    e.special -= dt;
    e.atkCd -= dt;
    if (e.special <= 0) {
      e.special = e.did3 ? 4.1 : 5.6;
      if (e.pattern % 2 === 0) {
        combat.telegraphs.push({ x: player.x, y: player.y, r: 120, t: 0, warn: 0.74, dmg: e.dmg + 12, done: false, bleedMark: !!e.bleedMark });
        fxText(e.x, e.y - 62, "지진", "#f0c2b8");
      } else {
        const aim = Math.atan2(dy, dx);
        for (let i = -3; i <= 3; i++) {
          spawnProj({
            team: "enemy", x: e.x, y: e.y, ang: aim + i * 0.18, speed: 300,
            dmg: Math.round(e.dmg * 0.85), r: 6, life: 1.8, pierce: 1, color: "#e7b2b8",
            bleedMark: !!e.bleedMark,
          });
        }
      }
      e.pattern += 1;
      return;
    }
    if (dist > e.range * 0.78) moveCircle(e, (dx / dist) * e.speed * slow * dt, (dy / dist) * e.speed * slow * dt);
    else if (e.atkCd <= 0) {
      e.aim = Math.atan2(dy, dx);
      e.windup = e.windupTime;
      e.atkCd = e.cd;
    }
  }

  function updateGrunt(e, dt) {
    const dx = player.x - e.x;
    const dy = player.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    const slow = (e.statuses["빙결"] || e.statuses["둔화"]) ? 0.55 : 1;
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) doEnemyAttack(e);
      return;
    }
    e.aim = Math.atan2(dy, dx);
    e.atkCd -= dt;
    if (e.ranged) {
      const prefer = e.prefer || 250;
      const dir = dist < prefer - 36 ? -1 : dist > prefer + 36 ? 1 : 0;
      if (dir) moveCircle(e, (dx / dist) * e.speed * slow * dir * dt, (dy / dist) * e.speed * slow * dir * dt);
      if (dist < e.range && e.atkCd <= 0) {
        e.aim = Math.atan2(dy, dx);
        e.windup = e.windupTime;
        e.atkCd = e.cd;
      }
    } else if (dist > e.range * 0.8) {
      moveCircle(e, (dx / dist) * e.speed * slow * dt, (dy / dist) * e.speed * slow * dt);
    } else if (e.atkCd <= 0) {
      e.aim = Math.atan2(dy, dx);
      e.windup = e.windupTime;
      e.atkCd = e.cd;
    }
  }

  function updateAlly(e, dt) {
    const foes = living().filter((o) => !o.dummy);
    if (!foes.length) return;
    let best = foes[0];
    let bestD = Infinity;
    for (const o of foes) {
      const d = Math.hypot(o.x - e.x, o.y - e.y);
      if (d < bestD) { bestD = d; best = o; }
    }
    const dx = best.x - e.x;
    const dy = best.y - e.y;
    const dist = Math.hypot(dx, dy) || 1;
    e.aim = Math.atan2(dy, dx);
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) damageArc(e.x, e.y, e.aim, e.range + 24, 1.2, e.dmg, { player: false, canCrit: false });
      return;
    }
    e.atkCd -= dt;
    if (dist > e.range) moveCircle(e, (dx / dist) * e.speed * dt, (dy / dist) * e.speed * dt);
    else if (e.atkCd <= 0) { e.windup = 0.32; e.atkCd = 0.85; }
  }

  function updateEnemy(e, dt) {
    if (e.dead) {
      e.corpse += dt;
      return;
    }
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.spawnT > 0) {
      e.spawnT -= dt;
      return;
    }
    if (e.ally) { updateAlly(e, dt); return; }
    if (e.pillar) return;
    if (combat && combat.gimmick === "regen" && !combat.healBlock && e.hp > 0 && e.hp < e.hpMax) {
      e.hp = Math.min(e.hpMax, e.hp + e.hpMax * 0.045 * dt);
    }
    if (e.egg) {
      e.eggT -= dt;
      if (e.eggT <= 0) hatchEgg(e);
      return;
    }
    if (e.reviving > 0) {
      e.reviving -= dt;
      if (e.reviving <= 0) {
        e.hp = Math.round(e.hpMax * 0.5);
        e.shield = (e.shieldMax || 0) * 0.65;
        e.shieldBroken = e.shield <= 0;
        combat.gimmickOk = false;
        showBanner("광폭화", "한쪽만 쓰러지면 현무가 다시 일어난다.");
      }
      return;
    }
    tickStatuses(e, dt);
    if (e.dead) return;
    if (e.kx || e.ky) {
      moveCircle(e, e.kx * dt, e.ky * dt);
      const decay = Math.pow(0.05, dt);
      e.kx *= decay;
      e.ky *= decay;
    }
    if (e.dummy) return;
    if (e.shieldMax > 0 && !e.shieldBroken && !e.statuses["혈독"] && e.sinceHit > 4.6 && e.shield < e.shieldMax) {
      e.shield = Math.min(e.shieldMax, e.shield + (e.boss ? 46 : 20) * dt);
    }
    if (e.groggy > 0) {
      e.groggy -= dt;
      return;
    }
    e.sinceHit += dt;
    if (e.boss) updateBoss(e, dt);
    else updateGrunt(e, dt);
  }

  function separate() {
    const list = combat.enemies.filter((e) => !e.dead && e.spawnT <= 0 && !e.dummy && !e.pillar && !e.egg);
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i];
        const b = list[j];
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dist = Math.hypot(dx, dy) || 0.001;
        const min = a.r + b.r;
        if (dist < min) {
          const push = (min - dist) / 2;
          dx /= dist;
          dy /= dist;
          a.x -= dx * push;
          a.y -= dy * push;
          b.x += dx * push;
          b.y += dy * push;
          unstuck(a);
          unstuck(b);
        }
      }
    }
  }

  function checkClear() {
    if (combat.mode === "training" || combat.phase !== "fight") return;
    if (combat.gimmick === "pillars") {
      const standing = combat.enemies.some((e) => e.pillar && !e.dead);
      if (standing && !combat.enemies.some(hostile)) combat.gimmickOk = false;
      if (!combat.enemies.some(hostile)) {
        for (const e of combat.enemies) if (e.pillar && !e.dead) e.dead = true;
      }
    }
    if (combat.enemies.some(hostile)) return;
    if (combat.projs.some((p) => p.team === "enemy" && p.life > 0)) return;
    if (combat.wave >= activeScript().length - 1) onVictory();
    else {
      combat.phase = "break";
      combat.breakT = 2.15;
      combat.projs = combat.projs.filter((p) => p.team === "player");
      combat.telegraphs = [];
      player.hp = Math.min(player.hpMax, player.hp + player.hpMax * 0.16);
      player.qi = Math.min(player.qiMax, player.qi + 28);
      showBanner("숨을 고른다", "다음 무리가 담을 넘기 전에 영약을 삼켜라.");
    }
  }

  function updatePlayer(dt) {
    player.dashCd = Math.max(0, player.dashCd - dt);
    player.atkCd = Math.max(0, player.atkCd - dt);
    player.potionCd = Math.max(0, player.potionCd - dt);
    player.iframes = Math.max(0, player.iframes - dt);
    player.counterT = Math.max(0, (player.counterT || 0) - dt);
    player.hitstun = Math.max(0, player.hitstun - dt);
    player.hurtFlash = Math.max(0, player.hurtFlash - dt);
    player.guardT = Math.max(0, player.guardT - dt);
    player.guardIcd = Math.max(0, player.guardIcd - dt);
    player.shieldDelay = Math.max(0, player.shieldDelay - dt);
    player.qiWarn = Math.max(0, player.qiWarn - dt);
    for (const k of ["Q", "W", "E", "R"]) player.cds[k] = Math.max(0, (player.cds[k] || 0) - dt);

    if (player.dashT > 0) {
      player.dashT -= dt;
      const spd = 1080;
      moveCircle(player, Math.cos(player.dashA) * spd * dt, Math.sin(player.dashA) * spd * dt);
      combat.trail.push({ x: player.x, y: player.y, a: 0.45 });
      return;
    }
    if (player.hitstun > 0 || !canMove()) return;

    let x = 0;
    let y = 0;
    if (input.keys.KeyW || input.keys.ArrowUp) y -= 1;
    if (input.keys.KeyS || input.keys.ArrowDown) y += 1;
    if (input.keys.KeyA || input.keys.ArrowLeft) x -= 1;
    if (input.keys.KeyD || input.keys.ArrowRight) x += 1;
    if (x || y) {
      const len = Math.hypot(x, y);
      const spd = player.stats.move * (player.swing ? 0.62 : 1);
      moveCircle(player, (x / len) * spd * dt, (y / len) * spd * dt);
    }

    if (player.swing) {
      const sw = player.swing;
      sw.t += dt;
      if (!sw.hit && sw.t >= sw.dur * 0.34) {
        sw.hit = true;
        const spec = sw.spec;
        const n = damageArc(player.x, player.y, player.facing, spec.range, spec.arc, spec.dmg, {
          player: true,
          mods: sw.mods,
          statuses: withTag(spec.statuses, sw.tag),
          knock: spec.knock || 0,
          canCrit: true,
          hitstop: spec.hitstop || 0.03,
        });
        combat.slashes.push({
          x: player.x, y: player.y, ang: player.facing, arc: spec.arc, range: spec.range,
          life: 0.12, max: 0.12, color: currentChar().color,
        });
        if (n) {
          sfx.tone(150 + sw.step * 30, 0.04, "square", 0.028, 0.5);
          shake(sw.step === 2 ? 3.4 : 1.5);
        }
      }
      if (sw.t >= sw.dur) {
        player.combo = (sw.step + 1) % 3;
        player.atkCd = 0.07 / player.stats.aspd;
        player.swing = null;
      }
    } else if (player.comboGap > 0) {
      player.comboGap -= dt;
      if (player.comboGap <= 0) player.combo = 0;
    }

    const allowBasic = canFight() || combat.overlay === "intro";
    if (allowBasic && input.mouseDown) tryBasic();
  }

  function updateAim() {
    if (!player) return;
    const rect = canvas.getBoundingClientRect();
    const sx = input.hasMouse ? input.cx - rect.left : viewW * 0.62;
    const sy = input.hasMouse ? input.cy - rect.top : viewH * 0.48;
    input.wx = sx / zoom + cam.x;
    input.wy = sy / zoom + cam.y;
    const dx = input.wx - player.x;
    const dy = input.wy - player.y;
    if (dx * dx + dy * dy > 16) player.facing = Math.atan2(dy, dx);
  }

  function updateCamera() {
    if (!player) return;
    const worldW = viewW / zoom;
    const worldH = viewH / zoom;
    if (worldW >= world.w) cam.x = (world.w - worldW) / 2;
    else cam.x = clamp(player.x - worldW / 2, 0, world.w - worldW);
    if (worldH >= world.h) cam.y = (world.h - worldH) / 2;
    else cam.y = clamp(player.y - worldH * 0.62, 0, world.h - worldH);
  }

  function update(dt) {
    if (!combat || mode !== "combat") return;
    if (combat.hitstop > 0) {
      combat.hitstop -= dt;
      combat.shake = Math.max(0, combat.shake - dt * 28);
      if (combat.hitstop > 0) return;
    }
    stopUsed = false;
    if (combat.overlay === "pause" || combat.overlay === "modal" || combat.overlay === "dead") return;
    if (combat.phase !== "intro") combat.elapsed += dt;
    if (combat.phase === "fight" && combat.gimmick === "fate" && combat.fateT > 0 && !combat.gimmickOk) {
      combat.fateT -= dt;
      if (combat.fateT <= 0) {
        combat.fateT = 0;
        combat.gimmickOk = false;
        for (const b of combat.enemies) if (b.boss && !b.dead) b.dmg *= 1.2;
        hurtPlayer(Math.round(player.hpMax * 0.28), "fate");
        showBanner("수명이 다했다", "각인을 풀지 못했다.");
      }
    }
    if (combat.phase === "fight" && combat.gimmick === "balance" && combat.balanceT > 0 && !combat.gimmickOk) {
      combat.balanceT -= dt;
      if (combat.balanceT <= 0) {
        combat.balanceT = 0;
        for (const p of combat.enemies) {
          if (p.pillar && p.down) {
            p.down = false;
            p.hp = p.hpMax;
          }
        }
        showBanner("균형이 무너졌다", "한쪽만 가라앉으면 기둥이 다시 선다.");
      }
    }
    updateCamera();
    updateAim();
    updatePlayer(dt);
    if (player.hp > 0) {
      player.qi = Math.min(player.qiMax, player.qi + player.stats.qiRegen * dt);
      if (player.shield > player.shieldMax) player.shield = Math.max(player.shieldMax, player.shield - 12 * dt);
      else if (player.shieldDelay <= 0 && player.shield < player.shieldMax) {
        player.shield = Math.min(player.shieldMax, player.shield + player.stats.shieldRegen * dt);
      }
    }

    const due = [];
    const left = [];
    for (const tm of combat.timers) {
      tm.t -= dt;
      if (tm.t <= 0) due.push(tm);
      else left.push(tm);
    }
    combat.timers = left;
    for (const tm of due) tm.fn();

    for (const p of combat.projs) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0 || collide({ x: p.x, y: p.y, r: 4 })) {
        p.life = 0;
        continue;
      }
      if (p.team === "player") {
        for (const e of living()) {
          if (p.hit.has(e.id)) continue;
          if (Math.hypot(e.x - p.x, e.y - p.y) <= e.r + p.r) {
            p.hit.add(e.id);
            dealDamage(e, p.dmg, p.opts || { player: true });
            p.pierce -= 1;
            if (p.pierce <= 0) { p.life = 0; break; }
          }
        }
      } else if (Math.hypot(player.x - p.x, player.y - p.y) <= player.r + p.r) {
        if (hurtPlayer(p.dmg, "proj") && p.bleedMark) noteBleed();
        p.life = 0;
      }
    }
    combat.projs = combat.projs.filter((p) => p.life > 0);

    for (const z of combat.zones) {
      z.t -= dt;
      z.acc += dt;
      if (z.acc >= z.every) {
        z.acc = 0;
        damageRadius(z.x, z.y, z.radius, z.dmg, {
          player: true, mods: z.mods, statuses: z.statuses, canCrit: false, hitstop: 0, lifesteal: z.lifesteal || 0,
        });
      }
    }
    combat.zones = combat.zones.filter((z) => z.t > 0);

    for (const t of combat.telegraphs) {
      t.t += dt;
      if (!t.done && t.t >= t.warn) {
        t.done = true;
        if (Math.hypot(player.x - t.x, player.y - t.y) < t.r + player.r * 0.35) {
          if (hurtPlayer(t.dmg, "slam") && t.bleedMark) noteBleed();
        }
        burstParticles(t.x, t.y, "#a33a32", 16, 80);
        shake(5);
      }
    }
    combat.telegraphs = combat.telegraphs.filter((t) => t.t < t.warn + 0.22);

    for (const e of combat.enemies) updateEnemy(e, dt);
    separate();
    combat.enemies = combat.enemies.filter((e) => !(e.dead && e.corpse > 1.25));

    for (const d of combat.drops) {
      d.life -= dt;
      const dx = player.x - d.x;
      const dy = player.y - d.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 140) {
        d.x += (dx / dist) * 260 * dt;
        d.y += (dy / dist) * 260 * dt;
      }
      if (dist < 28) d.got = true;
    }
    for (const d of combat.drops) if (d.got) pickup(d);
    combat.drops = combat.drops.filter((d) => !d.got && d.life > 0);

    for (const f of combat.floats) f.life -= dt;
    combat.floats = combat.floats.filter((f) => f.life > 0);
    for (const p of combat.particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
    combat.particles = combat.particles.filter((p) => p.life > 0);
    for (const s of combat.slashes) s.life -= dt;
    combat.slashes = combat.slashes.filter((s) => s.life > 0);
    for (const b of combat.bolts) b.life -= dt;
    combat.bolts = combat.bolts.filter((b) => b.life > 0);
    for (const t of combat.trail) t.a -= dt * 2.2;
    combat.trail = combat.trail.filter((t) => t.a > 0);
    if (combat.trail.length > 14) combat.trail.splice(0, combat.trail.length - 14);

    if (combat.banner) {
      combat.banner.t -= dt;
      if (combat.banner.t <= 0) combat.banner = null;
    }
    combat.shake = Math.max(0, combat.shake - dt * 28);

    if (combat.phase === "break") {
      combat.breakT -= dt;
      if (combat.breakT <= 0) {
        combat.phase = "fight";
        spawnWave(combat.wave + 1);
      }
    } else if (combat.phase === "fight") checkClear();
  }

  function paintFloor() {
    floorCanvas = document.createElement("canvas");
    floorCanvas.width = world.w;
    floorCanvas.height = world.h;
    const g = floorCanvas.getContext("2d");
    g.fillStyle = "#121820";
    g.fillRect(0, 0, world.w, world.h);
    const glow = g.createRadialGradient(1200, 860, 40, 1200, 900, 760);
    glow.addColorStop(0, "rgba(92, 74, 52, 0.28)");
    glow.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = glow;
    g.fillRect(0, 0, world.w, world.h);
    g.strokeStyle = "rgba(255,255,255,0.035)";
    for (let x = 0; x < world.w; x += 96) {
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, world.h); g.stroke();
    }
    for (let y = 0; y < world.h; y += 96) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(world.w, y); g.stroke();
    }
    for (const p of puddles) {
      g.fillStyle = "rgba(86, 118, 138, 0.16)";
      g.beginPath();
      g.ellipse(p.x, p.y, p.rx, p.ry, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = "#3a241c";
    g.beginPath();
    g.moveTo(600, 150);
    g.lineTo(1200, 70);
    g.lineTo(1800, 150);
    g.closePath();
    g.fill();
    g.fillStyle = "#1c1412";
    g.fillRect(650, 140, 1100, 220);
    g.fillStyle = "#0e0c0b";
    g.fillRect(1144, 230, 112, 130);
    for (const wx of [800, 980, 1420, 1600]) {
      g.fillStyle = "rgba(255, 168, 86, 0.9)";
      g.fillRect(wx, 210, 28, 42);
    }
    g.fillStyle = "#24180f";
    g.fillRect(1040, 372, 320, 54);
    g.strokeStyle = "#c6a36a";
    g.lineWidth = 3;
    g.strokeRect(1040, 372, 320, 54);
    g.fillStyle = "#e7dcc8";
    g.font = "700 36px serif";
    g.textAlign = "center";
    g.fillText("풍운객잔", 1200, 410);
    for (const p of pillars) {
      g.fillStyle = "#241c16";
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = "#c6a36a";
      g.lineWidth = 3;
      g.stroke();
    }
    g.strokeStyle = "#1c4638";
    g.lineWidth = 5;
    for (let i = 0; i < 9; i++) {
      g.beginPath();
      g.moveTo(90 + i * 16, world.h);
      g.lineTo(110 + i * 14, 1040);
      g.stroke();
      g.beginPath();
      g.moveTo(2140 + i * 16, world.h);
      g.lineTo(2100 + i * 12, 980);
      g.stroke();
    }
  }

  function drawActor(x, y, r, facing, color, look, alpha) {
    ctx.save();
    ctx.translate(x, y);
    ctx.globalAlpha = alpha == null ? 1 : alpha;
    ctx.fillStyle = "rgba(0,0,0,0.38)";
    ctx.beginPath();
    ctx.ellipse(0, 6, r * 0.85, r * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(facing);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-r * 0.1, 0);
    ctx.lineTo(-r * 1.05, r * 0.72);
    ctx.lineTo(-r * 1.05, -r * 0.72);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#16171b";
    ctx.beginPath();
    ctx.arc(-2, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(r * 0.18, 0, r * 0.26, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#f3ecdf";
    ctx.fillStyle = "#f3ecdf";
    ctx.lineWidth = 3;
    ctx.beginPath();
    if (look === "fist") {
      ctx.arc(r * 0.72, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.moveTo(r * 0.15, 0);
      ctx.lineTo(r * (look === "blade" ? 1.55 : 1.22), 0);
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    if (!ctx || !player || !combat) return;
    updateCamera();
    const ox = (Math.random() - 0.5) * (combat.shake || 0);
    const oy = (Math.random() - 0.5) * (combat.shake || 0);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);
    ctx.fillStyle = "#07080c";
    ctx.fillRect(0, 0, viewW, viewH);
    ctx.save();
    ctx.translate(ox, oy);
    ctx.scale(zoom, zoom);
    ctx.translate(-cam.x, -cam.y);
    if (floorCanvas) ctx.drawImage(floorCanvas, 0, 0);

    for (const d of combat.decals) {
      ctx.fillStyle = "rgba(90, 16, 22, " + d.a + ")";
      ctx.beginPath();
      ctx.ellipse(d.x, d.y, d.r, d.r * 0.55, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const t of combat.telegraphs) {
      const k = clamp(t.t / t.warn, 0, 1);
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(160, 30, 24, " + (0.08 + k * 0.22) + ")";
      ctx.fill();
      ctx.strokeStyle = "rgba(255, 120, 90, 0.85)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
    for (const z of combat.zones) {
      ctx.beginPath();
      ctx.arc(z.x, z.y, z.radius, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(120, 180, 140, 0.08)";
      ctx.fill();
      ctx.strokeStyle = "rgba(180, 220, 170, 0.35)";
      ctx.stroke();
    }
    for (const d of combat.drops) {
      ctx.fillStyle = GANGHO.gradeColor[d.item.grade] || "#fff";
      ctx.beginPath();
      ctx.arc(d.x, d.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#f6efe2";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(d.item.name, d.x, d.y - 12);
    }
    for (const t of combat.trail) {
      ctx.fillStyle = "rgba(200,220,230," + t.a + ")";
      ctx.beginPath();
      ctx.arc(t.x, t.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }

    for (const e of combat.enemies) {
      if (e.dead && e.corpse > 1) continue;
      const alpha = e.dead ? Math.max(0, 1 - e.corpse) : e.down ? 0.38 : e.spawnT > 0 ? 0.35 : 1;
      if (e.windup > 0 && !e.dead) {
        ctx.fillStyle = "rgba(220, 50, 40, 0.22)";
        ctx.beginPath();
        ctx.moveTo(e.x, e.y);
        ctx.arc(e.x, e.y, e.range, e.aim - 0.7, e.aim + 0.7);
        ctx.fill();
      }
      if (e.pillar || e.egg) {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = e.color;
        ctx.beginPath();
        ctx.ellipse(e.x, e.y, e.r * (e.egg ? 1.15 : 0.72), e.r * (e.egg ? 0.86 : 1.35), 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.4)";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.fillStyle = e.egg ? "#ffe0c2" : "#e8fff8";
        ctx.font = "14px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(e.egg ? Math.ceil(e.eggT) + "초" : (e.down ? "기운다" : (e.name && e.name !== "뇌전 기둥" ? e.name : "기둥")), e.x, e.y + 5);
        ctx.restore();
      } else {
        const look = e.boss ? "blade" : e.ranged ? "sword" : "fist";
        drawActor(e.x, e.y, e.r, e.aim || 0, e.dummy ? "#c2a15a" : e.color, e.dummy ? "sword" : look, alpha);
      }
      if (e.reviving > 0 && !e.dead) {
        ctx.fillStyle = "#9fd0ea";
        ctx.font = "13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("부활 " + Math.ceil(e.reviving), e.x, e.y - e.r - 28);
      }
      if (e.flash > 0) {
        ctx.fillStyle = "rgba(255,255,255,0.35)";
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r * 0.7, 0, Math.PI * 2);
        ctx.fill();
      }
      if (e.shield > 0 && e.shieldMax > 0 && !e.dead) {
        ctx.strokeStyle = "rgba(170, 220, 240, 0.9)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(e.x, e.y, e.r + 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * (e.shield / e.shieldMax));
        ctx.stroke();
      }
      if (!e.dead && (e.boss || e.shieldMax || e.hp < e.hpMax) && !e.dummy) {
        const w = e.boss ? 64 : 36;
        ctx.fillStyle = "#1a1212";
        ctx.fillRect(e.x - w / 2, e.y - e.r - 16, w, 4);
        ctx.fillStyle = "#c4473d";
        ctx.fillRect(e.x - w / 2, e.y - e.r - 16, w * clamp(e.hp / e.hpMax, 0, 1), 4);
      }
      if (e.groggy > 0 && !e.dead) {
        ctx.fillStyle = "#ffe08a";
        ctx.font = "12px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("파쇄", e.x, e.y - e.r - 22);
      }
    }

    if (player.guardT > 0) {
      ctx.strokeStyle = "rgba(160, 210, 230, 0.7)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(player.x, player.y, player.r + 10, 0, Math.PI * 2);
      ctx.stroke();
    }
    drawActor(player.x, player.y, player.r, player.facing, currentChar().color, weaponLook(), player.hurtFlash > 0 ? 0.55 : 1);

    for (const p of combat.projs) {
      ctx.strokeStyle = p.color || "#fff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03);
      ctx.stroke();
    }
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (const s of combat.slashes) {
      ctx.fillStyle = s.color || "#fff";
      ctx.globalAlpha = Math.max(0, s.life / s.max) * 0.45;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.arc(s.x, s.y, s.range, s.ang - s.arc / 2, s.ang + s.arc / 2);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of combat.bolts) {
      ctx.strokeStyle = "rgba(210, 230, 255, 0.9)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x1, b.y1);
      ctx.lineTo(b.x2, b.y2);
      ctx.stroke();
    }
    ctx.restore();
    for (const p of combat.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, p.size, p.size);
    }
    ctx.globalAlpha = 1;
    ctx.font = "700 14px sans-serif";
    ctx.textAlign = "center";
    for (const f of combat.floats) {
      ctx.globalAlpha = clamp(f.life / f.max, 0, 1);
      ctx.strokeStyle = "rgba(0,0,0,0.7)";
      ctx.lineWidth = 3;
      ctx.strokeText(f.text, f.x, f.y - (f.max - f.life) * 36);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x, f.y - (f.max - f.life) * 36);
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    if (!reduceMotion) {
      ctx.strokeStyle = "rgba(190, 210, 225, 0.28)";
      ctx.lineWidth = 1;
      for (const r of rain) {
        r.y += r.v * lastDt * 0.9;
        if (r.y > 1.1) r.y = -0.05;
        const x = r.x * viewW;
        const y = r.y * viewH;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - 6, y + r.len);
        ctx.stroke();
      }
    }
    const vig = ctx.createRadialGradient(viewW / 2, viewH / 2, viewW * 0.25, viewW / 2, viewH / 2, viewW * 0.72);
    vig.addColorStop(0, "rgba(0,0,0,0)");
    vig.addColorStop(1, "rgba(0,0,0,0.45)");
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, viewW, viewH);
    if (player.hp / player.hpMax < 0.35) {
      ctx.fillStyle = "rgba(120, 10, 16, 0.22)";
      ctx.fillRect(0, 0, viewW, viewH);
    }
    drawMinimap();
    syncHud();
  }

  function drawMinimap() {
    const w = minimap.width;
    const h = minimap.height;
    mctx.clearRect(0, 0, w, h);
    mctx.fillStyle = "rgba(8,10,14,0.2)";
    mctx.fillRect(0, 0, w, h);
    const sx = w / world.w;
    const sy = h / world.h;
    mctx.fillStyle = "#3a241c";
    mctx.fillRect(inn.x * sx, inn.y * sy, inn.w * sx, inn.h * sy);
    mctx.fillStyle = "#8a3038";
    for (const e of combat.enemies) {
      if (e.dead) continue;
      mctx.fillRect(e.x * sx - 1.5, e.y * sy - 1.5, e.boss ? 5 : 3, e.boss ? 5 : 3);
    }
    mctx.fillStyle = currentChar().color;
    mctx.beginPath();
    mctx.arc(player.x * sx, player.y * sy, 3, 0, Math.PI * 2);
    mctx.fill();
  }

  function syncHud() {
    const c = currentChar();
    document.getElementById("hud-name").textContent = c.name;
    document.getElementById("hud-sub").textContent = c.faction + " · 경지 " + run.level;
    document.getElementById("portrait").textContent = c.name.slice(0, 1);
    document.getElementById("portrait").style.borderColor = c.color;
    setBar("hp-fill", player.hp, player.hpMax);
    setBar("sh-fill", player.shield, Math.max(player.shieldMax, player.shield));
    setBar("qi-fill", player.qi, player.qiMax);
    setBar("xp-fill", run.xp, xpNeed(run.level));
    const script = activeScript();
    const wave = script[combat.wave] || script[0];
    let title = combat.mode === "training" ? "수련장" : (combat.phase === "intro" ? (combat.introTitle || "폭우가 객잔을 두드린다") : wave.title);
    if (combat.timeLimit && combat.phase !== "intro" && combat.phase !== "victory") {
      title += " · " + formatTime(Math.max(0, combat.timeLimit - combat.elapsed));
    }
    document.getElementById("wave-title").textContent = title;
    let synergy = mechanicLine();
    if (combat.gimmick === "bleed" && player.bleed > 0) synergy += " · 출혈 " + player.bleed + "/5";
    if (combat.gimmick === "fate" && combat.fateT > 0) synergy += " · 생사부 " + Math.ceil(combat.fateT);
    if (combat.gimmick === "balance" && combat.balanceT > 0) synergy += " · 균형 " + Math.ceil(combat.balanceT);
    document.getElementById("synergy").textContent = synergy;
    const pips = document.getElementById("pips");
    pips.hidden = c.mechanic !== "manryu";
    if (c.mechanic === "manryu") {
      pips.innerHTML = "";
      for (let i = 0; i < 5; i++) {
        const mark = document.createElement("i");
        if (i < player.synergy) mark.className = "on";
        pips.appendChild(mark);
      }
    }
    const boss = combat.enemies.find((e) => e.boss && !e.dead);
    const bossBar = document.getElementById("bossbar");
    bossBar.hidden = !boss;
    if (boss) {
      document.getElementById("boss-name").textContent = boss.title + " " + boss.name;
      setBar("boss-sh", boss.shield, boss.shieldMax);
      setBar("boss-hp", boss.hp, boss.hpMax);
    }
    for (const sk of c.skills) {
      const el = slotEls[sk.key];
      if (!el) continue;
      const left = player.cds[sk.key] || 0;
      el.querySelector(".cd").style.height = (sk.cd ? (left / sk.cd) * 100 : 0) + "%";
      el.classList.toggle("dim", left > 0.08 || player.qi < skillCost(sk));
    }
    const pots = document.querySelectorAll("#potions button");
    pots.forEach((b, i) => b.classList.toggle("empty", i >= combat.potions));
    const banner = document.getElementById("banner");
    if (combat.banner && combat.overlay === null) {
      banner.hidden = false;
      banner.querySelector("strong").textContent = combat.banner.title;
      banner.querySelector("span").textContent = combat.banner.sub;
    } else banner.hidden = true;
    document.getElementById("intro-card").hidden = combat.overlay !== "intro";
    document.getElementById("pause-card").hidden = combat.overlay !== "pause";
    const hover = hoveredEnemy();
    const base = "검흔+타격 = 내상 · 출혈+중독 = 혈독 · 빙결+뇌전 = 초전도";
    document.getElementById("hint").textContent = hover
      ? "조준 " + hover.name + "  " + (Object.keys(hover.statuses).join(" · ") || "상태 없음")
      : base;
    if (combat.mode === "training") {
      const now = combat.elapsed;
      const recent = combat.dmgEvents.filter((e) => now - e.t <= 5);
      const sum = recent.reduce((a, e) => a + e.v, 0);
      const span = Math.min(5, Math.max(now, 0.25));
      document.getElementById("dps-value").textContent = Math.round(sum / span).toLocaleString("ko-KR");
      const critRate = combat.hits ? Math.round((combat.crits / combat.hits) * 100) : 0;
      document.getElementById("dps-extra").textContent = "누적 " + Math.round(combat.total).toLocaleString("ko-KR")
        + "\n치명 " + critRate + "% · 상태 " + combat.statusApplies;
    }
  }

  function setBar(id, value, max) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.width = (max > 0 ? clamp(value / max, 0, 1) * 100 : 0) + "%";
  }

  function mechanicLine() {
    const c = currentChar();
    if (c.mechanic === "manryu") return "만류귀종 " + player.synergy + "/5 · 문파를 바꿔 치면 쌓인다";
    if (c.mechanic === "magi") return "마기 공명 · 직전 " + (player.lastSchool || "없음");
    if (c.mechanic === "manak") return "만악귀종 · 출혈과 중독이 겹치면 흡혈";
    if (c.mechanic === "shred") return "강기 파쇄 · 폭발 예상 " + Math.round(48 + player.shield * 2.15);
    if (c.mechanic === "storm") return "청룡 · 동정풍 뒤에 낙뢰";
    if (c.mechanic === "hwan") return "환골탈태 · " + (c.formName || "보타문");
    if (c.mechanic === "mask") return "천면변장 · " + (c.formName || "암살 낭인") + (c.dropBonus ? " · 전리품 안목" : "");
    if (c.mechanic === "graft") return player.counterT > 0 ? "이화접목 · 초식을 기다린다" : "이화접목 · 적의 초식을 되받아친다";
    if (c.mechanic === "blood") return "혈마 · 벤 상처를 피로 되돌린다";
    if (c.mechanic === "devour") return "도철포식 · 최종 절기는 하나";
    if (c.mechanic === "hunt") return "장강대해소 · 최종 절기는 하나";
    if (c.mechanic === "rage") return "치우강림 · 피가 줄수록 무겁다";
    if (c.mechanic === "samjae") return "삼재 " + ((player.samjae || 0) % 3) + "/3";
    return c.title;
  }

  function hoveredEnemy() {
    let best = null;
    let bestD = 1e9;
    for (const e of combat.enemies) {
      if (e.dead) continue;
      const d = Math.hypot(e.x - input.wx, e.y - input.wy);
      if (d < e.r + 18 && d < bestD) { best = e; bestD = d; }
    }
    return best;
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    viewW = Math.max(320, rect.width || window.innerWidth);
    viewH = Math.max(240, rect.height || window.innerHeight);
    pixelRatio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.floor(viewW * pixelRatio);
    canvas.height = Math.floor(viewH * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  }

  function makePlayer() {
    return {
      x: 1200, y: 520, r: 18, facing: -Math.PI / 2,
      hp: 1, hpMax: 1, shield: 0, shieldMax: 1, qi: 0, qiMax: 1,
      lastSchool: null, synergy: 0,
      cds: { Q: 0, W: 0, E: 0, R: 0 },
      swing: null, combo: 0, comboGap: 0, atkCd: 0,
      dashT: 0, dashCd: 0, dashA: 0,
      iframes: 0, hitstun: 0, hurtFlash: 0,
      guardT: 0, dr: 0, guardIcd: 0, shieldDelay: 0, potionCd: 0, qiWarn: 0, bleed: 0,
      counterT: 0,
      samjae: 0,
      stats: null,
    };
  }

  function buildSkillbar() {
    const root = document.getElementById("skills");
    root.innerHTML = "";
    for (const key of Object.keys(slotEls)) delete slotEls[key];
    const c = currentChar();
    root.appendChild(makeSlot("클릭", "평타", c.basic.name));
    for (const sk of c.skills) {
      const gem = gemLabel(sk.key);
      const el = makeSlot(sk.key, sk.name, gem ? sk.tag + " · " + gem : sk.tag);
      el.title = sk.name + "\n내공 " + sk.qi + " · 재사용 " + sk.cd + "초\n" + sk.desc;
      el.addEventListener("click", (ev) => {
        ev.stopPropagation();
        castSkill(sk);
      });
      slotEls[sk.key] = el;
      root.appendChild(el);
    }
    root.appendChild(makeSlot("Space", "경공", "피신"));
    const pot = document.getElementById("potions");
    pot.innerHTML = "";
    const n = 3 + ((player.stats && player.stats.potionsBonus) || 0);
    for (let i = 0; i < n; i++) {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = String(i + 1);
      b.title = "영약";
      b.addEventListener("click", (ev) => {
        ev.stopPropagation();
        drink();
      });
      pot.appendChild(b);
    }
  }

  function makeSlot(key, name, sub) {
    const el = document.createElement("button");
    el.type = "button";
    el.className = "slot";
    const em = document.createElement("em");
    em.textContent = key;
    const strong = document.createElement("strong");
    strong.textContent = name;
    const small = document.createElement("small");
    small.textContent = sub || "";
    const cd = document.createElement("i");
    cd.className = "cd";
    el.append(em, strong, small, cd);
    return el;
  }

  function dirById(id) {
    return GANGHO.directions.find((d) => d.id === id);
  }
  function mansionById(id) {
    return GANGHO.mansions.find((m) => m.id === id);
  }
  function starOf(id) {
    return (run.stars && run.stars[id]) || 0;
  }
  function starMarks(n) {
    return "★★★".slice(0, n) + "☆☆☆".slice(0, 3 - n);
  }
  function dirMastered(dirId) {
    return GANGHO.mansions.filter((m) => m.dir === dirId).every((m) => starOf(m.id) >= 3);
  }
  function ownsItem(id) {
    if (!id) return false;
    if (run.bag.some((it) => it.id === id)) return true;
    if ((run.stash || []).some((it) => it.id === id)) return true;
    return ["weapon", "armor", "charm", "jewel"].some((slot) => run.equip[slot] && run.equip[slot].id === id);
  }

  function mansionScript(m, dir, raid) {
    const tint = dir.color;
    const scale = (raid ? 1.25 : 0.78) * (1 + Math.max(0, GANGHO.mansions.filter((x) => x.dir === m.dir).findIndex((x) => x.id === m.id)) * 0.035);
    const waves = [
      {
        title: (raid ? dir.raidName : m.star + "수 · " + m.name),
        hint: raid ? dir.raidHint : dir.gimmickText,
        tint,
        groups: [{ type: "grunt", n: raid ? 8 : 6 }],
      },
      {
        title: "영물의 호위",
        hint: "별빛이 짙어진다.",
        tint,
        groups: [{ type: "grunt", n: raid ? 5 : 4 }, { type: "thrower", n: raid ? 3 : 2 }, { type: "elite", n: raid ? 2 : 1 }],
      },
      {
        title: raid ? dir.raidName : m.name,
        hint: raid ? dir.raidHint : dir.gimmickText,
        boss: true,
        bossName: raid ? dir.raidName : m.name,
        bossTitle: raid ? "타락한 신수" : m.star + "수",
        color: tint,
        hpMul: scale,
        adds: raid ? 3 : 2,
        pillars: raid ? 3 : 2,
        leftName: "현무의 거북",
        rightName: "현무의 뱀",
      },
    ];
    return waves;
  }

  function heavenById(id) {
    return GANGHO.heavens.find((h) => h.id === id) || null;
  }

  function trialById(id) {
    for (const heaven of GANGHO.heavens) {
      const trial = heaven.trials.find((t) => t.id === id);
      if (trial) return { trial, heaven };
    }
    return null;
  }

  function heavenStars(id, need) {
    const heaven = heavenById(id);
    return !!(heaven && heaven.trials.every((t) => starOf(t.id) >= need));
  }

  function polarisOpen() {
    return GANGHO.heavens.every((h) => h.trials.every((t) => starOf(t.id) >= 1));
  }

  function refreshPassives() {
    if (!run) return;
    run.namdu = heavenStars("namdu", 3);
    run.bukdu = heavenStars("bukdu", 3);
  }

  function heavenScript(found, polaris) {
    const tint = polaris ? "#f4efe2" : found.heaven.color;
    const who = polaris ? "태일천제" : found.trial.name;
    const title = polaris ? "북극성" : found.heaven.name;
    return [
      { title: polaris ? "생사부가 열린다" : found.heaven.name, hint: polaris ? "남두와 북두가 한 자리에서 맞선다." : found.heaven.gimmickText, tint, groups: [{ type: "grunt", n: 6 }, { type: "thrower", n: 2 }] },
      { title: "별이 떨어진다", hint: "자미원의 호위가 길을 막는다.", tint, groups: [{ type: "elite", n: 2 }, { type: "thrower", n: 2 }] },
      {
        title: who,
        hint: polaris ? "생의 빛과 사의 어둠을 한 박자로 부숴라." : found.heaven.gimmickText,
        boss: true,
        bossName: who,
        bossTitle: title,
        color: tint,
        hpMul: polaris ? 1.4 : 1.05,
        adds: 2,
      },
    ];
  }

  function dragonScript() {
    const tint = "#e6c56a";
    return [
      { title: "곤륜의 균열", hint: "사방의 별이 한 자리로 떨어진다.", tint, groups: [{ type: "grunt", n: 6 }, { type: "elite", n: 1 }] },
      { title: "지맥이 뒤집힌다", hint: "호신강기를 두른 영물이 길을 막는다.", tint, groups: [{ type: "elite", n: 2 }, { type: "thrower", n: 3 }] },
      {
        title: "태고 황룡",
        hint: "지맥 기둥을 부수면 용의 비늘이 갈라진다.",
        boss: true, bossName: "태고 황룡", bossTitle: "곤륜지주", color: tint, hpMul: 1.35, adds: 2, pillars: 4,
      },
    ];
  }

  function frontierById(id) {
    return (GANGHO.frontier || []).find((c) => c.id === id) || null;
  }

  function gatesCleared() {
    return (GANGHO.frontier || []).filter((c) => !c.gate).every((c) => ((run.frontier || {})[c.id] || 0) > 0);
  }

  function frontierOpen(ch) {
    if (!run || !run.fragment || !ch) return false;
    if (!ch.gate) return true;
    if (ch.gate === "gates") return gatesCleared();
    if (ch.gate === "mask") return !!run.unmasked;
    return false;
  }

  function frontierScript(ch) {
    return [
      {
        title: ch.name + "의 척후",
        hint: ch.hint || "세외의 병사가 밀려온다.",
        tint: ch.color,
        groups: [{ type: "grunt", n: 6 }, { type: "thrower", n: 2 }],
      },
      {
        title: "관문을 넘는 무리",
        hint: "정예가 앞장을 선다.",
        tint: ch.color,
        groups: [{ type: "elite", n: 2 }, { type: "grunt", n: 4 }],
      },
      {
        title: ch.boss,
        hint: ch.hint || "수장을 베면 관문이 닫힌다.",
        boss: true,
        bossName: ch.boss,
        bossTitle: ch.name,
        color: ch.color,
        hpMul: ch.hp || 1.15,
        adds: 2,
      },
    ];
  }

  function gemBook() {
    const boss = combat && combat.mode && combat.mode !== "story" && combat.mode !== "training";
    return boss ? (run.gemsBoss || {}) : (run.gems || {});
  }

  function gemLabel(key) {
    if (!run) return "";
    const id = gemBook()[key];
    const gem = (GANGHO.gems || []).find((g) => g.id === id);
    return gem ? gem.name.replace(" 구결", "") : "";
  }

  function tuneSkill(sk) {
    const id = run ? gemBook()[sk.key] : null;
    if (!id) return sk;
    const copy = Object.assign({}, sk);
    const statuses = (sk.statuses || []).slice();
    if (id === "yeol") {
      if (copy.kind === "proj") copy.count = (copy.count || 1) + 1;
      else {
        if (copy.range) copy.range = Math.round(copy.range * 1.18);
        if (copy.radius) copy.radius = Math.round(copy.radius * 1.15);
        if (copy.arc) copy.arc = Math.min(3.1, copy.arc * 1.2);
      }
    }
    if (id === "hyeol") statuses.push({ id: "출혈", t: 3, stacks: 1 });
    if (id === "gwan") copy.armorPierce = true;
    if (id === "heup") copy.lifesteal = (copy.lifesteal || 0) + 0.18;
    copy.statuses = statuses;
    return copy;
  }

  function spawnCompanion() {
    if (!run || !run.companion || !combat || !player) return;
    const ally = makeEnemy("grunt", player.x - 48, player.y + 36, 0.2, { name: "동행", color: "#d9c7a2" });
    ally.ally = true;
    ally.hp = ally.hpMax = 320;
    ally.dmg = 12;
    ally.xp = 0;
    combat.enemies.push(ally);
  }

  function startCombat(kind, missionId) {
    player = makePlayer();
    applyMaxStats(true);
    const mansion = kind === "mansion" ? mansionById(missionId) : null;
    const dir = mansion ? dirById(mansion.dir) : (kind === "raid" ? dirById(missionId) : null);
    let script = null;
    let gimmick = null;
    let danger = 1;
    let timeLimit = 0;
    let introKicker = "풍운객잔";
    let introTitle = "폭우의 습격";
    let introCopy = "장보도의 소문이 거짓인지 진짠지, 이 밤의 객잔은 상관하지 않는다. 살수단이 담을 넘었다. 문을 지키는 쪽이 먼저 살아남는다.";
    let hintText = "";
    if (kind === "mansion" && mansion && dir) {
      script = mansionScript(mansion, dir, false);
      gimmick = dir.gimmick;
      danger = 1.18;
      timeLimit = mansion.time;
      introKicker = dir.name;
      introTitle = mansion.star + "수 · " + mansion.name;
      introCopy = mansion.lore + ". " + dir.gimmickText + " 제한 시간 안에 깨면 별이 하나 더 붙고, 기믹을 풀면 성수 주얼이 떨어진다.";
    } else if (kind === "raid" && dir) {
      const sample = GANGHO.mansions.find((m) => m.dir === dir.id);
      script = mansionScript(sample, dir, true);
      gimmick = dir.gimmick;
      danger = 1.42;
      timeLimit = 150;
      introKicker = "타락한 신수";
      introTitle = dir.raidName;
      introCopy = dir.raidHint + " 일곱 별을 모두 세 별로 정복한 뒤에야 이 문이 열렸다.";
    } else if (kind === "dragon") {
      script = dragonScript();
      gimmick = "pillars";
      danger = 1.55;
      timeLimit = 180;
      introKicker = "중앙 황룡";
      introTitle = "태고 황룡 · 곤륜지주";
      introCopy = "사신수가 쓰러진 자리, 곤륜의 균열. 지맥 기둥 넷을 부순 뒤에야 황룡의 비늘이 갈라진다.";
    } else if (kind === "heaven") {
      const found = trialById(missionId);
      if (found) {
        script = heavenScript(found, false);
        gimmick = found.heaven.gimmick;
        danger = 1.35;
        timeLimit = found.trial.time;
        introKicker = "자미원 · " + found.heaven.name;
        introTitle = found.trial.star + " · " + found.trial.name;
        introCopy = found.heaven.element + ". " + found.heaven.gimmickText;
        hintText = found.heaven.gimmickText;
      }
    } else if (kind === "polaris") {
      const found = trialById(GANGHO.heavens[0].trials[0].id);
      script = heavenScript(found, true);
      gimmick = "balance";
      danger = 1.65;
      timeLimit = 190;
      introKicker = "자미원 · 북극성";
      introTitle = "태일천제";
      introCopy = "남두의 생과 북두의 사를 한 박자로 가라앉혀야 옥좌가 정화된다.";
      hintText = "생의 빛과 사의 어둠을 이어서 부숴라. 한쪽만 꺼지면 기둥이 다시 선다.";
    } else if (kind === "frontier") {
      const ch = frontierById(missionId);
      if (ch && frontierOpen(ch)) {
        script = frontierScript(ch);
        gimmick = ch.gimmick || null;
        danger = ch.danger || 1.25;
        timeLimit = ch.time || 140;
        introKicker = "세외일통맹";
        introTitle = ch.name + " · " + ch.boss;
        introCopy = ch.lore;
        hintText = ch.hint || "";
      }
    }
    if (kind === "frontier" && !script) return;
    combat = {
      mode: kind,
      missionId: missionId || null,
      phase: "intro",
      overlay: "intro",
      wave: 0,
      elapsed: 0,
      enemies: [],
      projs: [],
      zones: [],
      telegraphs: [],
      floats: [],
      particles: [],
      drops: [],
      decals: [],
      timers: [],
      bolts: [],
      slashes: [],
      trail: [],
      shake: 0,
      hitstop: 0,
      banner: null,
      potions: 3 + (player.stats.potionsBonus || 0),
      dmgEvents: [],
      total: 0,
      hits: 0,
      crits: 0,
      statusApplies: 0,
      kills: 0,
      breakT: 0,
      script,
      gimmick,
      gimmickOk: gimmick !== "pillars" && gimmick !== "egg" && gimmick !== "regen" && gimmick !== "fate" && gimmick !== "balance",
      revived: false,
      danger,
      timeLimit,
      introTitle,
    };
    if (!floorCanvas) paintFloor();
    buildSkillbar();
    const training = kind === "training";
    document.getElementById("intro-kicker").textContent = training ? "수련장" : introKicker;
    document.getElementById("intro-title").textContent = training ? "허수아비" : introTitle;
    document.getElementById("intro-copy").textContent = training
      ? "거점 마당의 허수아비다. 최근 다섯 초의 피해로 무공의 무게를 재 본다. 죽지 않으니 경맥과 장비를 바꿔 가며 두드려도 된다."
      : introCopy;
    document.getElementById("btn-fight").textContent = training ? "수련을 시작한다" : "검을 뽑는다";
    document.getElementById("dps").hidden = !training;
    document.getElementById("hint").textContent = hintText
      || (gimmick ? (dir ? dir.gimmickText : "지맥 기둥을 먼저 부숴라.") : "검흔+타격 = 내상 · 출혈+중독 = 혈독 · 빙결+뇌전 = 초전도");
    showScreen("screen-combat");
    resize();
    requestAnimationFrame(resize);
  }

  function beginFight() {
    if (!combat || combat.overlay !== "intro") return;
    combat.overlay = null;
    combat.phase = "fight";
    combat.elapsed = 0;
    if (combat.mode === "training") {
      const dummy = makeEnemy("dummy", 1200, 980, 0);
      dummy.hp = dummy.hpMax = 999999;
      combat.enemies = [dummy];
      showBanner("수련 허수아비", "최근 다섯 초의 피해로 빌드를 가늠한다.");
      return;
    }
    spawnWave(0);
    spawnCompanion();
  }

  function gimmickLine() {
    const ok = combat.gimmickOk;
    if (combat.gimmick === "pillars") return ok ? "기둥을 먼저 부쉈다" : "기둥이 남아 비늘이 버텼다";
    if (combat.gimmick === "duo") return ok ? "거북과 뱀을 함께 끝냈다" : "한쪽이 다시 일어났다";
    if (combat.gimmick === "bleed") return ok ? "살성을 경공으로 끊었다" : "출혈 다섯 겹에 반격을 맞았다";
    if (combat.gimmick === "egg") return ok ? "불사의 알을 깨뜨렸다" : "알이 부화했다";
    if (combat.gimmick === "regen") return ok ? "생의 기둥을 끊어 변이를 막았다" : "생이 끊기지 않아 몸이 되살아났다";
    if (combat.gimmick === "fate") return ok ? "생사부 각인을 지웠다" : "수명이 다하도록 기둥이 남았다";
    if (combat.gimmick === "balance") return ok ? "생과 사를 한 박자로 닫았다" : "음양이 어긋나 기둥이 다시 섰다";
    return "";
  }

  function finishConstellation() {
    if (!combat || combat.phase === "victory") return;
    combat.phase = "victory";
    combat.overlay = "dead";
    collectAll();
    const timed = !combat.timeLimit || combat.elapsed <= combat.timeLimit;
    const stars = 1 + (timed ? 1 : 0) + (combat.gimmickOk ? 1 : 0);
    const id = combat.missionId;
    run.stars = run.stars || {};
    run.raids = run.raids || {};
    if ((combat.mode === "mansion" || combat.mode === "heaven") && id) run.stars[id] = Math.max(run.stars[id] || 0, stars);
    if (combat.mode === "raid" && id) {
      run.raids[id] = Math.max(run.raids[id] || 0, stars);
    }
    if (combat.mode === "dragon") run.dragon = true;
    if (combat.mode === "polaris") run.polaris = true;
    refreshPassives();
    let gained = "";
    if (combat.mode === "frontier" && id) {
      run.frontier = run.frontier || {};
      run.frontier[id] = Math.max(run.frontier[id] || 0, stars);
      const ch = frontierById(id);
      if (ch && ch.reward && !ownsItem(ch.reward)) {
        const item = createItem(ch.reward);
        if (item) { run.bag.push(item); gained = item.name; }
      }
      if (ch && ch.seal === "mask") run.unmasked = true;
      if (ch && ch.seal === "sanhae") run.sanhae = true;
    }
    if (combat.mode === "mansion" && stars >= 3) {
      const jid = "jewel_" + id;
      if (!ownsItem(jid)) {
        const item = createItem(jid);
        if (item) { run.bag.push(item); gained = item.name; }
      }
    }
    if (combat.mode === "raid") {
      const dir = dirById(id);
      if (dir && !ownsItem(dir.raidReward)) {
        const item = createItem(dir.raidReward);
        if (item) { run.bag.push(item); gained = item.name; }
      }
    }
    persist();
    const root = document.getElementById("result-inner");
    root.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = combat.mode === "dragon" ? "곤륜이 잠잠해진다" : (combat.mode === "polaris" ? "생사부가 닫힌다" : (combat.mode === "heaven" ? "자미원이 기운다" : (combat.mode === "frontier" ? "관문 너머가 잠잠해진다" : "별이 가라앉는다")));
    const p = document.createElement("p");
    p.className = "story";
    const mansion = combat.mode === "mansion" ? mansionById(id) : null;
    const found = combat.mode === "heaven" ? trialById(id) : null;
    const chapter = combat.mode === "frontier" ? frontierById(id) : null;
    const dir = combat.mode === "raid" ? dirById(id) : (mansion ? dirById(mansion.dir) : null);
    const who = combat.mode === "dragon" ? "태고 황룡" : (combat.mode === "polaris" ? "태일천제" : (found ? found.trial.name : (chapter ? chapter.boss : (dir && combat.mode === "raid" ? dir.raidName : (mansion ? mansion.name : "별자리")))));
    p.textContent = who + ". 객잔 마당의 별빛 아래로 가라앉았다. " + gimmickLine();
    const meta = document.createElement("p");
    meta.textContent = starMarks(stars) + " · " + formatTime(combat.elapsed) + (combat.timeLimit ? " / " + formatTime(combat.timeLimit) : "") + (gained ? " · " + gained : "");
    root.append(h, p, meta);
    if (combat.mode === "dragon" && !run.dragonReward) {
      const row = document.createElement("div");
      row.className = "reward-row";
      for (const rid of ["heonwon", "bango", "gonryun"]) {
        const item = GANGHO.items[rid];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reward";
        const mark = document.createElement("i");
        mark.textContent = GANGHO.gradeName[item.grade];
        mark.style.color = GANGHO.gradeColor[item.grade];
        const name = document.createElement("b");
        name.textContent = item.name;
        const desc = document.createElement("p");
        desc.textContent = item.desc;
        btn.append(mark, name, desc);
        btn.addEventListener("click", () => {
          run.dragonReward = true;
          takeReward(rid);
        });
        row.appendChild(btn);
      }
      root.appendChild(row);
    } else if (combat.mode === "polaris" && !run.polarisReward) {
      const row = document.createElement("div");
      row.className = "reward-row";
      for (const rid of ["saenggyeong", "sagyeong", "taeilpae"]) {
        const item = GANGHO.items[rid];
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "reward";
        const mark = document.createElement("i");
        mark.textContent = GANGHO.gradeName[item.grade];
        mark.style.color = GANGHO.gradeColor[item.grade];
        const name = document.createElement("b");
        name.textContent = item.name;
        const desc = document.createElement("p");
        desc.textContent = item.desc;
        btn.append(mark, name, desc);
        btn.addEventListener("click", () => {
          run.polarisReward = true;
          takeReward(rid);
        });
        row.appendChild(btn);
      }
      root.appendChild(row);
    } else {
      const actions = document.createElement("div");
      actions.className = "result-actions";
      const back = document.createElement("button");
      back.type = "button";
      back.className = "primary";
      back.textContent = "객잔으로";
      back.addEventListener("click", showHub);
      actions.appendChild(back);
      root.appendChild(actions);
    }
    showScreen("screen-result");
    sfx.tone(392, 0.18, "triangle", 0.04, 1.3);
  }

  function onVictory() {
    if (!combat || combat.phase === "victory") return;
    if (combat.mode !== "story") {
      finishConstellation();
      return;
    }
    combat.phase = "victory";
    combat.overlay = "dead";
    collectAll();
    run.fragment = true;
    run.clears += 1;
    if (!run.bestTime || combat.elapsed < run.bestTime) run.bestTime = combat.elapsed;
    persist();
    const c = currentChar();
    const root = document.getElementById("result-inner");
    root.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = "살아남은 밤";
    const p = document.createElement("p");
    p.className = "story";
    p.textContent = "살수단은 객잔 마당에 쓰러졌다. 야율한의 품에서 순양장보도의 파편이 구르고, 본산은 당신의 검의를 인정해 전승 신병 하나를 내린다. 세외의 그림자는 아직 관문 밖에 있다.";
    const meta = document.createElement("p");
    meta.textContent = "걸린 시간 " + formatTime(combat.elapsed) + " · 처치 " + combat.kills + " · 경지 " + run.level;
    const row = document.createElement("div");
    row.className = "reward-row";
    for (const id of c.rewards) {
      const item = GANGHO.items[id];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "reward";
      const mark = document.createElement("i");
      mark.textContent = GANGHO.gradeName[item.grade];
      mark.style.color = GANGHO.gradeColor[item.grade];
      const name = document.createElement("b");
      name.textContent = item.name;
      const desc = document.createElement("p");
      desc.textContent = item.desc;
      btn.append(mark, name, desc);
      btn.addEventListener("click", () => takeReward(id));
      row.appendChild(btn);
    }
    root.append(h, p, meta, row);
    showScreen("screen-result");
    sfx.tone(330, 0.2, "triangle", 0.04, 1.4);
  }

  function takeReward(id) {
    const item = createItem(id);
    const slot = item.slot || "weapon";
    const prev = run.equip[slot];
    run.equip[slot] = item;
    if (prev) run.bag.push(prev);
    if (player) applyMaxStats(false);
    persist();
    toast("하사: " + item.name);
    showHub();
  }

  function onDeath() {
    if (!combat || combat.phase === "dead" || combat.phase === "victory") return;
    combat.phase = "dead";
    combat.overlay = "dead";
    collectAll();
    persist();
    const root = document.getElementById("result-inner");
    root.innerHTML = "";
    const h = document.createElement("h2");
    h.textContent = "비가 피를 씻는다";
    const p = document.createElement("p");
    p.className = "story";
    p.textContent = "객잔 마당에서 무릎이 꺾였다. 주운 병기는 품 안에 남았고, 살수는 아직 담 위에 있다. 경맥은 닫히지 않았다.";
    const actions = document.createElement("div");
    actions.className = "result-actions";
    const again = document.createElement("button");
    again.className = "primary";
    again.type = "button";
    again.textContent = "다시 칼을 뽑는다";
    again.addEventListener("click", () => startCombat(combat.mode === "training" ? "training" : "story"));
    const back = document.createElement("button");
    back.className = "ghost";
    back.type = "button";
    back.textContent = "객잔으로";
    back.addEventListener("click", showHub);
    actions.append(again, back);
    root.append(h, p, actions);
    showScreen("screen-result");
  }

  function formatTime(t) {
    const s = Math.max(0, Math.floor(t));
    return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0");
  }

  function refreshTitle() {
    document.getElementById("btn-enter").textContent = run ? "귀환" : "입문";
  }

  function renderRoster() {
    const root = document.getElementById("roster");
    root.innerHTML = "";
    for (const entry of GANGHO.roster) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      if (entry.locked) {
        btn.disabled = true;
        fillCard(btn, entry.factionId, entry.faction, entry.name, entry.role, entry.desc, "비급이 아직 도착하지 않았다");
      } else {
        const c = charById(entry.characterId);
        fillCard(btn, c.factionId, c.faction, c.name, c.role, c.summary, c.power < 1 ? "위력 85% · 최종 절기 없음" : c.title);
        if (selectedId === c.id) btn.classList.add("selected");
        btn.addEventListener("click", () => {
          selectedId = c.id;
          const blurb = document.getElementById("select-blurb");
          blurb.textContent = c.summary;
          const confirm = document.getElementById("btn-confirm");
          confirm.disabled = false;
          if (run && run.charId === c.id) confirm.textContent = "객잔으로 돌아간다";
          else if (run) confirm.textContent = "이 무인으로 새로 시작한다";
          else confirm.textContent = "풍운객잔으로";
          renderRoster();
        });
      }
      root.appendChild(btn);
    }
    renderDlc();
  }

  function dlcUnlocked() {
    return !!((run && run.polaris) || readLegacy().polaris);
  }

  function renderDlc() {
    const roster = document.getElementById("roster");
    let root = document.getElementById("dlc-roster");
    if (!root && roster && roster.parentNode) {
      root = document.createElement("div");
      root.id = "dlc-roster";
      roster.parentNode.insertBefore(root, roster.nextSibling);
    }
    if (!root) return;
    root.innerHTML = "";
    const open = dlcUnlocked();
    for (const entry of GANGHO.dlc || []) {
      const c = charById(entry.characterId);
      if (!c) continue;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "card";
      if (!open) {
        btn.disabled = true;
        fillCard(btn, c.factionId, c.faction, c.name, c.role, c.summary, "북극성을 닫은 뒤에 비급이 도착한다");
      } else {
        fillCard(btn, c.factionId, c.faction, c.name, c.role, c.summary, c.title);
        if (selectedId === c.id) btn.classList.add("selected");
        btn.addEventListener("click", () => {
          selectedId = c.id;
          document.getElementById("select-blurb").textContent = c.summary;
          const confirm = document.getElementById("btn-confirm");
          confirm.disabled = false;
          if (run && run.charId === c.id) confirm.textContent = "객잔으로 돌아간다";
          else if (run) confirm.textContent = "이 무인으로 새로 시작한다";
          else confirm.textContent = "풍운객잔으로";
          renderRoster();
        });
      }
      root.appendChild(btn);
    }
  }

  function fillCard(btn, factionId, faction, name, role, desc, foot) {
    const fac = document.createElement("div");
    fac.className = "tag-fac " + factionId;
    fac.textContent = faction;
    const who = document.createElement("div");
    who.className = "who";
    who.textContent = name;
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.textContent = role;
    const body = document.createElement("p");
    body.className = "desc";
    body.textContent = desc;
    const lock = document.createElement("div");
    lock.className = "lock";
    lock.textContent = foot;
    btn.append(fac, who, meta, body, lock);
  }

  function showSelect() {
    changeArmed = false;
    showScreen("screen-select");
    renderRoster();
  }

  function cycleForm() {
    const base = charById(run.charId);
    if (!base || !base.forms) return;
    let back = 0;
    for (const node of GANGHO.nodes) if (run.nodes[node.id]) back += node.cost;
    run.nodes = {};
    run.points += back;
    const i = Math.max(0, base.forms.findIndex((f) => f.id === run.form));
    const next = base.forms[(i + 1) % base.forms.length];
    run.form = next.id;
    if (player) applyMaxStats(false);
    persist();
    toast((base.mechanic === "hwan" ? "환골탈태 · " : "천면변장 · ") + next.name);
    showHub();
  }

  function showHub() {
    if (!run) { showSelect(); return; }
    refreshPassives();
    changeArmed = false;
    showScreen("screen-hub");
    const c = currentChar();
    const fac = document.getElementById("hub-faction");
    fac.textContent = c.faction + " · " + c.role;
    fac.className = "eyebrow tag-fac " + c.factionId;
    document.getElementById("hub-name").textContent = c.formName ? c.name + " · " + c.formName : c.name;
    const formBtn = document.getElementById("btn-form");
    const base = charById(run.charId);
    if (base && base.forms) {
      formBtn.hidden = false;
      formBtn.textContent = (base.mechanic === "hwan" ? "환골탈태" : "천면변장") + " · " + c.formName;
    } else formBtn.hidden = true;
    document.getElementById("hub-story").textContent = run.sanhae
      ? "산해경의 흉수가 다시 봉인되었다. 세외의 그림자는 관문 안에서 숨을 죽인다."
      : (run.unmasked
        ? "가면 뒤의 옛 사제가 뜻을 밝혔다. 산해경의 흉수가 동쪽 바다에서 깨어난다."
        : (run.polaris
          ? "북극성이 제자리로 돌아갔다. 생사부가 닫히고, 치우와 해동의 비급이 객잔에 도착했다."
          : (run.dragon
            ? "황룡이 곤륜에서 잠들었다. 역류한 기운이 자미원의 생사부를 더럽히고, 남두와 북두가 땅에 떨어졌다."
            : (run.fragment
              ? "장보도 파편이 뜨거워졌다. 스물여덟 별자리가 땅에 떨어지고, 세외의 여섯 관문이 함께 열렸다."
              : "태평은 칼날 위에 있다. 순양장보도가 나왔다는 소문 아래, 폭우가 풍운객잔의 등을 끈다."))));
    document.getElementById("quest-title").textContent = run.clears ? "객잔 주인 · 다시 그 밤으로" : "객잔 주인 · 프롤로그";
    const weapon = run.equip.weapon ? run.equip.weapon.name : "맨손";
    const best = run.bestTime ? formatTime(run.bestTime) : "없음";
    document.getElementById("hub-stats").textContent = "";
    const lines = [
      "경지 " + run.level + " · 혈점 " + run.points,
      "병기 " + weapon,
      "밤을 넘긴 횟수 " + run.clears,
      "가장 짧은 밤 " + best,
      "가방 " + run.bag.length,
      "별자리 " + GANGHO.mansions.filter((m) => starOf(m.id) > 0).length + "/28",
    ];
    if (c.formSummary) lines.splice(1, 0, c.formSummary);
    const stock = run.stock || {};
    const held = GANGHO.ores.filter((o) => stock[o.id] > 0).map((o) => o.name + " " + stock[o.id]);
    if (held.length) lines.push("소재 " + held.join(" · "));
    if (run.dragon) {
      const n = GANGHO.heavens.reduce((sum, h) => sum + h.trials.filter((t) => starOf(t.id) > 0).length, 0);
      lines.push("자미원 " + n + "/13" + (run.namdu ? " · 남두주생" : "") + (run.bukdu ? " · 북두주사" : ""));
    }
    if (run.fragment) {
      const gates = (GANGHO.frontier || []).filter((c) => !c.gate && ((run.frontier || {})[c.id] || 0) > 0).length;
      lines.push("세외 관문 " + gates + "/6" + (run.unmasked ? " · 흑막" : "") + (run.sanhae ? " · 산해경" : ""));
    }
    const stashN = (run.stash || []).length;
    if (stashN) lines.push("창고 " + stashN);
    for (const line of lines) {
      const div = document.createElement("div");
      div.textContent = line;
      document.getElementById("hub-stats").appendChild(div);
    }
    const allyBtn = document.getElementById("btn-ally");
    if (allyBtn) allyBtn.textContent = run.companion ? "동행 · 함께 선다" : "동행 · 홀로 선다";
    renderConstellation();
    renderFrontier();
  }

  function renderFrontier() {
    const board = document.getElementById("frontier-board");
    const title = document.getElementById("frontier-title");
    const copy = document.getElementById("frontier-copy");
    const box = document.getElementById("frontier");
    if (!board || !box) return;
    if (!run.fragment) {
      box.classList.remove("open");
      title.textContent = "세외일통맹 · 봉인";
      copy.textContent = "장보도 파편이 뜨거워진 뒤에야 여섯 관문이 열린다. 동영, 초원, 북해, 혈교, 서장, 남만. 그 뒤에 가면과 산해경이 있다.";
      board.hidden = true;
      board.innerHTML = "";
      return;
    }
    box.classList.add("open");
    title.textContent = "세외일통맹";
    copy.textContent = "여섯 관문을 닫으면 가면 뒤의 사제가 모습을 드러낸다. 그 뜻을 들은 뒤에야 산해경의 흉수가 깨어난다. 객잔과 프롤로그는 광역 구결을, 이 관문은 보스 구결을 쓴다.";
    board.hidden = false;
    board.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "star-board";
    for (const ch of GANGHO.frontier || []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "place";
      btn.dataset.kind = "frontier";
      btn.dataset.mission = ch.id;
      const open = frontierOpen(ch);
      btn.disabled = !open;
      const strong = document.createElement("strong");
      const stars = (run.frontier || {})[ch.id] || 0;
      strong.textContent = ch.name + " · " + ch.boss + (stars ? " " + starMarks(stars) : "");
      strong.style.color = ch.color;
      const span = document.createElement("span");
      span.textContent = open ? ch.lore : (ch.gate === "mask" ? "흑막을 걷은 뒤에 산해경이 열린다." : "여섯 관문을 모두 닫아야 한다.");
      btn.append(strong, span);
      grid.appendChild(btn);
    }
    board.appendChild(grid);
  }

  function renderConstellation() {
    const board = document.getElementById("constellation-board");
    const title = document.getElementById("constellation-title");
    const copy = document.getElementById("constellation-copy");
    const box = document.getElementById("constellation");
    if (!run.fragment) {
      box.classList.remove("open");
      title.textContent = "성수비경 · 봉인";
      copy.textContent = "동방 청룡, 북방 현무, 서방 백호, 남방 주작, 그리고 중앙의 황룡. 지맥이 무너진 뒤에야 스물여덟 별자리가 땅에 떨어진다. 이 밤의 이야기는 아직 객잔 마당에서 끝난다.";
      board.hidden = true;
      board.innerHTML = "";
      return;
    }
    box.classList.add("open");
    title.textContent = "성수비경";
    copy.textContent = "별 하나마다 처치, 제한 시간, 방위 기믹이 별 세 개다. 한 방위를 모두 세 별로 정복하면 타락한 신수가 문을 연다. 사신수 넷이 쓰러지면 중앙의 황룡이 깨어난다.";
    board.hidden = false;
    board.innerHTML = "";
    const grid = document.createElement("div");
    grid.className = "star-board";
    for (const dir of GANGHO.directions) {
      const col = document.createElement("section");
      col.className = "star-col";
      const h = document.createElement("h4");
      h.textContent = dir.name;
      h.style.color = dir.color;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = dir.element + " · " + dir.gimmickText;
      col.append(h, meta);
      for (const m of GANGHO.mansions.filter((x) => x.dir === dir.id)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mansion";
        btn.dataset.kind = "mansion";
        btn.dataset.mission = m.id;
        const label = document.createElement("span");
        label.textContent = m.name === m.star + "수" ? m.name : m.star + "수 · " + m.name;
        const marks = document.createElement("span");
        marks.className = "stars";
        marks.textContent = starMarks(starOf(m.id));
        btn.append(label, marks);
        col.appendChild(btn);
      }
      const raid = document.createElement("button");
      raid.type = "button";
      raid.className = "raid-btn";
      raid.dataset.kind = "raid";
      raid.dataset.mission = dir.id;
      raid.disabled = !dirMastered(dir.id);
      const raidLabel = document.createElement("span");
      raidLabel.textContent = raid.disabled ? dir.raidName + " · 봉인" : dir.raidName;
      const raidStars = document.createElement("span");
      raidStars.className = "stars";
      raidStars.textContent = run.raids && run.raids[dir.id] ? starMarks(run.raids[dir.id]) : "";
      raid.append(raidLabel, raidStars);
      col.appendChild(raid);
      grid.appendChild(col);
    }
    const dragon = document.createElement("button");
    dragon.type = "button";
    dragon.className = "raid-btn dragon-row";
    dragon.dataset.kind = "dragon";
    dragon.dataset.mission = "dragon";
    const opened = GANGHO.directions.every((d) => run.raids && run.raids[d.id]);
    dragon.disabled = !opened;
    dragon.textContent = opened ? "태고 황룡 · 곤륜지주" : "태고 황룡 · 사신수 넷이 쓰러져야 한다";
    board.append(grid, dragon);
    if (!run.dragon) {
      const seal = document.createElement("p");
      seal.className = "meta heaven-wrap";
      seal.textContent = "황룡이 잠든 뒤에야 생사부가 열린다.";
      board.appendChild(seal);
      return;
    }
    const wrap = document.createElement("div");
    wrap.className = "heaven-wrap";
    const head = document.createElement("h3");
    head.textContent = "자미원 · 생사부";
    const note = document.createElement("p");
    note.className = "meta";
    note.textContent = "남두 여섯과 북두 일곱을 한 번이라도 닫으면 북극성이 열린다. 한 무리를 모두 세 별로 닫으면 생사경이 몸에 남는다.";
    const heavens = document.createElement("div");
    heavens.className = "star-board";
    for (const heaven of GANGHO.heavens) {
      const col = document.createElement("section");
      col.className = "star-col";
      const h = document.createElement("h4");
      h.textContent = heaven.name + (heavenStars(heaven.id, 3) ? " · 각인" : "");
      h.style.color = heaven.color;
      const meta = document.createElement("div");
      meta.className = "meta";
      meta.textContent = heaven.element + " · " + heaven.gimmickText;
      col.append(h, meta);
      for (const trial of heaven.trials) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mansion";
        btn.dataset.kind = "heaven";
        btn.dataset.mission = trial.id;
        const label = document.createElement("span");
        label.textContent = trial.star + " · " + trial.name;
        const marks = document.createElement("span");
        marks.className = "stars";
        marks.textContent = starMarks(starOf(trial.id));
        btn.append(label, marks);
        col.appendChild(btn);
      }
      heavens.appendChild(col);
    }
    const polar = document.createElement("button");
    polar.type = "button";
    polar.className = "raid-btn dragon-row";
    polar.dataset.kind = "polaris";
    polar.dataset.mission = "polaris";
    const gate = polarisOpen();
    polar.disabled = !gate;
    polar.textContent = gate ? "북극성 · 태일천제" : "북극성 · 남두와 북두를 한 번씩";
    wrap.append(head, note, heavens, polar);
    board.appendChild(wrap);
  }

  function openModal(kind) {
    const modal = document.getElementById("modal");
    modal.hidden = false;
    if (mode === "combat" && combat) combat.overlay = "modal";
    if (kind === "tree") renderTree();
    else if (kind === "shop") renderShop();
    else renderGear();
  }

  function closeModal() {
    document.getElementById("modal").hidden = true;
    if (mode === "combat" && combat && combat.overlay === "modal") combat.overlay = null;
    if (mode === "hub") showHub();
    if (mode === "combat" && player) {
      applyMaxStats(false);
      buildSkillbar();
    }
  }

  function smallNodes() {
    return GANGHO.nodes.filter((n) => !n.keystone && run.nodes[n.id]).length;
  }

  function renderTree() {
    document.getElementById("modal-title").textContent = "주천경맥도";
    const body = document.getElementById("modal-body");
    body.innerHTML = "";
    const note = document.createElement("p");
    note.className = "modal-note";
    note.textContent = "남은 혈점 " + run.points + ". 소속 진영마다 출발하는 경맥은 다르나, 이 객잔의 도면은 같은 혈자리를 펼쳐 둔다. 주화입마는 모든 무공 위력을 올리고, 맞는 아픔도 키운다.";
    const grid = document.createElement("div");
    grid.className = "node-grid";
    for (const node of GANGHO.nodes) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "node" + (run.nodes[node.id] ? " on" : "") + (node.keystone ? " key" : "");
      const strong = document.createElement("strong");
      strong.textContent = node.name;
      const span = document.createElement("span");
      span.textContent = node.desc;
      const em = document.createElement("em");
      em.textContent = node.cost + "점";
      btn.append(strong, span, em);
      btn.disabled = !!run.nodes[node.id];
      btn.addEventListener("click", () => allocate(node.id));
      grid.appendChild(btn);
    }
    const refund = document.createElement("button");
    refund.type = "button";
    refund.className = "ghost";
    refund.id = "btn-refund";
    refund.textContent = "경맥 초기화";
    refund.addEventListener("click", () => {
      let back = 0;
      for (const node of GANGHO.nodes) if (run.nodes[node.id]) back += node.cost;
      run.nodes = {};
      run.points += back;
      if (player) applyMaxStats(false);
      persist();
      toast("경맥을 되돌렸다");
      renderTree();
    });
    body.append(note, grid, refund);
  }

  function allocate(id) {
    const node = GANGHO.nodes.find((n) => n.id === id);
    if (!node || run.nodes[id]) return;
    if (run.points < node.cost) { toast("혈점이 부족하다"); return; }
    if (node.need && smallNodes() < node.need) { toast("작은 혈자리 둘을 먼저 열어야 한다"); return; }
    run.points -= node.cost;
    run.nodes[id] = true;
    if (player) applyMaxStats(false);
    persist();
    sfx.tone(480, 0.06, "sine", 0.03, 1.4);
    renderTree();
  }

  function statBits(it) {
    if (!it) return "비어 있음";
    const bits = [];
    if (it.dmg) bits.push("위력 +" + Math.round(it.dmg * 100) + "%");
    if (it.aspd) bits.push("속도 +" + Math.round(it.aspd * 100) + "%");
    if (it.shieldMul) bits.push("파쇄 +" + Math.round(it.shieldMul * 100) + "%");
    if (it.qiCost) bits.push("내공 소모 " + Math.round(it.qiCost * 100) + "%");
    if (it.hp) bits.push("생명 +" + it.hp);
    if (it.shield) bits.push("강기 +" + it.shield);
    if (it.armor) bits.push("방어 +" + it.armor);
    if (it.crit) bits.push("치명 +" + Math.round(it.crit * 100) + "%");
    if (it.lifesteal) bits.push("흡혈 +" + Math.round(it.lifesteal * 100) + "%");
    if (it.projResist) bits.push("암기 저항 +" + Math.round(it.projResist * 100) + "%");
    if (it.potion) bits.push("영약 +" + Math.round(it.potion * 100) + "%");
    if (it.shieldOnHit) bits.push("타격 시 강기 +" + it.shieldOnHit);
    if (it.move) bits.push("이동 +" + Math.round(it.move * 100) + "%");
    if (it.qi) bits.push("내공 +" + it.qi);
    if (it.qiRegen) bits.push("내공 회복 +" + it.qiRegen);
    if (it.inlay === "han") bits.push("만년한철 상감");
    return bits.join(" · ") || it.desc;
  }

  function renderGear() {
    document.getElementById("modal-title").textContent = "신병로";
    const body = document.getElementById("modal-body");
    body.innerHTML = "";
    const note = document.createElement("p");
    note.className = "modal-note";
    note.textContent = "문파가 아니라 무공에 맞춰 병기를 고른다. 입문에서 기철까지는 녹여 소재가 되고, 전승과 신화는 녹이지 않는다.";
    const layout = document.createElement("div");
    layout.className = "gear-layout";
    const left = document.createElement("div");
    for (const slot of [["weapon", "병기"], ["armor", "의복"], ["charm", "호신부"], ["jewel", "성수 주얼"]]) {
      const it = run.equip[slot[0]];
      const el = document.createElement("div");
      el.className = "equip-slot";
      const lab = document.createElement("div");
      lab.className = "meta";
      lab.textContent = slot[1];
      const name = document.createElement("strong");
      name.textContent = it ? it.name : "비어 있음";
      const sub = document.createElement("div");
      sub.textContent = it ? statBits(it) : "";
      el.append(lab, name, sub);
      left.appendChild(el);
    }
    const right = document.createElement("div");
    right.className = "bag-list";
    if (!run.bag.length) {
      const empty = document.createElement("p");
      empty.className = "modal-note";
      empty.textContent = "아직 전리품이 없다. 살수의 품에서 철과 비단이 떨어진다.";
      right.appendChild(empty);
    }
    const bag = run.bag.slice().sort((a, b) => b.grade - a.grade || a.name.localeCompare(b.name, "ko"));
    for (const it of bag) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "bag-item";
      const grade = document.createElement("div");
      grade.className = "grade";
      grade.style.color = GANGHO.gradeColor[it.grade];
      grade.textContent = GANGHO.gradeName[it.grade] + " · " + slotLabel(it.slot);
      const name = document.createElement("strong");
      name.textContent = it.name;
      const sub = document.createElement("div");
      sub.textContent = it.desc;
      btn.append(grade, name, sub);
      btn.addEventListener("click", () => equipFromBag(it.uid));
      const row = document.createElement("div");
      row.className = "bag-row";
      row.appendChild(btn);
      if (GANGHO.scrap[it.grade]) {
        const scrap = document.createElement("button");
        scrap.type = "button";
        scrap.className = "ghost scrap";
        scrap.textContent = "녹인다";
        scrap.addEventListener("click", () => scrapItem(it.uid));
        row.appendChild(scrap);
      }
      const store = document.createElement("button");
      store.type = "button";
      store.className = "ghost scrap";
      store.textContent = "맡긴다";
      store.addEventListener("click", () => stashItem(it.uid));
      row.appendChild(store);
      right.appendChild(row);
    }
    layout.append(left, right);
    const stashHead = document.createElement("h3");
    stashHead.textContent = "공용 창고";
    const stashBox = document.createElement("div");
    stashBox.className = "bag-list";
    const held = run.stash || [];
    if (!held.length) {
      const emptyStash = document.createElement("p");
      emptyStash.className = "modal-note";
      emptyStash.textContent = "창고가 비어 있다. 맡긴 병기는 무인을 바꿔도 이 객잔에 남는다.";
      stashBox.appendChild(emptyStash);
    }
    for (const it of held) {
      const row = document.createElement("div");
      row.className = "bag-row";
      const name = document.createElement("span");
      name.textContent = GANGHO.gradeName[it.grade] + " " + it.name;
      const take = document.createElement("button");
      take.type = "button";
      take.className = "ghost scrap";
      take.textContent = "꺼낸다";
      take.addEventListener("click", () => takeStash(it.uid));
      row.append(name, take);
      stashBox.appendChild(row);
    }
    const stock = document.createElement("div");
    stock.className = "ore-line";
    for (const ore of GANGHO.ores) {
      const bit = document.createElement("span");
      bit.textContent = ore.name + " " + ((run.stock && run.stock[ore.id]) || 0);
      stock.appendChild(bit);
    }
    const head = document.createElement("h3");
    head.textContent = "제련";
    const recipes = document.createElement("div");
    recipes.className = "recipe-grid";
    for (const rec of GANGHO.recipes) {
      const item = GANGHO.items[rec.item];
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "recipe";
      btn.disabled = !canPay(rec.cost);
      const title = document.createElement("b");
      title.textContent = item.name;
      title.style.color = GANGHO.gradeColor[item.grade];
      const sub = document.createElement("span");
      sub.textContent = costLine(rec.cost);
      btn.append(title, sub);
      btn.addEventListener("click", () => craftRecipe(rec));
      recipes.appendChild(btn);
    }
    const inlay = document.createElement("button");
    inlay.type = "button";
    inlay.className = "ghost";
    const weapon = run.equip.weapon;
    if (weapon && weapon.inlay === "han") {
      inlay.disabled = true;
      inlay.textContent = "만년한철이 이미 스며 있다";
    } else {
      inlay.disabled = !weapon || !canPay({ han: 1 });
      inlay.textContent = "만년한철 상감 · 만년한철 1";
      inlay.addEventListener("click", inlayWeapon);
    }
    body.append(note, stock, layout, stashHead, stashBox, head, recipes, inlay);
  }

  function slotLabel(slot) {
    if (slot === "weapon") return "병기";
    if (slot === "armor") return "의복";
    if (slot === "jewel") return "주얼";
    return "호신부";
  }

  function craftRecipe(rec) {
    if (!canPay(rec.cost)) { toast("소재가 부족하다"); return; }
    const item = createItem(rec.item);
    if (!item) return;
    pay(rec.cost);
    run.bag.push(item);
    persist();
    toast("벼림: " + item.name);
    sfx.tone(320, 0.08, "triangle", 0.04, 1.2);
    renderGear();
  }

  function stashItem(uid) {
    const idx = run.bag.findIndex((it) => it.uid === uid);
    if (idx < 0) return;
    run.stash = run.stash || [];
    run.stash.push(run.bag.splice(idx, 1)[0]);
    persist();
    toast("창고에 맡겼다");
    renderGear();
  }

  function takeStash(uid) {
    const idx = (run.stash || []).findIndex((it) => it.uid === uid);
    if (idx < 0) return;
    run.bag.push(run.stash.splice(idx, 1)[0]);
    persist();
    toast("가방으로 꺼냈다");
    renderGear();
  }

  function renderShop() {
    const body = document.getElementById("modal-body");
    body.innerHTML = "";
    const note = document.createElement("p");
    note.className = "modal-note";
    note.textContent = shopBook === "boss"
      ? "보스 구결. 별자리와 세외, 자미원에서 이 칸이 켜진다."
      : "광역 구결. 객잔의 밤과 수련장에서 이 칸이 켜진다.";
    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "ghost";
    toggle.textContent = shopBook === "boss" ? "광역 구결로" : "보스 구결로";
    toggle.addEventListener("click", () => {
      shopBook = shopBook === "boss" ? "field" : "boss";
      renderShop();
    });
    const stock = document.createElement("div");
    stock.className = "ore-line";
    for (const ore of GANGHO.ores) {
      const bit = document.createElement("span");
      bit.textContent = ore.name + " " + ((run.stock && run.stock[ore.id]) || 0);
      stock.appendChild(bit);
    }
    const grid = document.createElement("div");
    grid.className = "recipe-grid";
    const book = shopBook === "boss" ? (run.gemsBoss = run.gemsBoss || {}) : (run.gems = run.gems || {});
    for (const gem of GANGHO.gems) {
      const card = document.createElement("div");
      card.className = "equip-slot";
      const name = document.createElement("strong");
      name.textContent = gem.name;
      const desc = document.createElement("div");
      desc.textContent = gem.desc;
      const owned = (run.ownedGems || []).includes(gem.id);
      const buy = document.createElement("button");
      buy.type = "button";
      buy.className = "ghost";
      buy.textContent = owned ? "이미 품안" : ("산다 · " + costLine(gem.cost));
      buy.disabled = owned;
      buy.addEventListener("click", () => buyGem(gem));
      card.append(name, desc, buy);
      if (owned) {
        const row = document.createElement("div");
        row.className = "bag-row";
        for (const key of ["Q", "W", "E", "R"]) {
          const b = document.createElement("button");
          b.type = "button";
          b.className = "ghost scrap";
          b.textContent = book[key] === gem.id ? key + " 끼움" : key;
          b.addEventListener("click", () => socketGem(key, gem.id));
          row.appendChild(b);
        }
        card.appendChild(row);
      }
      grid.appendChild(card);
    }
    body.append(note, toggle, stock, grid);
  }

  function buyGem(gem) {
    run.ownedGems = run.ownedGems || [];
    if (run.ownedGems.includes(gem.id)) return;
    if (!canPay(gem.cost)) { toast("소재가 부족하다"); return; }
    pay(gem.cost);
    run.ownedGems.push(gem.id);
    persist();
    toast(gem.name + "을 샀다");
    renderShop();
  }

  function socketGem(key, gemId) {
    const book = shopBook === "boss" ? (run.gemsBoss = run.gemsBoss || {}) : (run.gems = run.gems || {});
    book[key] = book[key] === gemId ? null : gemId;
    persist();
    renderShop();
    if (mode === "combat" && player) buildSkillbar();
  }

  function scrapItem(uid) {
    const idx = run.bag.findIndex((it) => it.uid === uid);
    if (idx < 0) return;
    const it = run.bag[idx];
    const gain = GANGHO.scrap[it.grade];
    if (!gain) { toast("전승과 신화는 녹이지 않는다"); return; }
    run.bag.splice(idx, 1);
    for (const id of Object.keys(gain)) gainOre(id, gain[id]);
    persist();
    toast(it.name + "을 녹였다");
    renderGear();
  }

  function inlayWeapon() {
    const weapon = run.equip.weapon;
    if (!weapon || weapon.inlay === "han") return;
    if (!canPay({ han: 1 })) { toast("만년한철이 없다"); return; }
    pay({ han: 1 });
    weapon.inlay = "han";
    if (player) applyMaxStats(false);
    persist();
    toast("만년한철이 날에 스몄다");
    sfx.tone(280, 0.1, "sine", 0.04, 1.1);
    renderGear();
  }

  function equipFromBag(itemUid) {
    const idx = run.bag.findIndex((b) => b.uid === itemUid);
    if (idx < 0) return;
    const item = run.bag[idx];
    run.bag.splice(idx, 1);
    const prev = run.equip[item.slot];
    run.equip[item.slot] = item;
    if (prev) run.bag.push(prev);
    if (player) applyMaxStats(false);
    persist();
    toast("장착: " + item.name);
    renderGear();
  }

  function refreshSoundButtons() {
    document.querySelectorAll("[data-sound]").forEach((b) => {
      b.textContent = soundOn ? "소리 켜짐" : "소리 꺼짐";
    });
  }

  function toggleSound() {
    soundOn = !soundOn;
    try { localStorage.setItem("gangho-sound", soundOn ? "1" : "0"); } catch (err) { /* ignore */ }
    refreshSoundButtons();
    if (soundOn) sfx.tone(520, 0.05, "sine", 0.03, 1.2);
  }

  function onKeyDown(e) {
    if (["Space", "Tab", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.code)) e.preventDefault();
    input.keys[e.code] = true;
    if (e.repeat) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (mode === "combat" && combat) {
      if (e.code === "Escape") {
        if (!document.getElementById("modal").hidden) { closeModal(); return; }
        if (combat.overlay === "pause") { combat.overlay = null; return; }
        if (combat.overlay === null && combat.phase !== "intro") { combat.overlay = "pause"; return; }
      }
      if (e.code === "Enter" && combat.overlay === "intro") { beginFight(); return; }
      if (combat.overlay === null || combat.overlay === "intro") {
        if (e.code === "Space" || e.code === "ShiftLeft" || e.code === "ShiftRight") tryDash();
      }
      if (combat.overlay === null) {
        const skill = currentChar().skills.find((sk) => sk.key === e.code.replace("Key", ""));
        if (skill && e.code.startsWith("Key")) castSkill(skill);
        if (e.code === "Digit1" || e.code === "Digit2" || e.code === "Digit3") drink();
        if (e.code === "KeyK") openModal("tree");
        if (e.code === "Tab") openModal("gear");
      }
    }
  }

  function onMissionClick(e) {
    const btn = e.target.closest("[data-kind]");
    if (!btn || btn.disabled) return;
    startCombat(btn.dataset.kind, btn.dataset.mission);
  }

  function boot() {
    run = loadRun();
    refreshPassives();
    refreshTitle();
    refreshSoundButtons();
    document.getElementById("btn-enter").addEventListener("click", () => {
      sfx.ensure();
      if (run) showHub();
      else showSelect();
    });
    document.getElementById("btn-pick").addEventListener("click", () => { sfx.ensure(); showSelect(); });
    document.getElementById("btn-wipe").addEventListener("click", () => {
      try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(LEGACY_KEY); } catch (err) { /* ignore */ }
      run = null;
      selectedId = null;
      refreshTitle();
      toast("기록을 지웠다");
    });
    document.querySelectorAll("[data-sound]").forEach((b) => b.addEventListener("click", toggleSound));
    document.getElementById("btn-back-title").addEventListener("click", () => { refreshTitle(); showScreen("screen-title"); });
    document.getElementById("btn-hub-title").addEventListener("click", () => { refreshTitle(); showScreen("screen-title"); });
    document.getElementById("btn-confirm").addEventListener("click", () => {
      if (!selectedId) return;
      if (run && run.charId === selectedId) { showHub(); return; }
      const prev = run;
      run = freshRun(selectedId);
      if (prev) {
        run.stash = (prev.stash || []).slice();
        run.stock = Object.assign({}, prev.stock || {});
        run.ownedGems = (prev.ownedGems || []).slice();
        run.gems = Object.assign({}, prev.gems || {});
        run.gemsBoss = Object.assign({}, prev.gemsBoss || {});
        run.companion = !!prev.companion;
      }
      persist();
      showHub();
    });
    document.getElementById("constellation-board").addEventListener("click", onMissionClick);
    const frontierBoard = document.getElementById("frontier-board");
    if (frontierBoard) frontierBoard.addEventListener("click", onMissionClick);
    document.getElementById("place-quest").addEventListener("click", () => startCombat("story"));
    document.getElementById("place-train").addEventListener("click", () => startCombat("training"));
    document.getElementById("place-gear").addEventListener("click", () => openModal("gear"));
    document.getElementById("place-shop").addEventListener("click", () => openModal("shop"));
    document.getElementById("place-tree").addEventListener("click", () => openModal("tree"));
    document.getElementById("btn-ally").addEventListener("click", () => {
      if (!run) return;
      run.companion = !run.companion;
      persist();
      showHub();
      toast(run.companion ? "동행이 곁에 선다. 적의 표적은 여전히 당신이다." : "홀로 선다.");
    });
    document.getElementById("btn-form").addEventListener("click", cycleForm);
    document.getElementById("btn-change-char").addEventListener("click", () => {
      if (!changeArmed) {
        changeArmed = true;
        toast("한 번 더 누르면 이 무인의 경맥과 장비가 사라진다");
        return;
      }
      showSelect();
    });
    document.getElementById("btn-fight").addEventListener("click", beginFight);
    document.getElementById("btn-resume").addEventListener("click", () => { if (combat) combat.overlay = null; });
    document.getElementById("btn-pause-tree").addEventListener("click", () => openModal("tree"));
    document.getElementById("btn-pause-gear").addEventListener("click", () => openModal("gear"));
    document.getElementById("btn-retreat").addEventListener("click", () => {
      if (combat) collectAll();
      persist();
      showHub();
    });
    document.getElementById("btn-leave-train").addEventListener("click", () => {
      persist();
      showHub();
    });
    document.getElementById("modal-close").addEventListener("click", closeModal);
    document.getElementById("modal-back").addEventListener("click", closeModal);

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", (e) => { input.keys[e.code] = false; });
    window.addEventListener("blur", () => { input.keys = {}; input.mouseDown = false; });
    canvas.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      input.mouseDown = true;
      input.cx = e.clientX;
      input.cy = e.clientY;
      input.hasMouse = true;
    });
    window.addEventListener("mouseup", () => { input.mouseDown = false; });
    window.addEventListener("mousemove", (e) => {
      input.cx = e.clientX;
      input.cy = e.clientY;
      input.hasMouse = true;
    });
    canvas.addEventListener("contextmenu", (e) => {
      e.preventDefault();
      tryDash();
    });
    window.addEventListener("resize", resize);

    let last = performance.now();
    function frame(now) {
      const dt = Math.min(0.033, (now - last) / 1000 || 0.016);
      last = now;
      lastDt = dt || 0.016;
      if (!fatalOn && mode === "combat") {
        try {
          update(dt);
          render();
        } catch (err) {
          fatalOn = true;
          console.error(err);
          const el = document.getElementById("fatal");
          el.hidden = false;
          el.textContent = (err && err.stack) || String(err);
        }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);

    window.Gangho = {
      get mode() { return mode; },
      get run() { return run; },
      get player() { return player; },
      get combat() { return combat; },
      killAll() {
        if (!combat) return;
        for (const e of combat.enemies.slice()) {
          if (!e.dead && !e.dummy) {
            e.spawnT = 0;
            e.hp = 0;
            killEnemy(e);
          }
        }
      },
    };
  }

  boot();
})();
