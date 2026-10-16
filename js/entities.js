'use strict';
// =====================================================================
//  ENTIDADES — jugador, enemigos y jefes con un único motor de ataques
//  dirigido por datos, proyectiles, peligros (círculos retardados,
//  ondas expansivas, charcos, rayos) y efectos visuales.
// =====================================================================

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const dist = (a, b, c, d) => Math.hypot(c - a, d - b);
function angDiff(a, b) { let d = (a - b) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
function compact(arr, keep) { let j = 0; for (let i = 0; i < arr.length; i++) if (keep(arr[i])) arr[j++] = arr[i]; arr.length = j; }
function rotTo(a, b, max) { const d = angDiff(b, a); return a + clamp(d, -max, max); }

let S = null; // estado de la partida
let P = null; // jugador

// ---------------------------------------------------------------- efectos
function addFx(o) { if (S.fx.length < (LOWQ() ? 220 : 500)) S.fx.push(o); }
function burst(x, y, col, n, spd, life, sz, grav) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU, v = rnd(spd * 0.3, spd);
    addFx({ k: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, t: 0, life: rnd(life * 0.5, life), col, sz: sz || 3, g: grav || 0 });
  }
}
function slashFx(x, y, a, arc, r, col, rev, life) { addFx({ k: 'slash', x, y, a, arc, r, col: col || '#ffffff', rev, t: 0, life: life || 0.16 }); }
function dmgText(x, y, txt, col, big) { if (!SAVE.settings.dmgNums) return; S.texts.push({ x: x + rnd(-8, 8), y, txt, col, t: 0, big }); }
function shake(v) { S.shake = Math.max(S.shake, v * (SAVE.settings.shake ? 1 : 0.35)); }
function toast(txt, icon, n) { S.toasts.push({ txt, icon, n, t: 0 }); if (S.toasts.length > 5) S.toasts.shift(); }
function banner(txt, col, sub) { S.banner = { txt, col: col || '#ffd43b', sub, t: 0, life: 3.2 }; }

const ST_COL = { poison: '#7ee36b', burn: '#ff8a2a', frost: '#8ff3ff', slow: '#e8e0c8' };

// ---------------------------------------------------------------- jugador: estadísticas
function ringOn(id) { return P.ringEq[0] === id || P.ringEq[1] === id; }
function pLevel() { return P.stats.vig + P.stats.end + P.stats.str + P.stats.dex - 39; }
function levelCost(L) { return Math.round(240 * Math.pow(1.09, L - 1) + 25 * L); }
function maxHP() { return Math.round((50 + P.stats.vig * 5 + Math.max(0, P.stats.vig - 25) * 2) * (ringOn('anillo_vida') ? 1.2 : 1)); }
function maxSta() { return 50 + P.stats.end * 5; }
function healAmt() { return Math.round(maxHP() * (0.4 + P.ceniza * 0.08)); }
function weaponDmg(id) {
  const w = WEAPONS[id || P.weapon], up = P.wlv[id || P.weapon] || 0;
  let d = w.dmg * (1 + 0.13 * up) + (P.stats.str - 10) * w.sS * 1.1 + (P.stats.dex - 10) * w.sD * 1.1;
  if (ringOn('anillo_ira')) d *= 1.15;
  return Math.max(1, d);
}
function scaleLetter(v) { return v >= 1.2 ? 'S' : v >= 0.9 ? 'A' : v >= 0.65 ? 'B' : v >= 0.4 ? 'C' : v > 0 ? 'D' : '-'; }

function newPlayer() {
  return {
    x: tw(100), y: tw(102), r: 13, vx: 0, vy: 0, aim: -Math.PI / 2, st: 'move', t: 0,
    hp: 100, sta: 100, souls: 0, stats: { vig: 10, end: 10, str: 10, dex: 10 },
    inv: {}, weapons: ['espada_corta'], wlv: {}, weapon: 'espada_corta', rings: [], ringEq: [null, null],
    flaskMax: 3, flasks: 3, ceniza: 0, quick: 0, iframe: 0, flash: 0, staDelay: 0,
    buf: { herb: 0, resin: 0 }, sts: { pb: 0, poison: 0, burn: 0, fb: 0, frost: 0, slow: 0 },
    lastBf: 'bf_hub', lit: { bf_hub: true }, atk: null, combo: 0, comboT: 0, rollA: 0, healed: false, dead: false,
    stepT: 0,
  };
}

// ---------------------------------------------------------------- daño al jugador
function hurtPlayer(dmg, sx, sy, st, stv) {
  if (P.dead || P.iframe > 0 || rollIframe() || S.mode !== 'play') return false;
  let d = dmg * (ringOn('anillo_acero') ? 0.85 : 1);
  d = Math.max(1, Math.round(d * rnd(0.95, 1.05)));
  P.hp -= d; P.iframe = 0.5; P.flash = 0.2;
  dmgText(P.x, P.y - 40, d, '#ff5a5a', d >= 30);
  sfx('hurt'); shake(Math.min(12, 4 + d / 5));
  burst(P.x, P.y - 10, '#c0303a', 10, 180, 0.5, 3, 300);
  if (st) applyPStatus(st, stv || 30);
  // interrumpe acciones y retrocede
  const a = Math.atan2(P.y - sy, P.x - sx);
  if (P.st === 'drink') { toast('¡Has derramado el frasco!'); }
  if (P.st !== 'roll') { P.st = 'stagger'; P.t = 0; P.atk = null; P.kx = Math.cos(a) * 260; P.ky = Math.sin(a) * 260; }
  if (P.hp <= 0) playerDie();
  return true;
}
function applyPStatus(st, v) {
  const s = P.sts;
  if (st === 'poison') { s.pb += v; if (s.pb >= 100) { s.pb = 0; s.poison = 14; toast('Envenenado', null); } }
  else if (st === 'frost') { s.fb += v; if (s.fb >= 100) { s.fb = 0; s.frost = 8; P.hp -= 12; dmgText(P.x, P.y - 50, 'CONGELADO', '#8ff3ff'); } }
  else if (st === 'burn') { s.burn = Math.max(s.burn, 3); }
  else if (st === 'slow') { s.slow = Math.max(s.slow, 2.5); }
}

// ---------------------------------------------------------------- enemigos
function makeMob(type, x, y, o) {
  const d = MOBS[type]; o = o || {};
  const tier = o.tier || 1, hpM = d.boss ? 1 : (1 + (tier - 1) * 1.25), dM = d.boss || d.mini ? 1 : (1 + (tier - 1) * 0.75);
  const hp = Math.round(d.hp * hpM * (d.mini ? 1 : 1));
  return {
    type, d, x, y, hx: x, hy: y, vx: 0, vy: 0, r: d.r, hp, max: hp, dmgM: dM, soulsM: d.boss || d.mini ? 1 : tier,
    sc: d.sc || 3, spr: d.spr, st: 'idle', t: 0, a: null, ph: null, aim: 0, flip: false, cds: {}, pz: d.poise, flash: 0,
    z: 0, alpha: 1, boss: !!d.boss, mini: !!d.mini, id: o.id || null, losT: Math.random() * 0.3, seen: false,
    wanderT: rnd(1, 4), wx: x, wy: y, pois: 0, burn: 0, slow: 0, phase: 0, tm: 1, spdM: 1, chainQ: null, last: null,
    summon: !!o.summon, owner: o.owner || null, dead: false, lostT: 0, hitCd: 0, invuln: 0, anim: Math.random() * 10,
  };
}

function mobUse(m) {
  if (m.d.phases) return m.d.phases[m.phase].use;
  if (!m._use) m._use = Object.keys(m.d.atks).filter(k => !m.d.atks[k].noPick);
  return m._use;
}

function mobSpeed(m) { return m.d.spd * m.spdM * (m.slow > 0 ? 0.6 : 1); }

function moveMob(m, dx, dy) {
  if (m.d.fly) return moveEnt(m, dx, dy, m.r * 0.8);
  const tt = tileAtW(m.x, m.y);
  if (tt === T_WATER && !m.d.swim) { dx *= 0.6; dy *= 0.6; }
  return moveEnt(m, dx, dy, m.r * 0.8);
}

function updateMob(m, dt) {
  m.anim += dt;
  if (m.flash > 0) m.flash -= dt;
  if (m.hitCd > 0) m.hitCd -= dt;
  if (m.invuln > 0) m.invuln -= dt;
  for (const k in m.cds) if (m.cds[k] > 0) m.cds[k] -= dt;
  // estados alterados
  if (m.pois > 0) { m.pois -= dt; m._pt = (m._pt || 0) + dt; if (m._pt >= 0.5) { m._pt = 0; damageMobRaw(m, Math.max(2, m.max * (m.boss ? 0.006 : 0.03)), '#7ee36b'); } }
  if (m.burn > 0) { m.burn -= dt; m._bt = (m._bt || 0) + dt; if (m._bt >= 0.5) { m._bt = 0; damageMobRaw(m, 4, '#ff8a2a'); } }
  if (m.slow > 0) m.slow -= dt;
  if (m.dead) return;
  const dx = P.x - m.x, dy = P.y - m.y, dP = Math.hypot(dx, dy);
  m.dP = dP;
  // fases de jefe
  if (m.d.phases && m.phase + 1 < m.d.phases.length && m.hp / m.max <= m.d.phases[m.phase + 1].at) {
    m.phase++;
    const ph = m.d.phases[m.phase];
    m.tm = ph.tm || 1; m.spdM = ph.spd || 1;
    if (ph.spr) m.spr = ph.spr;
    if (ph.name) S.bossName = ph.name;
    m.st = 'intro'; m.t = 0; m.a = null; m.invuln = 1.4; m.chainQ = null;
    sfx('roar'); shake(14); burst(m.x, m.y - 30, m.boss && m.type === 'eclipse' ? '#b066ff' : '#ffffff', 40, 400, 1, 4);
    addHz({ k: 'ring', x: m.x, y: m.y, r: 20, spd: 420, w: 30, max: 500, dmg: 20, col: '#ffffff', own: 0 });
    return;
  }
  switch (m.st) {
    case 'intro':
      m.t += dt; if (m.t > 1.3) { m.st = 'chase'; m.t = 0; }
      return;
    case 'stagger':
      m.t += dt;
      moveMob(m, m.vx * dt, m.vy * dt); m.vx *= 0.88; m.vy *= 0.88;
      if (m.t > 0.55) { m.st = 'chase'; m.t = 0; }
      return;
    case 'atk': updAtk(m, dt); return;
    case 'return': {
      const hd = dist(m.x, m.y, m.hx, m.hy);
      if (hd < 20) { m.st = 'idle'; m.hp = m.max; m.seen = false; return; }
      const sp = mobSpeed(m) * dt;
      moveMob(m, (m.hx - m.x) / hd * sp, (m.hy - m.y) / hd * sp);
      m.flip = m.hx < m.x;
      m.losT -= dt;
      if (m.losT <= 0) { m.losT = 0.3; if (dP < m.d.sight * 0.6 && los(m.x, m.y, P.x, P.y)) aggro(m); }
      return;
    }
    case 'idle': {
      m.losT -= dt;
      if (m.losT <= 0) {
        m.losT = 0.25;
        const sight = m.d.sight * (ringOn('anillo_sigilo') ? 0.6 : 1);
        if (!P.dead && (dP < sight && los(m.x, m.y, P.x, P.y) || dP < 70)) aggro(m);
      }
      m.wanderT -= dt;
      if (m.wanderT <= 0) { m.wanderT = rnd(2, 5); const a = Math.random() * TAU; m.wx = m.hx + Math.cos(a) * rnd(0, 90); m.wy = m.hy + Math.sin(a) * rnd(0, 90); }
      const wd = dist(m.x, m.y, m.wx, m.wy);
      if (wd > 8) { const sp = mobSpeed(m) * 0.35 * dt; moveMob(m, (m.wx - m.x) / wd * sp, (m.wy - m.y) / wd * sp); m.flip = m.wx < m.x; }
      return;
    }
    case 'chase': {
      if (P.dead) { m.st = 'return'; return; }
      // abandono de la persecución
      if (!m.boss && !m.summon) {
        const home = dist(m.x, m.y, m.hx, m.hy);
        if (home > (m.mini ? 1100 : 1000) || dP > 1000) { m.st = 'return'; return; }
        m.losT -= dt;
        if (m.losT <= 0) { m.losT = 0.4; m.vis = los(m.x, m.y, P.x, P.y); }
        if (m.vis === false) { m.lostT += dt; if (m.lostT > 6) { m.st = 'return'; m.lostT = 0; return; } } else m.lostT = 0;
      }
      m.aim = Math.atan2(dy, dx);
      m.flip = dx < 0;
      // elegir ataque
      const use = mobUse(m);
      const cands = [];
      for (const id of use) {
        const a = m.d.atks[id];
        if ((m.cds[id] || 0) > 0) continue;
        if (dP > a.range + P.r || dP < (a.min || 0)) continue;
        if (a.t === 'summon' && countSummons(m) >= a.cap) continue;
        if ((a.t === 'shoot' || a.t === 'nova' || a.t === 'line') && m.vis === false && !m.boss) continue;
        cands.push(id);
      }
      m.t += dt;
      if (cands.length && m.t > (m.boss ? 0.25 : 0.35) * m.tm) {
        let pool = cands;
        if (m.boss && cands.length > 1 && m.last) { const f = cands.filter(c => c !== m.last); if (f.length) pool = f; }
        const id = pool[Math.floor(Math.random() * pool.length)];
        startAtk(m, id);
        return;
      }
      // moverse
      const sp = mobSpeed(m) * dt;
      let mx = 0, my = 0;
      if (m.d.keep) {
        if (dP > m.d.keep * 1.1) { mx = dx / dP; my = dy / dP; }
        else if (dP < m.d.keep * 0.7) { mx = -dx / dP; my = -dy / dP; }
        else { const s = Math.sin(m.anim * 0.7 + m.hx) > 0 ? 1 : -1; mx = -dy / dP * s * 0.6; my = dx / dP * s * 0.6; }
      } else {
        const close = m.r + P.r + 10;
        if (dP > close) { mx = dx / dP; my = dy / dP; }
      }
      if (m.d.erratic) { mx += Math.cos(m.anim * 5) * 0.6; my += Math.sin(m.anim * 4.3) * 0.6; }
      if (mx || my) {
        const hit = moveMob(m, mx * sp, my * sp);
        if (hit && !m.d.fly) { // rodear muros: probar perpendicular
          const s = (Math.floor(m.anim / 1.5) % 2) ? 1 : -1;
          moveMob(m, -my * sp * s, mx * sp * s);
        }
      }
      return;
    }
  }
}

function aggro(m) {
  if (m.st === 'chase' || m.st === 'atk') return;
  m.st = 'chase'; m.t = 0; m.seen = true; m.vis = true;
  addFx({ k: 'alert', x: m.x, y: m.y - m.r - 30, t: 0, life: 0.7, m });
  // alerta a la manada
  for (const o of S.mobs) if (o !== m && !o.dead && o.st === 'idle' && dist(o.x, o.y, m.x, m.y) < 220) { o.st = 'chase'; o.t = 0; o.vis = true; }
}

function countSummons(m) { let n = 0; for (const o of S.mobs) if (o.owner === m && !o.dead) n++; return n; }

// ---------------------------------------------------------------- motor de ataques
function startAtk(m, id) {
  const a = m.d.atks[id];
  m.st = 'atk'; m.a = a; m.ph = 'wind'; m.t = 0; m.hit = false; m.k = 0; m.k2 = 0;
  m.aim = Math.atan2(P.y - m.y, P.x - m.x); m.tx = P.x; m.ty = P.y;
  m.cds[id] = a.cd || 0; m.last = id;
  if (a.chain && !m.chainQ) m.chainQ = a.chain.slice();
  if (a.roar) sfx('roar');
  if (a.t === 'beam') m.bdir = Math.random() < 0.5 ? 1 : -1;
  if ((m.boss || m.mini) && a.t !== 'melee' && m.dP < 900) sfx('windup');
}

function updAtk(m, dt) {
  const a = m.a;
  m.t += dt;
  if (m.ph === 'wind') {
    const W = a.wind * m.tm;
    if (a.track !== 0 && m.t < W * 0.8) {
      m.aim = rotTo(m.aim, Math.atan2(P.y - m.y, P.x - m.x), (m.boss ? 4 : 3) * dt);
      m.tx = P.x; m.ty = P.y;
    }
    m.flip = Math.cos(m.aim) < 0;
    if (a.t === 'teleport') m.alpha = 1 - m.t / W * 0.3;
    if (m.t >= W) { m.ph = 'act'; m.t = 0; actStart(m, a); }
  } else if (m.ph === 'act') {
    actUpdate(m, a, dt);
    if (m.ph === 'act' && m.t >= a.act) { m.ph = 'rec'; m.t = 0; actEnd(m, a); }
  } else if (m.ph === 'rec') {
    if (m.t >= a.rec * m.tm) {
      m.z = 0; m.alpha = 1; m.hidden = false;
      if (m.chainQ && m.chainQ.length) {
        const nx = m.chainQ.shift(), rest = m.chainQ.length ? m.chainQ : null;
        m.chainQ = rest; startAtk(m, nx); if (rest) m.chainQ = rest; return;
      }
      m.chainQ = null;
      m.st = 'chase'; m.t = 0; m.a = null;
    }
  }
}

function inSector(px, py, pr, ox, oy, aim, reach, arc) {
  const d = Math.hypot(px - ox, py - oy);
  if (d > reach + pr) return false;
  if (arc >= TAU - 0.01 || d < pr + 6) return true;
  return Math.abs(angDiff(Math.atan2(py - oy, px - ox), aim)) <= arc / 2 + Math.atan2(pr, Math.max(d, 1));
}

function actStart(m, a) {
  const D = (v) => Math.round(v * m.dmgM);
  switch (a.t) {
    case 'melee':
      m.dash = (a.step || 0) / Math.max(a.act, 0.05);
      sfx(m.boss || m.mini ? 'heavy' : 'swing');
      slashFx(m.x, m.y, m.aim, a.arc, a.reach + m.r * 0.5, m.boss ? '#ffd0d0' : '#ffffff', a.rev, Math.max(0.16, a.act));
      break;
    case 'charge': m.dash = a.spd; m.cx0 = m.x; m.cy0 = m.y; sfx('heavy'); break;
    case 'leap': {
      if (a.hide) { m.tx = P.x; m.ty = P.y; }
      let d = dist(m.x, m.y, m.tx, m.ty);
      if (d > a.maxd) { m.tx = m.x + (m.tx - m.x) / d * a.maxd; m.ty = m.y + (m.ty - m.y) / d * a.maxd; d = a.maxd; }
      if (!freeSpot(m.tx, m.ty, m.r * 0.6)) { m.tx = m.x; m.ty = m.y; }
      m.lx = m.x; m.ly = m.y;
      sfx('roll');
      break;
    }
    case 'shoot': fireVolley(m, a); m.k = 1; break;
    case 'nova': novaShot(m, a, 0); m.k = 1; break;
    case 'spiral': m.spin = m.aim; m.k2 = 0; break;
    case 'slam': {
      const ox = m.x + Math.cos(m.aim) * (a.off || 0), oy = m.y + Math.sin(m.aim) * (a.off || 0);
      if (dist(P.x, P.y, ox, oy) < a.r + P.r * 0.5) hurtPlayer(D(a.dmg), ox, oy, a.st, a.stv);
      burst(ox, oy, a.col || '#d8c8a8', 26, 320, 0.6, 4);
      addFx({ k: 'shock', x: ox, y: oy, r: a.r, t: 0, life: 0.35, col: a.col || '#ffffff' });
      if (a.wave) addHz({ k: 'ring', x: ox, y: oy, r: a.r * 0.6, spd: a.wspd || 330, w: 28, max: a.wmax || 520, dmg: D(a.dmg * 0.75), st: a.st, stv: a.stv, col: a.col || '#e8e0c8', own: 0 });
      if (a.pool) addHz({ k: 'pool', x: ox, y: oy, r: a.pool.r, t: 0, life: a.pool.dur, st: a.pool.st, col: a.pool.col, own: 0 });
      sfx('boom'); shake(m.boss || m.mini ? 9 : 4);
      break;
    }
    case 'rain': {
      const n = a.n || 1;
      for (let i = 0; i < n; i++) {
        let x = P.x, y = P.y;
        if (i > 0) { const ang = Math.random() * TAU, r = rnd(40, a.spread || 150); x += Math.cos(ang) * r; y += Math.sin(ang) * r; }
        if (solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) continue;
        addHz({ k: 'circle', x, y, r: a.r, t: 0, delay: a.delay + i * (a.stag || 0), dmg: D(a.dmg), st: a.st, stv: a.stv, col: a.col || (a.st === 'burn' ? '#ff8a2a' : a.st === 'poison' ? '#7ee36b' : '#ff5040'), pool: a.pool, lob: a.lob ? { x: m.x, y: m.y - 20 } : null, meteor: a.meteor, own: 0 });
      }
      sfx(a.lob ? 'shoot' : 'zap');
      break;
    }
    case 'line': {
      const fan = a.fan || 1;
      for (let f = 0; f < fan; f++) {
        const ang = m.aim + (f - (fan - 1) / 2) * 0.45;
        for (let i = 0; i < a.count; i++) {
          const dd = 50 + i * a.spacing, x = m.x + Math.cos(ang) * dd, y = m.y + Math.sin(ang) * dd;
          if (solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) break;
          addHz({ k: 'circle', x, y, r: a.r, t: 0, delay: a.delay + i * a.stag, dmg: D(a.dmg), st: a.st, stv: a.stv, col: a.col || '#ff5040', spike: true, own: 0 });
        }
      }
      sfx('zap');
      break;
    }
    case 'beam': m.spin = m.aim - a.rot * a.act / 2 * m.bdir; sfx('zap'); break;
    case 'summon': {
      for (let i = 0; i < a.n; i++) {
        if (countSummons(m) >= a.cap) break;
        const ang = Math.random() * TAU, r = rnd(70, 140);
        let x = m.x + Math.cos(ang) * r, y = m.y + Math.sin(ang) * r;
        if (!freeSpot(x, y, 16)) { x = m.x; y = m.y; }
        const s = makeMob(a.mob, x, y, { summon: true, owner: m, tier: 1 });
        s.st = 'chase'; s.vis = true; S.mobs.push(s);
        burst(x, y, '#b066ff', 14, 160, 0.5, 3);
      }
      sfx('roar');
      break;
    }
    case 'teleport': break;
  }
}

function actUpdate(m, a, dt) {
  const D = (v) => Math.round(v * m.dmgM);
  switch (a.t) {
    case 'melee':
      if (m.dash) moveMob(m, Math.cos(m.aim) * m.dash * dt, Math.sin(m.aim) * m.dash * dt);
      if (!m.hit && inSector(P.x, P.y, P.r, m.x, m.y, m.aim, a.reach + m.r * 0.6, a.arc)) {
        m.hit = true; hurtPlayer(D(a.dmg), m.x, m.y, a.st, a.stv);
      }
      break;
    case 'charge': {
      const hit = moveMob(m, Math.cos(m.aim) * m.dash * dt, Math.sin(m.aim) * m.dash * dt);
      if (!m.hit && dist(P.x, P.y, m.x, m.y) < m.r + P.r + 8) { m.hit = true; hurtPlayer(D(a.dmg), m.x, m.y, a.st, a.stv); }
      if (Math.random() < 0.5) addFx({ k: 'p', x: m.x + rnd(-m.r, m.r), y: m.y + m.r * 0.5, vx: 0, vy: -20, t: 0, life: 0.4, col: '#8a7a6a', sz: 4 });
      if (hit && m.t > 0.08) {
        if (a.wallStun) { m.ph = 'rec'; m.t = -0.6; shake(10); sfx('wall'); burst(m.x, m.y, '#a89878', 20, 260, 0.6, 4); }
        else { m.ph = 'rec'; m.t = 0; }
      }
      break;
    }
    case 'leap': {
      let p = clamp(m.t / a.act, 0, 1);
      if (a.trackAct && p < 0.65) { m.tx = P.x; m.ty = P.y; }
      if (a.hide) {
        m.hidden = p > 0.12 && p < 0.88;
        m.z = Math.sin(Math.PI * p) * a.h;
        if (p >= 0.75) { const q = (p - 0.75) / 0.25; m.x = m.tx; m.y = m.ty; m.z = (1 - q) * a.h * 0.7; }
      } else {
        m.x = m.lx + (m.tx - m.lx) * p; m.y = m.ly + (m.ty - m.ly) * p;
        m.z = Math.sin(Math.PI * p) * a.h;
      }
      break;
    }
    case 'shoot':
      if (a.bursts && m.k < a.bursts && m.t >= m.k * a.int) {
        m.aim = Math.atan2(P.y - m.y, P.x - m.x); fireVolley(m, a); m.k++;
      }
      break;
    case 'nova':
      if (a.waves && m.k < a.waves && m.t >= m.k * a.int) { novaShot(m, a, m.k * (a.rotStep || 0.2)); m.k++; }
      break;
    case 'spiral':
      m.k2 += dt;
      while (m.k2 >= a.rate) {
        m.k2 -= a.rate;
        for (let i = 0; i < a.arms; i++) spawnProj(m, m.spin + i * TAU / a.arms, a);
        m.spin += a.rot * a.rate;
        sfx('shoot');
      }
      break;
    case 'beam': {
      m.spin += a.rot * m.bdir * dt;
      const nb = a.beams || 1;
      for (let b = 0; b < nb; b++) {
        const ang = m.spin + b * TAU / nb, len = rayLen(m.x, m.y, ang, a.len);
        const ex = Math.cos(ang), ey = Math.sin(ang);
        const px0 = P.x - m.x, py0 = P.y - m.y, proj = clamp(px0 * ex + py0 * ey, 0, len);
        const ddd = Math.hypot(px0 - ex * proj, py0 - ey * proj);
        if (ddd < a.w / 2 + P.r && proj > m.r * 0.5) hurtPlayer(D(a.dmg), m.x, m.y, a.st, a.stv);
        if (Math.random() < 0.6) addFx({ k: 'p', x: m.x + ex * len, y: m.y + ey * len, vx: rnd(-80, 80), vy: rnd(-80, 80), t: 0, life: 0.4, col: a.col || '#ffd43b', sz: 4 });
      }
      break;
    }
    case 'teleport': {
      const p = m.t / a.act;
      m.alpha = p < 0.5 ? 1 - p * 2 : (p - 0.5) * 2;
      if (p >= 0.5 && !m.k) {
        m.k = 1;
        let nx, ny, ok = false;
        for (let tries = 0; tries < 20 && !ok; tries++) {
          if (a.d === 'arena' && S.bossArena) {
            const ang = Math.random() * TAU, r = rnd(0, S.bossArena.R * 0.7);
            nx = S.bossArena.x + Math.cos(ang) * r; ny = S.bossArena.y + Math.sin(ang) * r;
          } else {
            const ang = Math.random() * TAU; nx = P.x + Math.cos(ang) * a.d; ny = P.y + Math.sin(ang) * a.d;
          }
          ok = freeSpot(nx, ny, m.r * 0.7) && los(nx, ny, P.x, P.y);
        }
        if (ok) { burst(m.x, m.y, '#b066ff', 14, 200, 0.4, 3); m.x = nx; m.y = ny; burst(m.x, m.y, '#b066ff', 14, 200, 0.4, 3); }
        m.aim = Math.atan2(P.y - m.y, P.x - m.x);
      }
      break;
    }
  }
}

function actEnd(m, a) {
  const D = (v) => Math.round(v * m.dmgM);
  if (a.t === 'leap') {
    m.z = 0; m.hidden = false;
    if (a.hide) { m.x = m.tx; m.y = m.ty; collideCircle(m, m.r * 0.8); }
    if (dist(P.x, P.y, m.x, m.y) < a.r + P.r * 0.5) hurtPlayer(D(a.dmg), m.x, m.y, a.st, a.stv);
    burst(m.x, m.y, '#a89878', 22, 300, 0.6, 4);
    addFx({ k: 'shock', x: m.x, y: m.y, r: a.r, t: 0, life: 0.35, col: '#ffffff' });
    if (a.wave) addHz({ k: 'ring', x: m.x, y: m.y, r: a.r * 0.6, spd: 340, w: 28, max: 520, dmg: D(a.dmg * 0.7), st: a.st, stv: a.stv, col: '#e8e0c8', own: 0 });
    sfx('boom'); shake(m.boss || m.mini ? 10 : 3);
  }
  if (a.t === 'teleport') m.alpha = 1;
}

function fireVolley(m, a) {
  const n = a.n || 1;
  for (let i = 0; i < n; i++) spawnProj(m, m.aim + (i - (n - 1) / 2) * (a.spread || 0.2), a);
  sfx('shoot');
}
function novaShot(m, a, off) {
  for (let i = 0; i < a.n; i++) spawnProj(m, off + m.aim + i * TAU / a.n, a);
  sfx('zap');
}
function spawnProj(m, ang, a) {
  S.proj.push({
    x: m.x + Math.cos(ang) * m.r * 0.6, y: m.y + Math.sin(ang) * m.r * 0.6 - 10,
    vx: Math.cos(ang) * a.spd, vy: Math.sin(ang) * a.spd, r: a.pr || (a.k === 'arrow' ? 6 : 9), dmg: Math.round(a.dmg * m.dmgM),
    life: 3.5, k: a.k || 'orb', st: a.st, stv: a.stv, own: 0, pierce: a.pierce, t: 0,
  });
}

// ---------------------------------------------------------------- daño a enemigos
function damageMobRaw(m, d, col) {
  if (m.dead) return;
  d = Math.round(d); m.hp -= d;
  dmgText(m.x, m.y - m.r - 20, d, col || '#ffffff');
  if (m.hp <= 0) killMob(m);
}
function hurtMob(m, dmg, poise, kx, ky, el, big) {
  if (m.dead || m.hidden || m.invuln > 0) return false;
  let d = dmg * rnd(0.95, 1.05);
  if (el === 'fire' || P.buf.resin > 0) { d *= 1.2; m.burn = 3; }
  if (el === 'poison') { m.pois = 6; }
  if (el === 'frost') { m.slow = 3; }
  if (el === 'light') d *= 1.1;
  d = Math.round(d);
  m.hp -= d; m.flash = 0.12;
  dmgText(m.x, m.y - m.r - 24, d, big ? '#ffd43b' : '#ffffff', big);
  burst(m.x, m.y - 10, m.d.spr === 'skel' || m.spr.indexOf('skel') >= 0 ? '#e8e0c8' : '#a02a3a', 6, 160, 0.4, 3, 200);
  sfx(big ? 'hitBig' : 'hit');
  const w = WEAPONS[P.weapon];
  if (w.steal) { P.hp = Math.min(maxHP(), P.hp + w.steal); }
  if (m.st === 'idle' || m.st === 'return') aggro(m);
  if (!m.boss) {
    m.pz -= poise;
    if (m.pz <= 0) {
      m.pz = m.d.poise;
      m.st = 'stagger'; m.t = 0; m.a = null; m.chainQ = null; m.z = 0; m.alpha = 1;
      m.vx = kx * (m.mini ? 120 : 300); m.vy = ky * (m.mini ? 120 : 300);
    }
  }
  if (m.hp <= 0) killMob(m);
  return true;
}

function killMob(m) {
  if (m.dead) return;
  m.dead = true; m.hp = 0;
  burst(m.x, m.y - 10, m.boss ? '#ffd43b' : '#d8d0c0', m.boss ? 80 : 18, m.boss ? 500 : 220, m.boss ? 1.6 : 0.7, m.boss ? 5 : 3);
  let souls = Math.round(m.d.souls * m.soulsM * (ringOn('anillo_codicia') ? 1.3 : 1));
  if (souls > 0) {
    P.souls += souls; sfx('souls');
    for (let i = 0; i < Math.min(20, 3 + souls / 60); i++) addFx({ k: 'soul', x: m.x + rnd(-20, 20), y: m.y + rnd(-20, 20), vx: rnd(-150, 150), vy: rnd(-150, 150), t: 0, life: 2 });
  }
  if (m.d.burst) addHz({ k: 'circle', x: m.x, y: m.y, r: m.d.burst.r, t: 0, delay: m.d.burst.delay, dmg: Math.round(m.d.burst.dmg * m.dmgM), st: m.d.burst.st, col: '#ff8a2a', own: 0 });
  // los invocados mueren con su amo
  if (m.boss || m.mini) for (const o of S.mobs) if (o.owner === m && !o.dead) { o.dead = true; burst(o.x, o.y, '#b066ff', 10, 150, 0.5, 3); }
  if (S.lock === m) S.lock = null;
  if (m.mimicOf) onMimicDead(m);
  if (m.mini) onMiniDead(m);
  if (m.boss) onBossDead(m);
  else if (!m.summon && !m.mini && Math.random() < 0.06) dropRandom(m.x, m.y);
}

function dropRandom(x, y) {
  const r = RANDOM_LOOT[Math.floor(Math.random() * RANDOM_LOOT.length)];
  S.drops.push({ x, y, c: [[r[0], r[1]]], t: 0 });
}

// ---------------------------------------------------------------- peligros y proyectiles
function addHz(h) { h.t = h.t || 0; S.hz.push(h); }

function updateHazards(dt) {
  for (const h of S.hz) {
    h.t += dt;
    if (h.k === 'circle') {
      if (!h.done && h.t >= h.delay) {
        h.done = true; h.t2 = 0;
        if (h.own) {
          for (const m of S.mobs) if (!m.dead && dist(m.x, m.y, h.x, h.y) < h.r + m.r * 0.6) hurtMob(m, h.dmg, 60, 0, 0, 'fire', true);
        } else if (dist(P.x, P.y, h.x, h.y) < h.r + P.r * 0.5) hurtPlayer(h.dmg, h.x, h.y, h.st, h.stv);
        burst(h.x, h.y, h.col, h.spike ? 10 : 18, h.spike ? 160 : 260, 0.5, 4, h.spike ? -200 : 0);
        addFx({ k: h.spike ? 'spike' : 'shock', x: h.x, y: h.y, r: h.r, t: 0, life: h.spike ? 0.5 : 0.3, col: h.col });
        if (h.pool) addHz({ k: 'pool', x: h.x, y: h.y, r: h.pool.r, t: 0, life: h.pool.dur, st: h.pool.st, col: h.pool.col, own: h.own });
        if (!h.spike) { sfx('boom'); shake(h.own ? 5 : 3); }
      }
      if (h.done) h.t2 += dt;
    } else if (h.k === 'ring') {
      h.r += h.spd * dt;
      if (!h.hit) {
        const d = dist(P.x, P.y, h.x, h.y);
        if (Math.abs(d - h.r) < h.w / 2 + P.r * 0.4) { if (hurtPlayer(h.dmg, h.x, h.y, h.st, h.stv)) h.hit = true; }
      }
    } else if (h.k === 'pool') {
      if (h.own) {
        h.tick = (h.tick || 0) + dt;
        if (h.tick > 0.4) { h.tick = 0; for (const m of S.mobs) if (!m.dead && dist(m.x, m.y, h.x, h.y) < h.r + m.r * 0.5) damageMobRaw(m, 6, '#ff8a2a'); }
      } else if (dist(P.x, P.y, h.x, h.y) < h.r + P.r * 0.3 && P.st !== 'roll') {
        if (h.st === 'poison') applyPStatus('poison', 40 * dt);
        else if (h.st === 'burn') { applyPStatus('burn'); }
        else if (h.st === 'frost') applyPStatus('frost', 40 * dt);
      }
    }
  }
  compact(S.hz, h => h.k === 'circle' ? !(h.done && h.t2 > 0.05) : h.k === 'ring' ? h.r < h.max : h.t < h.life);
}

function updateProj(dt) {
  for (const p of S.proj) {
    p.t += dt; p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if (solidTile(Math.floor(p.x / TILE), Math.floor(p.y / TILE))) {
      p.life = 0; burst(p.x, p.y, projCol(p), 6, 120, 0.3, 2);
      if (p.bomb) explodeBomb(p);
      continue;
    }
    if (p.own) {
      for (const m of S.mobs) {
        if (m.dead || m.hidden) continue;
        if (p.hitSet && p.hitSet.has(m)) continue;
        if (dist(p.x, p.y, m.x, m.y) < p.r + m.r) {
          if (p.bomb) { explodeBomb(p); p.life = 0; break; }
          hurtMob(m, p.dmg, p.poise || 15, p.vx / 600, p.vy / 600, p.el);
          if (p.pierce) { (p.hitSet || (p.hitSet = new Set())).add(m); }
          else { p.life = 0; break; }
        }
      }
    } else if (P.st !== 'dead' && dist(p.x, p.y, P.x, P.y) < p.r + P.r) {
      if (hurtPlayer(p.dmg, p.x - p.vx, p.y - p.vy, p.st, p.stv) && !p.pierce) p.life = 0;
      else if (P.iframe > 0 && P.st === 'roll') { /* esquivado */ }
    }
    if (p.k === 'fire' || p.k === 'dark' || p.k === 'crescent') {
      if (Math.random() < 0.5) addFx({ k: 'p', x: p.x, y: p.y, vx: rnd(-20, 20), vy: rnd(-20, 20), t: 0, life: 0.3, col: projCol(p), sz: 3 });
    }
  }
  compact(S.proj, p => p.life > 0);
}
function projCol(p) {
  return { arrow: '#d8c8a8', fire: '#ff8a2a', ice: '#8ff3ff', acid: '#7ee36b', web: '#f4f4f4', dark: '#b066ff', crescent: '#c080ff', rock: '#8a7a6a', knife: '#cfd6df', light: '#ffe9a0', bomb: '#3a4048' }[p.k] || '#ff5a5a';
}
function explodeBomb(p) {
  addHz({ k: 'circle', x: p.x, y: p.y, r: 80, t: 0, delay: 0, dmg: p.dmg, col: '#ff8a2a', own: 1 });
}

// ---------------------------------------------------------------- partículas
function updateFx(dt) {
  for (const f of S.fx) {
    f.t += dt;
    if (f.k === 'p') { f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.g || 0) * dt; f.vx *= 0.96; f.vy *= 0.96; }
    else if (f.k === 'soul') {
      const a = Math.atan2(P.y - 20 - f.y, P.x - f.x), sp = 200 + f.t * 700;
      f.vx += (Math.cos(a) * sp - f.vx) * Math.min(1, dt * 4); f.vy += (Math.sin(a) * sp - f.vy) * Math.min(1, dt * 4);
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (dist(f.x, f.y, P.x, P.y - 20) < 20) f.t = f.life;
    } else if (f.k === 'ember') { f.x += f.vx * dt; f.y += f.vy * dt; f.vx += Math.sin(f.t * 3 + f.s) * 10 * dt; }
  }
  compact(S.fx, f => f.t < f.life);
  for (const t of S.texts) { t.t += dt; t.y -= 40 * dt; }
  compact(S.texts, t => t.t < 0.9);
}
