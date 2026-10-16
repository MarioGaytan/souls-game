'use strict';
// =====================================================================
//  MOTOR — guardado, entrada, jugador, combate, jefes, hogueras,
//  bucle principal y render del mundo (trozos pre-dibujados, objetos
//  ordenados por profundidad, mapa de luz a baja resolución).
// =====================================================================

const cv = document.getElementById('game');
const ctx = cv.getContext('2d');
let W = 1280, H = 720, DPR = 1, ZOOM = 1;
const cam = { x: 0, y: 0 };
const lightCv = document.createElement('canvas'), lctx = lightCv.getContext('2d');
const LS = 4; // escala del mapa de luz

// ---------------------------------------------------------------- guardado
const SET_KEY = 'umbraterra_settings', GAME_KEY = 'umbraterra_save_v1';
let SAVE = { settings: { quality: 'high', sfx: true, music: true, dmgNums: true, shake: true, fps: false } };
try { const d = JSON.parse(localStorage.getItem(SET_KEY)); if (d) Object.assign(SAVE.settings, d); } catch (e) { /* sin almacenamiento */ }
function saveSettings() { try { localStorage.setItem(SET_KEY, JSON.stringify(SAVE.settings)); } catch (e) { } }
const LOWQ = () => SAVE.settings.quality === 'low';
let GS = null; // banderas de la partida

function freshFlags() { return { bosses: {}, minis: {}, chests: {}, items: {}, gates: {}, fakes: [], shop: {}, blood: null, deaths: 0, time: 0, won: false }; }
function hasSave() { try { return !!localStorage.getItem(GAME_KEY); } catch (e) { return false; } }
function saveGame() {
  if (!GS || !P) return;
  const keep = ['x', 'y', 'souls', 'stats', 'inv', 'weapons', 'wlv', 'weapon', 'rings', 'ringEq', 'flaskMax', 'ceniza', 'quick', 'lastBf', 'lit'];
  const p = {}; for (const k of keep) p[k] = P[k];
  const bf = WORLD.bonfires.find(b => b.id === P.lastBf);
  if (bf) { p.x = bf.x; p.y = bf.y + 50; }
  GS.p = p; GS.exp = encodeExp();
  try { localStorage.setItem(GAME_KEY, JSON.stringify(GS)); } catch (e) { }
}

// ---------------------------------------------------------------- pantalla
function resize() {
  DPR = Math.min(window.devicePixelRatio || 1, LOWQ() ? 1 : 1.5);
  W = window.innerWidth; H = window.innerHeight;
  cv.width = Math.floor(W * DPR); cv.height = Math.floor(H * DPR);
  cv.style.width = W + 'px'; cv.style.height = H + 'px';
  const touchy = typeof TOUCH !== 'undefined' && TOUCH.on;
  ZOOM = clamp(Math.min(W / 1180, H / 680), touchy ? 0.55 : 0.62, 1.7);
  lightCv.width = Math.ceil(W / LS); lightCv.height = Math.ceil(H / LS);
  ctx.imageSmoothingEnabled = false;
}
window.addEventListener('resize', resize);

// ---------------------------------------------------------------- entrada
const keys = {}, pressed = {};
const mouse = { x: 0, y: 0, wx: 0, wy: 0, active: false, t: 0 };
window.addEventListener('keydown', e => {
  if (e.code === 'Tab' || e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
  if (!keys[e.code]) pressed[e.code] = true;
  keys[e.code] = true;
  if (typeof onKeyUI === 'function') onKeyUI(e);
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
cv.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; mouse.t = 3; });
cv.addEventListener('mousedown', e => {
  audioInit();
  if (e.button === 0) pressed.MouseL = true; else if (e.button === 2) pressed.MouseR = true; else if (e.button === 1) { pressed.MouseM = true; e.preventDefault(); }
  mouse.active = true; mouse.t = 3;
});
cv.addEventListener('contextmenu', e => e.preventDefault());
cv.addEventListener('wheel', e => { if (S && S.mode === 'play') { pressed[e.deltaY > 0 ? 'WheelD' : 'WheelU'] = true; } }, { passive: true });
function took(...names) { let r = false; for (const n of names) if (pressed[n]) { pressed[n] = false; r = true; } return r; }
function clearPressed() { for (const k in pressed) pressed[k] = false; }

// ---------------------------------------------------------------- inicio de partida
function initState() {
  S = { mode: 'play', time: 0, mobs: [], proj: [], hz: [], fx: [], texts: [], drops: [], amb: [], toasts: [],
    boss: null, bossArena: null, bossName: '', shake: 0, banner: null, area: null, reg: -1, dark: 0.3, lock: null,
    msg: null, deathT: 0, fade: null, saveT: 0, revealT: 0, regT: 0, fps: 60, frames: 0, fpsT: 0, miniBar: null, winT: -1 };
}
function newGame() {
  GS = freshFlags();
  generateWorld(); chunkCache.clear();
  applyFlagsToWorld();
  P = newPlayer();
  P.hp = maxHP(); P.sta = maxSta();
  initState();
  resetWorld();
  cam.x = P.x; cam.y = P.y;
  banner('CENIZAS DE UMBRATERRA', '#ffd43b', 'Enciende las hogueras. Reúne las cinco Grandes Almas.');
  saveGame();
}
function loadGame() {
  let d = null;
  try { d = JSON.parse(localStorage.getItem(GAME_KEY)); } catch (e) { }
  if (!d || !d.p) return newGame();
  GS = Object.assign(freshFlags(), d);
  // el mundo es determinista: basta con reaplicar las banderas
  generateWorld(); chunkCache.clear();
  if (d.exp) decodeExp(d.exp);
  buildMapImage();
  applyFlagsToWorld();
  P = Object.assign(newPlayer(), d.p);
  P.ringEq = P.ringEq || [null, null];
  P.flasks = P.flaskMax; P.hp = maxHP(); P.sta = maxSta();
  initState();
  resetWorld();
  cam.x = P.x; cam.y = P.y;
  const bf = WORLD.bonfires.find(b => b.id === P.lastBf);
  banner(bf ? bf.n : 'Umbraterra', '#ffd43b', 'Has vuelto.');
}
function applyFlagsToWorld() {
  for (const g of WORLD.gates) if (GS.gates[g.id]) for (const i of g.tiles) MAP.t[i] = T_F;
  for (const i of GS.fakes) MAP.t[i] = T_F;
  chunkCache.clear(); buildMapImage();
}

// enemigos a su sitio (al descansar, al morir, al cargar)
function resetWorld() {
  if (S.boss || S.bossArena) endBossFight(false);
  S.mobs.length = 0; S.proj.length = 0; S.hz.length = 0; S.drops.length = 0; S.lock = null;
  for (const s of WORLD.spawns) S.mobs.push(makeMob(s.type, s.x, s.y, { tier: s.tier }));
  for (const m of WORLD.minis) if (!GS.minis[m.id]) {
    const mob = makeMob(m.type, m.x, m.y, { id: m.id });
    S.mobs.push(mob);
  }
  for (const c of WORLD.chests) c.awake = false;
}

// ---------------------------------------------------------------- objetos
function give(id, n, quiet) {
  n = n || 1;
  if (WEAPONS[id]) { if (!P.weapons.includes(id)) P.weapons.push(id); if (!quiet) toast(WEAPONS[id].n, 'w:' + id); }
  else if (RINGS[id]) { if (!P.rings.includes(id)) P.rings.push(id); if (!quiet) toast(RINGS[id].n, 'r:' + id); }
  else if (id === 'fragmento') { P.flaskMax = Math.min(10, P.flaskMax + 1); P.flasks++; if (!quiet) toast('Fragmento de Frasco · ' + P.flaskMax + ' cargas', 'fragmento'); }
  else if (id === 'ceniza') { P.ceniza++; if (!quiet) toast('Ceniza Avivadora · curas más', 'ceniza'); }
  else { P.inv[id] = (P.inv[id] || 0) + n; if (!quiet) toast(ITEMS[id].n, id, n); }
  sfx('pick');
}
function quickList() { return USABLE.filter(id => (P.inv[id] || 0) > 0); }
function currentQuick() { const l = quickList(); if (!l.length) return null; P.quick = ((P.quick % l.length) + l.length) % l.length; return l[P.quick]; }

// ---------------------------------------------------------------- jugador
function moveInput() {
  let x = 0, y = 0;
  if (keys.KeyW || keys.ArrowUp) y -= 1;
  if (keys.KeyS || keys.ArrowDown) y += 1;
  if (keys.KeyA || keys.ArrowLeft) x -= 1;
  if (keys.KeyD || keys.ArrowRight) x += 1;
  if (typeof TOUCH !== 'undefined' && TOUCH.on && (TOUCH.mx || TOUCH.my)) { x = TOUCH.mx; y = TOUCH.my; }
  const l = Math.hypot(x, y);
  if (l > 1) { x /= l; y /= l; }
  return { x, y, l: Math.min(1, l) };
}
function computeAim(mv) {
  if (S.lock && !S.lock.dead) return Math.atan2(S.lock.y - P.y, S.lock.x - P.x);
  const touchy = typeof TOUCH !== 'undefined' && TOUCH.on;
  if (!touchy && mouse.active) return Math.atan2(mouse.wy - P.y, mouse.wx - P.x);
  if (touchy) {
    // apuntado automático al enemigo más cercano
    let best = null, bd = 260;
    for (const m of S.mobs) {
      if (m.dead || m.hidden) continue;
      const d = dist(P.x, P.y, m.x, m.y) - m.r;
      if (d < bd) { bd = d; best = m; }
    }
    if (best) return Math.atan2(best.y - P.y, best.x - P.x);
  }
  if (mv.l > 0.2) return Math.atan2(mv.y, mv.x);
  return P.aim;
}
function rollIframe() { return P.st === 'roll' && P.t > 0.03 && P.t < 0.36; }

function updatePlayer(dt) {
  if (P.dead) {
    P.t += dt;
    if (P.t > 3.6 && !S.fade) fadeTo(respawn);
    return;
  }
  if (P.iframe > 0) P.iframe -= dt;
  if (P.flash > 0) P.flash -= dt;
  if (P.comboT > 0) P.comboT -= dt;
  if (P.buf.herb > 0) P.buf.herb -= dt;
  if (P.buf.resin > 0) P.buf.resin -= dt;
  const mv = moveInput();
  P.aim = computeAim(mv);
  // estados alterados
  const s = P.sts;
  if (s.poison > 0) { s.poison -= dt; P.hp -= 2.5 * dt; }
  if (s.burn > 0) { s.burn -= dt; P.hp -= 5 * dt; if (Math.random() < 0.3) addFx({ k: 'p', x: P.x + rnd(-10, 10), y: P.y - rnd(0, 30), vx: 0, vy: -60, t: 0, life: 0.4, col: '#ff8a2a', sz: 3 }); }
  if (s.frost > 0) s.frost -= dt;
  if (s.slow > 0) s.slow -= dt;
  s.pb = Math.max(0, s.pb - 5 * dt); s.fb = Math.max(0, s.fb - 5 * dt);
  // terreno
  const tt = tileAtW(P.x, P.y);
  let spdM = 1, ice = false;
  if (P.st !== 'roll' || tt !== T_LAVA) {
    if (tt === T_WATER) { spdM = 0.62; applyPStatus('poison', 16 * dt); }
    else if (tt === T_LAVA) { P.hp -= 18 * dt; applyPStatus('burn'); if (Math.random() < 0.2) sfx('step'); }
    else if (tt === T_ICE) ice = true;
    else { P.safeX = P.x; P.safeY = P.y; }
  }
  if (s.frost > 0) spdM *= 0.65;
  if (s.slow > 0) spdM *= 0.55;
  if (P.hp <= 0) { playerDie(); return; }
  // aguante
  const sprinting = (keys.ShiftLeft || keys.ShiftRight || (typeof TOUCH !== 'undefined' && TOUCH.run)) && mv.l > 0.3 && P.st === 'move' && P.sta > 0;
  if (P.staDelay > 0) P.staDelay -= dt;
  else if (P.st !== 'roll' && P.st !== 'atk' && !sprinting) {
    const k = (ringOn('anillo_verde') ? 1.4 : 1) * (P.buf.herb > 0 ? 1.8 : 1) * (s.frost > 0 ? 0.5 : 1) * (P.st === 'drink' ? 0.4 : 1);
    P.sta = Math.min(maxSta(), P.sta + 52 * k * dt);
  }

  const free = P.st === 'move';
  if (free) {
    if (took('Space')) { if (startRoll(mv)) return; }
    if (took('KeyJ', 'MouseL')) { playerAttack(false); }
    else if (took('KeyK', 'MouseR')) { playerAttack(true); }
    else if (took('KeyQ')) drinkFlask();
    else if (took('KeyF')) useItem();
  }
  switch (P.st) {
    case 'move': {
      let sp = 185 * spdM;
      if (sprinting) { sp *= 1.45; P.sta -= 22 * dt; P.staDelay = 0.4; }
      const tvx = mv.x * sp, tvy = mv.y * sp;
      if (ice) { P.vx += (tvx - P.vx) * Math.min(1, dt * 2.2); P.vy += (tvy - P.vy) * Math.min(1, dt * 2.2); }
      else { P.vx = tvx; P.vy = tvy; }
      moveEnt(P, P.vx * dt, P.vy * dt, P.r);
      if (mv.l > 0.1) { P.stepT -= dt * (sprinting ? 1.5 : 1); if (P.stepT <= 0) { P.stepT = 0.32; if (Math.random() < 0.5) sfx('step'); } }
      break;
    }
    case 'roll': {
      P.t += dt;
      const dur = 0.44, p = P.t / dur;
      const sp = 440 * (1 - p * p * 0.75) * (s.frost > 0 ? 0.8 : 1);
      moveEnt(P, Math.cos(P.rollA) * sp * dt, Math.sin(P.rollA) * sp * dt, P.r);
      if (Math.random() < 0.6) addFx({ k: 'p', x: P.x + rnd(-6, 6), y: P.y + 10, vx: rnd(-30, 30), vy: rnd(-30, 0), t: 0, life: 0.35, col: '#8a7a6a', sz: 3 });
      if (P.t >= dur) { P.st = 'move'; P.vx = Math.cos(P.rollA) * 120; P.vy = Math.sin(P.rollA) * 120; }
      break;
    }
    case 'atk': updatePlayerAtk(dt, mv); break;
    case 'drink': {
      P.t += dt;
      moveEnt(P, mv.x * 60 * dt, mv.y * 60 * dt, P.r);
      if (P.t >= 0.55 && !P.healed) {
        P.healed = true; P.hp = Math.min(maxHP(), P.hp + healAmt()); sfx('heal');
        burst(P.x, P.y - 20, '#ffd43b', 18, 120, 0.8, 3, -80);
      }
      if (P.t >= 0.9) P.st = 'move';
      break;
    }
    case 'item': {
      P.t += dt;
      moveEnt(P, mv.x * 80 * dt, mv.y * 80 * dt, P.r);
      if (P.t >= 0.2 && !P.itemDone) { P.itemDone = true; itemEffect(P.itemId); }
      if (P.t >= 0.45) P.st = 'move';
      break;
    }
    case 'stagger': {
      P.t += dt;
      moveEnt(P, P.kx * dt, P.ky * dt, P.r); P.kx *= 0.85; P.ky *= 0.85;
      if (P.t >= 0.32) P.st = 'move';
      break;
    }
  }
}

function startRoll(mv) {
  if (P.sta <= 0) return false;
  P.sta -= 22 * (ringOn('anillo_halcon') ? 0.75 : 1); P.staDelay = 0.6;
  P.st = 'roll'; P.t = 0; P.atk = null;
  P.rollA = mv.l > 0.2 ? Math.atan2(mv.y, mv.x) : P.aim;
  sfx('roll');
  return true;
}

function playerAttack(heavy) {
  if (P.sta <= 0) return false;
  const w = WEAPONS[P.weapon];
  P.sta -= w.sta * (heavy ? 1.6 : 1) * (ringOn('anillo_halcon') ? 0.75 : 1); P.staDelay = 0.7;
  P.combo = P.comboT > 0 ? P.combo + 1 : 0;
  const type = heavy ? w.hv : 'n';
  let arc = w.arc, reach = w.reach, step = 26;
  if (type === 'thrust') { arc = 0.6; reach *= 1.35; step = 110; }
  else if (type === 'spin') { arc = TAU; step = 10; }
  else if (type === 'sweep') { arc = 3.2; step = 70; }
  else if (type === 'slam') { step = 20; }
  P.atk = {
    w, heavy, type, ph: 'wind', t: 0, wind: w.wind * (heavy ? 1.9 : 1), act: w.act * (type === 'spin' ? 2.2 : 1) * (heavy ? 1.1 : 1),
    rec: w.rec * (heavy ? 1.25 : 1), arc, reach, step, hit: new Set(), rev: P.combo % 2 === 1, aim: P.aim,
    dmg: weaponDmg() * (heavy ? 1.65 : 1) * (P.combo >= 2 ? 1.1 : 1), poise: (heavy ? 2.2 : 1) * (10 + w.dmg * 0.9), buffered: null,
  };
  P.st = 'atk'; P.t = 0;
  return true;
}

function updatePlayerAtk(dt, mv) {
  const A = P.atk; A.t += dt;
  if (took('KeyJ', 'MouseL')) A.buffered = 'l';
  else if (took('KeyK', 'MouseR')) A.buffered = 'h';
  if (pressed.Space) A.bufRoll = true;
  if (A.ph === 'wind') {
    A.aim = rotTo(A.aim, P.aim, 10 * dt);
    moveEnt(P, mv.x * 40 * dt, mv.y * 40 * dt, P.r);
    if (A.t >= A.wind) { A.ph = 'act'; A.t = 0; playerActStart(A); }
  } else if (A.ph === 'act') {
    const st = A.step / A.act;
    moveEnt(P, Math.cos(A.aim) * st * dt, Math.sin(A.aim) * st * dt, P.r);
    for (const m of S.mobs) {
      if (m.dead || A.hit.has(m) || m.hidden) continue;
      if (Math.abs(m.x - P.x) > A.reach + m.r + 20 || Math.abs(m.y - P.y) > A.reach + m.r + 20) continue;
      if (inSector(m.x, m.y, m.r, P.x, P.y, A.aim, A.reach, A.arc)) {
        A.hit.add(m);
        const a = Math.atan2(m.y - P.y, m.x - P.x);
        hurtMob(m, A.dmg, A.poise, Math.cos(a), Math.sin(a), A.w.el, A.heavy);
        S.hitStop = A.heavy ? 0.07 : 0.035;
      }
    }
    if (A.t >= A.act) { A.ph = 'rec'; A.t = 0; }
  } else {
    if (A.t > A.rec * 0.3 && (A.bufRoll || pressed.Space)) {
      pressed.Space = false; P.st = 'move'; P.atk = null; P.comboT = 0.4; startRoll(mv); return;
    }
    if (A.buffered && A.t > A.rec * 0.4 && P.sta > 0) {
      const h = A.buffered === 'h'; P.comboT = 0.4; P.st = 'move'; P.atk = null; playerAttack(h); return;
    }
    if (A.t >= A.rec) { P.st = 'move'; P.atk = null; P.comboT = 0.35; }
  }
}

function playerActStart(A) {
  sfx(A.heavy ? 'heavy' : 'swing');
  const col = A.w.el === 'fire' || P.buf.resin > 0 ? '#ffb070' : A.w.el === 'frost' ? '#c8f8ff' : A.w.el === 'poison' ? '#c8ffb0' : A.w.el === 'light' ? '#fff3b0' : '#ffffff';
  if (A.type === 'thrust') addFx({ k: 'thrust', x: P.x, y: P.y, a: A.aim, r: A.reach, t: 0, life: 0.15, col });
  else slashFx(P.x, P.y - 6, A.aim, Math.min(A.arc, TAU), A.reach, col, A.rev, Math.max(0.14, A.act));
  if (A.type === 'slam') {
    const ox = P.x + Math.cos(A.aim) * A.reach * 0.55, oy = P.y + Math.sin(A.aim) * A.reach * 0.55, r = A.reach * 0.75;
    for (const m of S.mobs) if (!m.dead && !m.hidden && !A.hit.has(m) && dist(m.x, m.y, ox, oy) < r + m.r) { A.hit.add(m); hurtMob(m, A.dmg, A.poise, Math.cos(A.aim), Math.sin(A.aim), A.w.el, true); }
    addFx({ k: 'shock', x: ox, y: oy, r, t: 0, life: 0.3, col: '#e8e0c8' });
    burst(ox, oy, '#a89878', 18, 260, 0.5, 4);
    shake(6); sfx('boom');
    if (A.w.el === 'fire') addHz({ k: 'pool', x: ox, y: oy, r: 70, t: 0, life: 3, st: 'burn', col: '#ff8a2a', own: 1 });
  }
  if (A.type === 'wave') {
    S.proj.push({ x: P.x, y: P.y - 6, vx: Math.cos(A.aim) * 560, vy: Math.sin(A.aim) * 560, r: 22, dmg: Math.round(A.dmg * 0.7), life: 0.8, k: 'light', own: 1, pierce: true, el: 'light', t: 0, poise: 30 });
  }
  // paredes ilusorias
  for (let d = 20; d <= A.reach + 10; d += 16) {
    const x = P.x + Math.cos(A.aim) * d, y = P.y + Math.sin(A.aim) * d;
    const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
    if (tileT(tx, ty) === T_FAKE) {
      const i = ty * MW + tx;
      // toda la pared ilusoria conectada desaparece
      const q = [i], seen = new Set([i]);
      while (q.length) {
        const j = q.pop(); setTile(j, T_F); GS.fakes.push(j);
        const jx = j % MW, jy = (j / MW) | 0;
        for (const [ddx, ddy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = (jy + ddy) * MW + jx + ddx; if (!seen.has(k) && MAP.t[k] === T_FAKE) { seen.add(k); q.push(k); } }
      }
      burst(tw(tx), tw(ty), '#b5ab8f', 30, 260, 0.8, 4);
      sfx('wall'); toast('¡Una pared ilusoria!');
      saveGame();
      break;
    }
    if (solidTile(tx, ty)) break;
  }
}

function drinkFlask() {
  if (P.flasks <= 0) { sfx('deny'); toast('El frasco está vacío'); return; }
  P.flasks--; P.st = 'drink'; P.t = 0; P.healed = false; sfx('drink');
}
function useItem() {
  const id = currentQuick(); if (!id) { sfx('deny'); return; }
  P.inv[id]--; if (P.inv[id] <= 0) delete P.inv[id];
  P.st = 'item'; P.t = 0; P.itemId = id; P.itemDone = false;
}
function itemEffect(id) {
  const a = P.aim;
  switch (id) {
    case 'bomba': {
      let tx = P.x + Math.cos(a) * 240, ty = P.y + Math.sin(a) * 240;
      if (mouse.active && !(typeof TOUCH !== 'undefined' && TOUCH.on) && !S.lock) { const d = Math.min(300, dist(P.x, P.y, mouse.wx, mouse.wy)); tx = P.x + Math.cos(a) * d; ty = P.y + Math.sin(a) * d; }
      const L = rayLen(P.x, P.y, a, dist(P.x, P.y, tx, ty));
      tx = P.x + Math.cos(a) * Math.max(20, L - 10); ty = P.y + Math.sin(a) * Math.max(20, L - 10);
      addHz({ k: 'circle', x: tx, y: ty, r: 80, t: 0, delay: 0.55, dmg: 70 + (P.stats.str - 10) * 2, col: '#ff8a2a', lob: { x: P.x, y: P.y - 20 }, pool: { r: 60, dur: 2, st: 'burn', col: '#ff8a2a' }, own: 1 });
      sfx('swing');
      break;
    }
    case 'cuchillo':
      S.proj.push({ x: P.x, y: P.y - 8, vx: Math.cos(a) * 780, vy: Math.sin(a) * 780, r: 7, dmg: 26 + (P.stats.dex - 10) * 1.2, life: 0.8, k: 'knife', own: 1, t: 0, poise: 12 });
      sfx('swing');
      break;
    case 'musgo': P.sts.poison = 0; P.sts.burn = 0; P.sts.frost = 0; P.sts.pb = 0; P.sts.fb = 0; P.sts.slow = 0; sfx('heal'); toast('Te sientes limpio'); break;
    case 'hierba': P.buf.herb = 40; sfx('heal'); break;
    case 'resina': P.buf.resin = 60; sfx('zap'); burst(P.x, P.y - 20, '#ff8a2a', 16, 120, 0.6, 3); break;
    case 'hueso': if (S.boss) { toast('No puedes huir de este combate'); give('hueso', 1, true); break; } fadeTo(() => { const bf = WORLD.bonfires.find(b => b.id === P.lastBf); restAt(bf, true); }); break;
    case 'alma_p': P.souls += 300; sfx('souls'); burst(P.x, P.y - 20, '#8ff3ff', 20, 140, 0.8, 3); break;
    case 'alma_g': P.souls += 2000; sfx('souls'); burst(P.x, P.y - 20, '#ffd43b', 30, 160, 1, 3); break;
  }
}

// ---------------------------------------------------------------- muerte y hogueras
function playerDie() {
  if (P.dead) return;
  P.dead = true; P.st = 'dead'; P.t = 0; P.hp = 0; P.atk = null;
  sfx('die'); GS.deaths++;
  const bx = P.safeX || P.x, by = P.safeY || P.y;
  GS.blood = P.souls > 0 ? { x: bx, y: by, souls: P.souls } : null;
  P.souls = 0;
  S.lock = null;
}
function respawn() {
  const bf = WORLD.bonfires.find(b => b.id === P.lastBf) || WORLD.bonfires[0];
  P.dead = false;
  restAt(bf, true);
}
function restAt(bf, silent) {
  P.x = bf.x; P.y = bf.y + 50; P.vx = P.vy = 0;
  P.hp = maxHP(); P.sta = maxSta(); P.flasks = P.flaskMax;
  P.st = 'move'; P.atk = null; P.iframe = 1;
  for (const k in P.sts) P.sts[k] = 0;
  P.lastBf = bf.id;
  resetWorld();
  cam.x = P.x; cam.y = P.y;
  saveGame();
  if (!silent) sfx('bonfire');
}
function fadeTo(cb) { S.fade = { t: 0, dur: 1.0, cb, done: false }; }

// ---------------------------------------------------------------- interacción
function interactables() {
  const out = [];
  for (const b of WORLD.bonfires) out.push({ k: 'bonfire', o: b, d: dist(P.x, P.y, b.x, b.y), r: 80, label: P.lit[b.id] ? 'Descansar' : 'Encender hoguera' });
  for (const c of WORLD.chests) if (!GS.chests[c.id] && !c.awake) out.push({ k: 'chest', o: c, d: dist(P.x, P.y, c.x, c.y), r: 62, label: 'Abrir cofre' });
  for (const n of WORLD.npcs) out.push({ k: 'npc', o: n, d: dist(P.x, P.y, n.x, n.y), r: 80, label: 'Hablar con ' + n.n.split(',')[0] });
  for (const g of WORLD.gates) if (!GS.gates[g.id]) out.push({ k: 'gate', o: g, d: dist(P.x, P.y, g.x, g.y), r: 150, label: 'Examinar: ' + g.n });
  for (const it of WORLD.items) if (!GS.items[it.id]) out.push({ k: 'item', o: it, d: dist(P.x, P.y, it.x, it.y), r: 56, label: 'Recoger' });
  for (const it of S.drops) out.push({ k: 'drop', o: it, d: dist(P.x, P.y, it.x, it.y), r: 56, label: 'Recoger' });
  for (const m of WORLD.msgs) out.push({ k: 'msg', o: m, d: dist(P.x, P.y, m.x, m.y), r: 46, label: 'Leer mensaje' });
  let best = null;
  for (const o of out) if (o.d < o.r && (!best || o.d < best.d)) best = o;
  return best;
}
function doInteract(it) {
  const o = it.o;
  switch (it.k) {
    case 'bonfire':
      if (S.boss) { toast('No puedes descansar con un enemigo cerca'); return; }
      if (nearbyAggro()) { toast('Hay enemigos cerca'); sfx('deny'); return; }
      if (!P.lit[o.id]) { P.lit[o.id] = true; banner('HOGUERA ENCENDIDA', '#ffb04a'); }
      restAt(o);
      UI.bonfire(o);
      break;
    case 'chest':
      if (o.mimic) {
        o.awake = true;
        const m = makeMob('mimic', o.x, o.y, { tier: REGIONS[regAtW(o.x, o.y)].tier });
        m.mimicOf = o; m.st = 'chase'; m.vis = true; S.mobs.push(m);
        sfx('roar'); shake(8); toast('¡Es un mímico!');
        return;
      }
      GS.chests[o.id] = 1;
      for (const [id, n] of o.c) give(id, n);
      burst(o.x, o.y - 10, '#ffd43b', 20, 160, 0.7, 3, -60);
      saveGame();
      break;
    case 'npc': if (o.id === 'smith') UI.smith(); else UI.shop(); break;
    case 'gate': {
      if (o.key === 'souls5') {
        const n = GREAT_SOULS.filter(k => P.inv[k]).length;
        if (n < 5) { toast('El sello exige cinco Grandes Almas (' + n + '/5)'); sfx('deny'); return; }
      } else if (!P.inv[o.key]) { toast('Cerrada. Necesitas: ' + ITEMS[o.key].n); sfx('deny'); return; }
      GS.gates[o.id] = 1;
      for (const i of o.tiles) setTile(i, T_F);
      sfx('door'); shake(8); banner(o.n.toUpperCase(), '#ffd43b', 'Se ha abierto');
      saveGame();
      break;
    }
    case 'item':
      GS.items[o.id] = 1;
      for (const [id, n] of o.c) give(id, n);
      saveGame();
      break;
    case 'drop':
      for (const [id, n] of o.c) give(id, n);
      S.drops.splice(S.drops.indexOf(o), 1);
      break;
    case 'msg': S.msg = { txt: o.txt, t: 0, x: o.x, y: o.y }; sfx('menu'); break;
  }
}
function nearbyAggro() { return S.mobs.some(m => !m.dead && m.st !== 'idle' && m.st !== 'return' && dist(m.x, m.y, P.x, P.y) < 500); }

// ---------------------------------------------------------------- jefes y minijefes
function checkArenas() {
  if (S.boss || P.dead) return;
  for (const a of WORLD.arenas) {
    if (GS.bosses[a.id]) continue;
    if (dist(P.x, P.y, a.x, a.y) < a.R - TILE * 1.2) { startBoss(a); break; }
  }
}
function startBoss(a) {
  const ang = Math.atan2(a.y - P.y, a.x - P.x);
  const m = makeMob(a.id, a.x + Math.cos(ang) * a.R * 0.3, a.y + Math.sin(ang) * a.R * 0.3, {});
  m.st = 'intro'; m.t = 0; m.flip = Math.cos(ang) > 0;
  S.mobs.push(m); S.boss = m; S.bossArena = a; S.bossName = m.d.n;
  for (const i of a.fog) setTile(i, T_FOG);
  // si el jugador quedó sobre la niebla, empujarlo dentro
  for (let k = 0; k < 10 && solidTile(Math.floor(P.x / TILE), Math.floor(P.y / TILE)); k++) { P.x += Math.cos(ang) * TILE * 0.5; P.y += Math.sin(ang) * TILE * 0.5; }
  setMusic(REGIONS[a.reg].music, true);
  sfx('roar'); shake(10);
}
function endBossFight(victory) {
  const a = S.bossArena;
  if (a) for (const i of a.fog) setTile(i, T_F);
  if (S.boss && !victory) { const b = S.boss; b.dead = true; for (const o of S.mobs) if (o.owner === b) o.dead = true; }
  S.boss = null; S.bossArena = null;
  setMusic(REGIONS[S.reg >= 0 ? S.reg : 0].music, false);
}
function onBossDead(m) {
  GS.bosses[m.type] = true;
  for (const id of m.d.drop) give(id, 1);
  endBossFight(true);
  shake(16); sfx('victory');
  if (m.d.final) {
    GS.won = true;
    banner('EL ECLIPSE SE DISIPA', '#ffe9a0', 'Umbraterra vuelve a ver el alba');
    S.winT = 0;
  } else {
    const n = GREAT_SOULS.filter(k => P.inv[k]).length;
    banner('GRAN ENEMIGO ABATIDO', '#ffd43b', 'Grandes Almas: ' + n + ' / 5');
  }
  saveGame();
}
function onMiniDead(m) {
  GS.minis[m.id] = 1;
  for (const id of m.d.drop) give(id, 1);
  banner('ENEMIGO DERROTADO', '#e8e0c8', m.d.n);
  sfx('victory');
  saveGame();
}
function onMimicDead(m) {
  const c = m.mimicOf; GS.chests[c.id] = 1; c.awake = false;
  for (const [id, n] of c.c) give(id, n);
  saveGame();
}

// ---------------------------------------------------------------- fijar objetivo
function toggleLock() {
  if (S.lock) { S.lock = null; return; }
  let best = null, bd = 560;
  for (const m of S.mobs) {
    if (m.dead || m.hidden) continue;
    const d = dist(P.x, P.y, m.x, m.y);
    if (d < bd && los(P.x, P.y, m.x, m.y)) { bd = d; best = m; }
  }
  S.lock = best;
  if (!best) sfx('deny');
}

// ---------------------------------------------------------------- actualización
function update(dt) {
  S.time += dt; GS.time += dt;
  if (mouse.t > 0) mouse.t -= dt;
  mouse.wx = (mouse.x - W / 2) / ZOOM + cam.x; mouse.wy = (mouse.y - H / 2) / ZOOM + cam.y;
  if (S.fade) {
    S.fade.t += dt;
    if (!S.fade.done && S.fade.t >= S.fade.dur / 2) { S.fade.done = true; S.fade.cb(); }
    if (S.fade.t >= S.fade.dur) S.fade = null;
  }
  // atajos globales
  if (!P.dead) {
    if (took('Tab', 'MouseM', 'KeyL')) toggleLock();
    if (took('KeyR', 'WheelD')) { P.quick++; currentQuick(); sfx('menu'); }
    if (took('WheelU')) { P.quick--; currentQuick(); sfx('menu'); }
    if (took('KeyE')) { const it = interactables(); if (it) doInteract(it); }
  }
  if (took('KeyM')) { UI.map(); return; }
  if (took('Escape', 'KeyI')) { UI.menu(); return; }
  if (S.lock && (S.lock.dead || dist(P.x, P.y, S.lock.x, S.lock.y) > 750)) S.lock = null;

  updatePlayer(dt);
  // enemigos activos alrededor del jugador
  for (const m of S.mobs) {
    if (m.dead) continue;
    const near = Math.abs(m.x - P.x) < 1350 && Math.abs(m.y - P.y) < 1100;
    if (near || m.st === 'chase' || m.st === 'atk' || m.st === 'return') updateMob(m, dt);
  }
  // separación entre enemigos cercanos
  const act = [];
  for (const m of S.mobs) if (!m.dead && Math.abs(m.x - P.x) < 900 && Math.abs(m.y - P.y) < 700) act.push(m);
  for (let i = 0; i < act.length; i++) for (let j = i + 1; j < act.length; j++) {
    const a = act[i], b = act[j], dx = b.x - a.x, dy = b.y - a.y, rr = (a.r + b.r) * 0.8, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) {
      const d = Math.sqrt(d2), p = (rr - d) / 2, wa = a.boss ? 0.1 : 1, wb = b.boss ? 0.1 : 1;
      a.x -= dx / d * p * wa; a.y -= dy / d * p * wa; b.x += dx / d * p * wb; b.y += dy / d * p * wb;
    }
  }
  // empuje cuerpo a cuerpo con el jugador (no durante la voltereta)
  if (!P.dead && P.st !== 'roll') for (const m of act) {
    if (m.hidden || m.z > 20) continue;
    const dx = P.x - m.x, dy = P.y - m.y, rr = (m.r + P.r) * 0.85, d2 = dx * dx + dy * dy;
    if (d2 < rr * rr && d2 > 0.01) { const d = Math.sqrt(d2); moveEnt(P, dx / d * (rr - d), dy / d * (rr - d), P.r); }
  }
  compact(S.mobs, m => !m.dead || (m.boss && S.boss === m));
  updateProj(dt);
  updateHazards(dt);
  updateFx(dt);
  checkArenas();
  if (S.boss && S.boss.dead) S.boss = null;

  // mancha de sangre (almas perdidas)
  if (GS.blood && !P.dead && dist(P.x, P.y, GS.blood.x, GS.blood.y) < 46) {
    P.souls += GS.blood.souls; toast('Almas recuperadas: ' + GS.blood.souls); sfx('souls');
    burst(GS.blood.x, GS.blood.y, '#7ee36b', 30, 200, 1, 3, -60);
    GS.blood = null;
  }
  // región actual, oscuridad y música
  S.regT -= dt;
  if (S.regT <= 0) {
    S.regT = 0.25;
    const r = regAtW(P.x, P.y);
    if (r !== S.reg) {
      S.reg = r; S.area = { txt: REGIONS[r].n, t: 0 };
      if (!S.boss) setMusic(REGIONS[r].music, false);
    }
  }
  const targetDark = REGIONS[Math.max(0, S.reg)].dark;
  S.dark += (targetDark - S.dark) * Math.min(1, dt * 1.5);
  S.revealT -= dt;
  if (S.revealT <= 0) { S.revealT = 0.2; revealAround(P.x, P.y, 7); }
  flushMap();
  // minijefe en combate (barra superior)
  S.miniBar = null;
  if (!S.boss) for (const m of S.mobs) if (!m.dead && (m.mini || m.type === 'mimic') && (m.st === 'chase' || m.st === 'atk') && dist(m.x, m.y, P.x, P.y) < 900) { S.miniBar = m; break; }
  // mensajes, carteles, avisos
  if (S.msg) { S.msg.t += dt; if (S.msg.t > 8 || dist(P.x, P.y, S.msg.x, S.msg.y) > 90) S.msg = null; }
  if (S.banner) { S.banner.t += dt; if (S.banner.t > S.banner.life) S.banner = null; }
  if (S.area) { S.area.t += dt; if (S.area.t > 3.5) S.area = null; }
  for (const t of S.toasts) t.t += dt;
  compact(S.toasts, t => t.t < 3.5);
  if (S.shake > 0) S.shake = Math.max(0, S.shake - dt * 30);
  if (S.winT >= 0) { S.winT += dt; if (S.winT > 5) { S.winT = -1; UI.victory(); } }
  // partículas de ambiente
  ambient(dt);
  // cámara
  const lead = P.dead ? 0 : 40;
  const tx = P.x + Math.cos(P.aim) * lead, ty = P.y + Math.sin(P.aim) * lead - 10;
  cam.x += (tx - cam.x) * Math.min(1, dt * 6); cam.y += (ty - cam.y) * Math.min(1, dt * 6);
  // autoguardado
  S.saveT += dt; if (S.saveT > 30) { S.saveT = 0; saveGame(); }
}

function ambient(dt) {
  const r = S.reg; if (r < 0) return;
  const rate = LOWQ() ? 6 : 14;
  if (S.amb.length < 90 && Math.random() < rate * dt) {
    const x = cam.x + rnd(-W / ZOOM / 2, W / ZOOM / 2), y = cam.y + rnd(-H / ZOOM / 2, H / ZOOM / 2);
    const k = ['dust', 'leaf', 'spark', 'spore', 'snow', 'ember', 'ash'][r];
    S.amb.push({ k, x, y, vx: k === 'snow' ? rnd(-20, 20) : rnd(-15, 15), vy: k === 'ember' ? rnd(-50, -20) : k === 'snow' || k === 'leaf' ? rnd(20, 50) : rnd(-10, 10), t: 0, life: rnd(3, 6), s: Math.random() * 6 });
  }
  for (const a of S.amb) { a.t += dt; a.x += (a.vx + Math.sin(a.t * 2 + a.s) * 12) * dt; a.y += a.vy * dt; }
  compact(S.amb, a => a.t < a.life);
}

// ---------------------------------------------------------------- render del mundo
function render() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  ctx.fillStyle = '#07050b'; ctx.fillRect(0, 0, W, H);
  const sh = S.shake;
  const cx = cam.x + (sh ? rnd(-sh, sh) : 0) / ZOOM, cy = cam.y + (sh ? rnd(-sh, sh) : 0) / ZOOM;
  ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * (W / 2 - cx * ZOOM), DPR * (H / 2 - cy * ZOOM));
  ctx.imageSmoothingEnabled = false;
  const vw = W / ZOOM / 2, vh = H / ZOOM / 2;
  const x0 = cx - vw - 60, x1 = cx + vw + 60, y0 = cy - vh - 60, y1 = cy + vh + 120;
  const vis = (x, y, m) => x > x0 - m && x < x1 + m && y > y0 - m && y < y1 + m;

  // suelo pre-dibujado
  chunkFrame++;
  const CW = CH * TILE;
  for (let ccy = Math.max(0, Math.floor(y0 / CW)); ccy <= Math.min(NCY - 1, Math.floor(y1 / CW)); ccy++)
    for (let ccx = Math.max(0, Math.floor(x0 / CW)); ccx <= Math.min(NCX - 1, Math.floor(x1 / CW)); ccx++) {
      const c = getChunk(ccx, ccy);
      ctx.drawImage(c, ccx * CW, ccy * CW, CW, CW);
      if (c.haz) {
        ctx.globalAlpha = 0.22 + Math.sin(S.time * 2.2 + ccx + ccy) * 0.12;
        ctx.drawImage(c.haz, ccx * CW, ccy * CW + Math.sin(S.time * 1.5) * 2, CW, CW);
        ctx.globalAlpha = 1;
      }
    }

  // baldosas animadas (rejas, niebla)
  const tx0 = Math.max(0, Math.floor(x0 / TILE)), tx1 = Math.min(MW - 1, Math.floor(x1 / TILE));
  const ty0 = Math.max(0, Math.floor(y0 / TILE)), ty1 = Math.min(MH - 1, Math.floor(y1 / TILE));
  const T = S.time;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = MAP.t[ty * MW + tx];
    if (t !== T_GATE && t !== T_FOG) continue;
    const X = tx * TILE, Y = ty * TILE;
    if (t === T_GATE) drawGateTile(X, Y, tx, ty);
    else {
      // muro de niebla: velo blanquecino con jirones que suben
      ctx.globalAlpha = 0.42 + Math.sin(T * 3 + tx + ty) * 0.1; ctx.fillStyle = '#cfc6e6'; ctx.fillRect(X, Y, TILE, TILE);
      ctx.fillStyle = '#ffffff';
      for (let k = 0; k < 4; k++) {
        const yy = Y + TILE - ((T * 26 + k * 13 + tx * 7) % TILE);
        ctx.globalAlpha = 0.3 * Math.sin(((yy - Y) / TILE) * Math.PI);
        ctx.fillRect(X + ((k * 11 + ty * 5) % (TILE - 12)), yy, 12, 3);
      }
    }
    ctx.globalAlpha = 1;
  }

  // capa de suelo: mancha, mensajes, peligros, objetos tirados
  if (GS.blood && vis(GS.blood.x, GS.blood.y, 40)) {
    const b = GS.blood;
    ctx.fillStyle = `rgba(80,255,120,${0.25 + Math.sin(T * 4) * 0.1})`; ctx.beginPath(); ctx.ellipse(b.x, b.y, 22, 11, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7ee36b'; for (let k = 0; k < 4; k++) { const a = T * 2 + k * 1.57; ctx.fillRect(b.x + Math.cos(a) * 12 - 2, b.y + Math.sin(a) * 6 - 10 - (T * 20 + k * 7) % 20, 3, 3); }
  }
  for (const m of WORLD.msgs) if (vis(m.x, m.y, 30)) {
    ctx.fillStyle = m.hint ? `rgba(255,150,60,${0.45 + Math.sin(T * 2 + m.x) * 0.15})` : `rgba(255,120,60,${0.3 + Math.sin(T * 2 + m.x) * 0.1})`;
    ctx.beginPath(); ctx.ellipse(m.x, m.y + 8, 16, 7, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffd08a'; ctx.fillRect(m.x - 8, m.y + 7, 16, 2); ctx.fillRect(m.x - 1, m.y + 3, 2, 10);
  }
  drawHazardsGround(vis);
  for (const it of WORLD.items) if (!GS.items[it.id] && vis(it.x, it.y, 30)) drawLoot(it.x, it.y, T);
  for (const it of S.drops) if (vis(it.x, it.y, 30)) drawLoot(it.x, it.y, T);

  // objetos y personajes ordenados por profundidad
  const L = [];
  for (const b of WORLD.bonfires) if (vis(b.x, b.y, 60)) L.push({ y: b.y, f: () => drawBonfire(b) });
  for (const c of WORLD.chests) if (!c.awake && vis(c.x, c.y, 40)) L.push({ y: c.y, f: () => drawSpr(ctx, GS.chests[c.id] ? 'chestOpen' : 'chest', c.x, c.y - 6, 3) });
  for (const n of WORLD.npcs) if (vis(n.x, n.y, 60)) L.push({ y: n.y, f: () => drawNpc(n) });
  for (const m of S.mobs) if (!m.dead && vis(m.x, m.y, 140)) L.push({ y: m.y, f: () => drawMob(m) });
  if (!P.dead || P.t < 1.5) L.push({ y: P.y, f: drawPlayer });
  L.sort((a, b) => a.y - b.y);
  for (const o of L) o.f();

  // proyectiles
  for (const p of S.proj) if (vis(p.x, p.y, 30)) drawProj(p);
  drawHazardsTop(vis);
  // efectos
  for (const f of S.fx) if (vis(f.x, f.y, 200)) drawFx(f);
  for (const a of S.amb) drawAmb(a);
  // fijar objetivo
  if (S.lock && !S.lock.dead) {
    const m = S.lock, rr = m.r + 10 + Math.sin(T * 6) * 3;
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const a = k * TAU / 4 + T; ctx.beginPath(); ctx.arc(m.x, m.y - m.z, rr, a, a + 0.6); ctx.stroke(); }
  }
  // números de daño
  ctx.textAlign = 'center';
  for (const t of S.texts) {
    ctx.globalAlpha = 1 - t.t / 0.9;
    ctx.font = (t.big ? 'bold 22px ' : 'bold 16px ') + 'Silkscreen, monospace';
    ctx.fillStyle = '#000'; ctx.fillText(t.txt, t.x + 2, t.y + 2);
    ctx.fillStyle = t.col; ctx.fillText(t.txt, t.x, t.y);
  }
  ctx.globalAlpha = 1;

  drawLighting(cx, cy, x0, y0, x1, y1);
}

function drawGateTile(X, Y, tx, ty) {
  const seal = WORLD.gates.find(g => g.id === 'g_eclipse');
  const isSeal = seal && seal.tiles.includes(ty * MW + tx);
  ctx.fillStyle = isSeal ? '#1a1024' : '#16121c'; ctx.fillRect(X, Y, TILE, TILE);
  if (isSeal) {
    ctx.fillStyle = `rgba(176,102,255,${0.45 + Math.sin(S.time * 2 + tx) * 0.2})`;
    ctx.fillRect(X + 4, Y + 4, TILE - 8, TILE - 8);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(X + TILE / 2 - 2, Y + 8, 4, TILE - 16); ctx.fillRect(X + 10, Y + TILE / 2 - 2, TILE - 20, 4);
  } else {
    ctx.fillStyle = '#6a5a4a';
    for (let k = 0; k < 4; k++) ctx.fillRect(X + 5 + k * 11, Y, 4, TILE);
    ctx.fillRect(X, Y + 10, TILE, 4); ctx.fillRect(X, Y + 32, TILE, 4);
    ctx.fillStyle = '#9a8a6a'; for (let k = 0; k < 4; k++) ctx.fillRect(X + 5 + k * 11, Y, 1, TILE);
  }
}
function drawLoot(x, y, T) {
  const p = 0.6 + Math.sin(T * 4 + x) * 0.3;
  ctx.fillStyle = `rgba(255,240,200,${0.25 * p})`; ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
  ctx.fillStyle = '#fff6d8'; ctx.fillRect(x - 3, y - 3, 6, 6);
  ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 9 - (T * 25 + x) % 12, 2, 2);
}
function drawBonfire(b) {
  const lit = P.lit[b.id], T = S.time;
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 8, 28, 10, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#4a4552';
  for (let k = 0; k < 7; k++) { const a = k / 7 * TAU; ctx.fillRect(b.x + Math.cos(a) * 20 - 5, b.y + Math.sin(a) * 8 - 2, 10, 7); }
  ctx.fillStyle = '#2a2232'; ctx.fillRect(b.x - 14, b.y - 2, 28, 8);
  // espada clavada
  ctx.fillStyle = '#8a8698'; ctx.fillRect(b.x - 2, b.y - 46, 5, 44);
  ctx.fillStyle = '#b8860b'; ctx.fillRect(b.x - 9, b.y - 46, 19, 4);
  ctx.fillStyle = '#5a3825'; ctx.fillRect(b.x - 2, b.y - 58, 5, 12);
  if (lit) {
    for (let k = 0; k < 5; k++) {
      const h = 22 + Math.sin(T * 9 + k * 1.7) * 7 + k * 2, w = 14 - k * 2;
      ctx.fillStyle = ['#b33a14', '#ff5a1a', '#ff8a2a', '#ffb04a', '#ffe08a'][k];
      ctx.beginPath(); ctx.moveTo(b.x - w, b.y + 2); ctx.quadraticCurveTo(b.x + Math.sin(T * 7 + k) * 5, b.y - h * 1.6, b.x + w, b.y + 2); ctx.fill();
    }
    if (Math.random() < 0.3) addFx({ k: 'p', x: b.x + rnd(-10, 10), y: b.y - 10, vx: rnd(-15, 15), vy: rnd(-90, -40), t: 0, life: rnd(0.6, 1.2), col: '#ffb04a', sz: 2 });
  } else {
    ctx.fillStyle = '#3a3048'; ctx.fillRect(b.x - 10, b.y - 4, 20, 6);
    if (Math.random() < 0.05) addFx({ k: 'p', x: b.x + rnd(-6, 6), y: b.y - 6, vx: rnd(-6, 6), vy: -25, t: 0, life: 1.4, col: '#6a6678', sz: 3 });
  }
}
function drawNpc(n) {
  ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(n.x, n.y + 12, 16, 6, 0, 0, TAU); ctx.fill();
  const bob = Math.sin(S.time * 2 + n.x) * 1.5;
  drawSpr(ctx, n.spr, n.x, n.y - 14 + bob, 3, P.x < n.x);
  if (dist(P.x, P.y, n.x, n.y) < 160) {
    ctx.font = '11px Silkscreen, monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = '#000'; ctx.fillText(n.n, n.x + 1, n.y - 47); ctx.fillStyle = '#ffd43b'; ctx.fillText(n.n, n.x, n.y - 48);
  }
}

function drawPlayer() {
  const T = S.time;
  let alpha = 1;
  if (P.dead) alpha = Math.max(0, 1 - P.t / 1.5);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.beginPath(); ctx.ellipse(P.x, P.y + 12, 15, 6, 0, 0, TAU); ctx.fill();
  const flip = Math.cos(P.aim) < 0;
  const moving = Math.hypot(P.vx, P.vy) > 30 && P.st === 'move';
  const bob = moving ? Math.abs(Math.sin(T * 12)) * 3 : Math.sin(T * 2) * 0.8;
  const flash = P.flash > 0 || (P.iframe > 0 && P.st !== 'roll' && Math.floor(T * 20) % 2 === 0 && P.iframe < 0.45);
  const A = P.atk;
  const back = Math.sin(P.aim) < -0.3;
  if (P.st !== 'roll' && back) drawPlayerWeapon(A);
  if (P.st === 'roll') {
    const p = P.t / 0.44;
    ctx.save(); ctx.translate(P.x, P.y - 8); ctx.rotate((Math.cos(P.rollA) < 0 ? -1 : 1) * p * TAU); ctx.scale(1, 0.8);
    drawSpr(ctx, 'player', 0, 0, 3, Math.cos(P.rollA) < 0, false, 0.9);
    ctx.restore();
  } else {
    drawSpr(ctx, 'player', P.x, P.y - 12 - bob, 3, flip, flash);
  }
  if (P.st !== 'roll' && !back) drawPlayerWeapon(A);
  if (P.st === 'drink') {
    ctx.fillStyle = `rgba(255,200,80,${0.4 * Math.sin(P.t / 0.9 * Math.PI)})`; ctx.beginPath(); ctx.arc(P.x, P.y - 12, 28, 0, TAU); ctx.fill();
    drawIcon(ctx, 'frasco', P.x + 14, P.y - 22, 16);
  }
  if (P.buf.resin > 0 && Math.random() < 0.4) addFx({ k: 'p', x: P.x + Math.cos(P.aim) * 30, y: P.y - 12 + Math.sin(P.aim) * 30, vx: 0, vy: -50, t: 0, life: 0.3, col: '#ff8a2a', sz: 3 });
  ctx.globalAlpha = 1;
}
function drawPlayerWeapon(A) {
  const w = WEAPONS[P.weapon];
  let ang = P.aim + (Math.cos(P.aim) < 0 ? -0.9 : 0.9), ext = 0;
  if (A) {
    const s = A.rev ? -1 : 1, half = Math.min(A.arc, TAU) / 2;
    if (A.type === 'thrust') { ang = A.aim; ext = A.ph === 'wind' ? -12 * (A.t / A.wind) : A.ph === 'act' ? 22 : 22 * (1 - A.t / A.rec); }
    else if (A.type === 'spin') { ang = A.ph === 'wind' ? A.aim - 0.5 : A.ph === 'act' ? A.aim + (A.t / A.act) * TAU : A.aim; }
    else {
      const a0 = A.aim - s * (half + 0.3), a1 = A.aim + s * half;
      ang = A.ph === 'wind' ? a0 : A.ph === 'act' ? a0 + (a1 - a0) * clamp(A.t / A.act, 0, 1) : a1;
    }
  }
  const hx = P.x + Math.cos(P.aim) * 6, hy = P.y - 10 + Math.sin(P.aim) * 4;
  ctx.save(); ctx.translate(hx + Math.cos(ang) * ext, hy + Math.sin(ang) * ext); ctx.rotate(ang);
  drawWeaponShape(ctx, w.kind, w.len, w.col, P.buf.resin > 0 ? 'fire' : w.el);
  ctx.restore();
}

function drawMob(m) {
  const sp = SPR[m.spr]; if (!sp) return;
  const T = S.time;
  const shR = m.r * 1.0;
  // sombra (crece cuando cae desde arriba)
  if (m.hidden) {
    const p = m.a && m.a.t === 'leap' ? clamp(m.t / m.a.act, 0, 1) : 0.5;
    ctx.fillStyle = `rgba(0,0,0,${0.2 + p * 0.35})`; ctx.beginPath(); ctx.ellipse(m.tx, m.ty + 10, shR * (0.4 + p), shR * 0.4 * (0.4 + p), 0, 0, TAU); ctx.fill();
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(m.x, m.y + m.r * 0.5, shR, shR * 0.38, 0, 0, TAU); ctx.fill();
  }
  // telégrafos
  if (m.st === 'atk' && m.a) drawTelegraph(m);
  if (m.hidden) return;
  const h = sp.h * m.sc;
  let bob = 0;
  if (m.d.fly) bob = Math.sin(m.anim * 6) * 5 + 10;
  else if (m.st === 'chase' || m.st === 'return') bob = Math.abs(Math.sin(m.anim * 9)) * 2;
  let flash = m.flash > 0;
  let alpha = m.alpha;
  // destello de aviso antes del golpe
  if (m.st === 'atk' && m.ph === 'wind' && m.t > m.a.wind * m.tm * 0.55 && Math.floor(T * 16) % 2 === 0) flash = true;
  if (m.invuln > 0 && Math.floor(T * 12) % 2 === 0) alpha *= 0.5;
  const yy = m.y - h / 2 + m.r * 0.55 - m.z - bob;
  if (m.st === 'stagger') { ctx.save(); ctx.translate(m.x, yy); ctx.rotate(Math.sin(m.t * 30) * 0.08); drawSpr(ctx, m.spr, 0, 0, m.sc, m.flip, flash, alpha); ctx.restore(); }
  else drawSpr(ctx, m.spr, m.x, yy, m.sc, m.flip, flash, alpha);
  if (m.st === 'atk' && m.ph === 'wind' && (m.boss || m.mini)) {
    ctx.fillStyle = `rgba(255,80,40,${0.25 + 0.2 * Math.sin(T * 20)})`; ctx.beginPath(); ctx.arc(m.x, yy - h * 0.25, 6, 0, TAU); ctx.fill();
  }
  // estados
  if (m.pois > 0 || m.burn > 0 || m.slow > 0) {
    const c = m.burn > 0 ? '#ff8a2a' : m.pois > 0 ? '#7ee36b' : '#8ff3ff';
    if (Math.random() < 0.3) addFx({ k: 'p', x: m.x + rnd(-m.r, m.r), y: yy + rnd(-h / 3, h / 3), vx: 0, vy: -40, t: 0, life: 0.5, col: c, sz: 3 });
  }
  // barra de vida (enemigos normales heridos)
  if (!m.boss && !m.mini && m.hp < m.max) {
    const w = Math.max(30, m.r * 2.4), x = m.x - w / 2, y = yy - h / 2 - 10;
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 1, y - 1, w + 2, 6);
    ctx.fillStyle = '#c0303a'; ctx.fillRect(x, y, w * Math.max(0, m.hp / m.max), 4);
  }
}

function drawTelegraph(m) {
  const a = m.a, T = S.time;
  const W0 = a.wind * m.tm, p = m.ph === 'wind' ? clamp(m.t / W0, 0, 1) : 1;
  ctx.save();
  if (a.t === 'melee' && m.ph === 'wind') {
    const r = a.reach + m.r * 0.6;
    ctx.fillStyle = `rgba(255,60,40,${(m.boss || m.mini ? 0.12 : 0.07) + p * 0.12})`;
    ctx.beginPath(); ctx.moveTo(m.x, m.y);
    if (a.arc >= TAU - 0.01) ctx.arc(m.x, m.y, r, 0, TAU); else ctx.arc(m.x, m.y, r, m.aim - a.arc / 2, m.aim + a.arc / 2);
    ctx.closePath(); ctx.fill();
  } else if (a.t === 'charge' && m.ph === 'wind') {
    const len = Math.min(a.spd * a.act, rayLen(m.x, m.y, m.aim, a.spd * a.act + 40));
    ctx.translate(m.x, m.y); ctx.rotate(m.aim);
    ctx.fillStyle = `rgba(255,60,40,${0.12 + p * 0.15})`; ctx.fillRect(0, -m.r * 0.8, len, m.r * 1.6);
    ctx.fillStyle = `rgba(255,90,60,${0.5})`; ctx.fillRect(0, -m.r * 0.8, len * p, 3); ctx.fillRect(0, m.r * 0.8 - 3, len * p, 3);
  } else if (a.t === 'leap') {
    const tx = m.tx, ty = m.ty;
    const q = m.ph === 'wind' ? p * 0.3 : m.ph === 'act' ? 0.3 + clamp(m.t / a.act, 0, 1) * 0.7 : 1;
    if (m.ph !== 'rec') {
      ctx.fillStyle = `rgba(255,50,40,${0.15 + q * 0.15})`; ctx.beginPath(); ctx.arc(tx, ty, a.r, 0, TAU); ctx.fill();
      ctx.fillStyle = 'rgba(255,70,50,0.3)'; ctx.beginPath(); ctx.arc(tx, ty, a.r * q, 0, TAU); ctx.fill();
      ctx.strokeStyle = 'rgba(255,100,80,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(tx, ty, a.r, 0, TAU); ctx.stroke();
    }
  } else if (a.t === 'slam' && m.ph === 'wind') {
    const ox = m.x + Math.cos(m.aim) * (a.off || 0), oy = m.y + Math.sin(m.aim) * (a.off || 0);
    ctx.fillStyle = `rgba(255,50,40,${0.12 + p * 0.1})`; ctx.beginPath(); ctx.arc(ox, oy, a.r, 0, TAU); ctx.fill();
    ctx.fillStyle = 'rgba(255,70,50,0.3)'; ctx.beginPath(); ctx.arc(ox, oy, a.r * p, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,100,80,0.7)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(ox, oy, a.r, 0, TAU); ctx.stroke();
  } else if (a.t === 'beam') {
    const nb = a.beams || 1, base = m.ph === 'wind' ? m.aim - a.rot * a.act / 2 * (m.bdir || 1) : m.spin;
    for (let b = 0; b < nb; b++) {
      const ang = base + b * TAU / nb;
      const len = rayLen(m.x, m.y, ang, a.len);
      ctx.save(); ctx.translate(m.x, m.y - 20); ctx.rotate(ang);
      if (m.ph === 'wind') { ctx.fillStyle = `rgba(255,80,40,${0.2 + p * 0.4})`; ctx.fillRect(0, -2, len, 4); }
      else if (m.ph === 'act') {
        const col = a.col || '#ffb030';
        ctx.globalAlpha = 0.35; ctx.fillStyle = col; ctx.fillRect(0, -a.w * 0.8, len, a.w * 1.6);
        ctx.globalAlpha = 0.9; ctx.fillRect(0, -a.w / 2, len, a.w);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(0, -a.w / 5, len, a.w / 2.5);
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    }
  } else if ((a.t === 'shoot' || a.t === 'nova' || a.t === 'spiral' || a.t === 'summon') && m.ph === 'wind') {
    const col = a.k === 'fire' ? '255,140,40' : a.k === 'acid' ? '120,255,120' : a.k === 'ice' ? '140,240,255' : a.k === 'dark' || a.k === 'crescent' ? '180,100,255' : '255,240,200';
    ctx.fillStyle = `rgba(${col},${0.2 + p * 0.4})`; ctx.beginPath(); ctx.arc(m.x, m.y - 20, 8 + p * 16, 0, TAU); ctx.fill();
  } else if (a.t === 'teleport' && m.ph === 'wind') {
    ctx.strokeStyle = `rgba(180,100,255,${p})`; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(m.x, m.y, m.r + 10 + p * 20, 0, TAU); ctx.stroke();
  }
  ctx.restore();
}

function drawProj(p) {
  const col = projCol(p);
  if (p.k === 'arrow' || p.k === 'knife') {
    const a = Math.atan2(p.vy, p.vx);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    ctx.fillStyle = p.k === 'knife' ? '#cfd6df' : '#8a5a3b'; ctx.fillRect(-14, -1, 20, 3);
    ctx.fillStyle = '#e8e0c8'; ctx.fillRect(4, -3, 6, 7);
    ctx.restore();
  } else if (p.k === 'crescent' || p.k === 'light') {
    const a = Math.atan2(p.vy, p.vx);
    ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a);
    ctx.fillStyle = p.k === 'light' ? 'rgba(255,240,180,0.85)' : 'rgba(176,102,255,0.85)';
    ctx.beginPath(); ctx.arc(-p.r * 0.6, 0, p.r * 1.3, -1.2, 1.2); ctx.arc(-p.r * 1.1, 0, p.r * 1.1, 1.1, -1.1, true); ctx.fill();
    ctx.restore();
  } else if (p.k === 'web') {
    ctx.strokeStyle = '#f4f4f4'; ctx.lineWidth = 2;
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 4 + p.t * 4; ctx.beginPath(); ctx.moveTo(p.x - Math.cos(a) * p.r, p.y - Math.sin(a) * p.r); ctx.lineTo(p.x + Math.cos(a) * p.r, p.y + Math.sin(a) * p.r); ctx.stroke(); }
  } else if (p.k === 'rock') {
    ctx.fillStyle = '#6a5a4a'; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8a7a6a'; ctx.fillRect(p.x - p.r / 2, p.y - p.r / 2, p.r / 2, p.r / 2);
  } else {
    ctx.fillStyle = col; ctx.globalAlpha = 0.35; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * 1.8, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff'; ctx.fillRect(p.x - 2, p.y - 2, 4, 4);
  }
}

function drawHazardsGround(vis) {
  const T = S.time;
  for (const h of S.hz) {
    if (!vis(h.x, h.y, (h.r || 0) + (h.max || 0))) continue;
    if (h.k === 'circle' && !h.done) {
      const p = clamp(h.t / h.delay, 0, 1);
      ctx.fillStyle = h.own ? 'rgba(255,160,60,0.12)' : 'rgba(255,40,40,0.16)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.fill();
      ctx.fillStyle = h.own ? 'rgba(255,160,60,0.25)' : 'rgba(255,60,40,0.3)'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r * p, 0, TAU); ctx.fill();
      ctx.strokeStyle = h.own ? 'rgba(255,190,90,0.7)' : 'rgba(255,90,70,0.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
    } else if (h.k === 'pool') {
      const a = Math.min(1, (h.life - h.t) * 2, h.t * 4) * 0.4;
      ctx.fillStyle = rgbaHex(h.col, a); ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.75, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = rgbaHex(h.col, a * 1.5);
      for (let k = 0; k < 3; k++) { const ang = k * 2.1 + T; ctx.fillRect(h.x + Math.cos(ang) * h.r * 0.5, h.y + Math.sin(ang) * h.r * 0.35 - ((T * 30 + k * 10) % 20), 4, 4); }
    }
  }
}
function drawHazardsTop(vis) {
  for (const h of S.hz) {
    if (h.k === 'ring') {
      if (!vis(h.x, h.y, h.r + 40)) continue;
      const a = Math.max(0, 1 - h.r / h.max);
      ctx.strokeStyle = rgbaHex(h.col || '#e8e0c8', 0.75 * a + 0.2); ctx.lineWidth = h.w;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.85, 0, 0, TAU); ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,255,${0.6 * a})`; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.ellipse(h.x, h.y, h.r, h.r * 0.85, 0, 0, TAU); ctx.stroke();
    } else if (h.k === 'circle' && !h.done && (h.lob || h.meteor)) {
      const p = clamp(h.t / h.delay, 0, 1);
      let x, y;
      if (h.lob) { x = h.lob.x + (h.x - h.lob.x) * p; y = h.lob.y + (h.y - h.lob.y) * p - Math.sin(Math.PI * p) * 140; }
      else { x = h.x + (1 - p) * 120; y = h.y - (1 - p) * 600; }
      if (p > 0.05 || h.lob) {
        ctx.fillStyle = rgbaHex(h.col, 0.4); ctx.beginPath(); ctx.arc(x, y, 16, 0, TAU); ctx.fill();
        ctx.fillStyle = h.own ? '#3a4048' : h.col; ctx.beginPath(); ctx.arc(x, y, 9, 0, TAU); ctx.fill();
        if (h.meteor && Math.random() < 0.6) addFx({ k: 'p', x, y, vx: rnd(-20, 20), vy: -40, t: 0, life: 0.4, col: h.col, sz: 4 });
      }
    }
  }
}
function rgbaHex(hex, a) { const c = hexRGB(hex); return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

function drawFx(f) {
  const p = f.t / f.life;
  switch (f.k) {
    case 'p':
      ctx.globalAlpha = 1 - p; ctx.fillStyle = f.col; ctx.fillRect(f.x - f.sz / 2, f.y - f.sz / 2, f.sz, f.sz); ctx.globalAlpha = 1; break;
    case 'soul':
      ctx.fillStyle = '#c8f8ff'; ctx.globalAlpha = 0.9; ctx.fillRect(f.x - 2, f.y - 2, 4, 4); ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.arc(f.x, f.y, 6, 0, TAU); ctx.fill(); ctx.globalAlpha = 1; break;
    case 'slash': {
      const prog = clamp(p * 1.6, 0, 1), s = f.rev ? -1 : 1;
      const a0 = f.a - s * f.arc / 2, a1 = a0 + s * f.arc * prog;
      ctx.globalAlpha = (1 - p) * 0.7; ctx.fillStyle = f.col;
      ctx.beginPath();
      if (f.arc >= TAU - 0.01) { ctx.arc(f.x, f.y, f.r, 0, TAU); ctx.arc(f.x, f.y, f.r * 0.62, TAU, 0, true); }
      else { ctx.arc(f.x, f.y, f.r, Math.min(a0, a1), Math.max(a0, a1)); ctx.arc(f.x, f.y, f.r * 0.62, Math.max(a0, a1), Math.min(a0, a1), true); }
      ctx.fill(); ctx.globalAlpha = 1; break;
    }
    case 'thrust':
      ctx.save(); ctx.translate(f.x, f.y - 8); ctx.rotate(f.a); ctx.globalAlpha = (1 - p) * 0.7; ctx.fillStyle = f.col;
      ctx.beginPath(); ctx.moveTo(10, -7); ctx.lineTo(f.r, 0); ctx.lineTo(10, 7); ctx.fill(); ctx.restore(); ctx.globalAlpha = 1; break;
    case 'shock':
      ctx.globalAlpha = (1 - p) * 0.8; ctx.strokeStyle = f.col; ctx.lineWidth = 6 * (1 - p) + 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y, f.r * (0.6 + p * 0.5), f.r * (0.6 + p * 0.5) * 0.8, 0, 0, TAU); ctx.stroke(); ctx.globalAlpha = 1; break;
    case 'spike': {
      ctx.globalAlpha = 1 - p; ctx.fillStyle = f.col;
      const hgt = 40 * Math.sin(Math.min(1, p * 3) * Math.PI / 2) * (1 - p * 0.5);
      for (let k = -1; k <= 1; k++) { ctx.beginPath(); ctx.moveTo(f.x + k * 12 - 7, f.y); ctx.lineTo(f.x + k * 12, f.y - hgt * (k ? 0.7 : 1)); ctx.lineTo(f.x + k * 12 + 7, f.y); ctx.fill(); }
      ctx.globalAlpha = 1; break;
    }
    case 'alert':
      ctx.fillStyle = '#ffd43b'; ctx.font = 'bold 20px Silkscreen, monospace'; ctx.textAlign = 'center';
      ctx.globalAlpha = 1 - p; ctx.fillText('!', f.m ? f.m.x : f.x, (f.m ? f.m.y - f.m.r - 40 : f.y) - p * 10); ctx.globalAlpha = 1; break;
  }
}
function drawAmb(a) {
  const p = a.t / a.life, al = Math.min(1, p * 4, (1 - p) * 3);
  ctx.globalAlpha = al * 0.7;
  const c = { dust: '#c8c0d8', leaf: '#8a6a3a', spark: '#8ff3ff', spore: '#b8e070', snow: '#ffffff', ember: '#ff8a2a', ash: '#b066ff' }[a.k];
  ctx.fillStyle = c; ctx.fillRect(a.x, a.y, a.k === 'leaf' ? 4 : 2, a.k === 'snow' ? 3 : 2);
  ctx.globalAlpha = 1;
}

// ---------------------------------------------------------------- luz
function drawLighting(cx, cy, x0, y0, x1, y1) {
  const dark = S.dark;
  const lw = lightCv.width, lh = lightCv.height, k = ZOOM / LS;
  const T = S.time;
  const toL = (x, y) => [(x - cx) * k + lw / 2, (y - cy) * k + lh / 2];
  if (dark > 0.02) {
    lctx.setTransform(1, 0, 0, 1, 0, 0);
    lctx.globalCompositeOperation = 'source-over';
    lctx.clearRect(0, 0, lw, lh);
    lctx.fillStyle = `rgba(3,2,8,${dark})`; lctx.fillRect(0, 0, lw, lh);
    lctx.globalCompositeOperation = 'destination-out';
    const light = (x, y, r, a) => {
      const [sx, sy] = toL(x, y), rr = r * k;
      if (sx + rr < 0 || sy + rr < 0 || sx - rr > lw || sy - rr > lh) return;
      lctx.globalAlpha = a; lctx.drawImage(SPR._glow, sx - rr, sy - rr, rr * 2, rr * 2);
    };
    const lant = P.inv.linterna ? 1.75 : 1;
    light(P.x, P.y - 10, (250 + Math.sin(T * 7) * 6) * lant, 1);
    light(P.x, P.y - 10, 120 * lant, 1);
    for (const b of WORLD.bonfires) light(b.x, b.y - 20, P.lit[b.id] ? 380 + Math.sin(T * 9) * 12 : 90, 1);
    const CW = CH * TILE;
    for (let ccy = Math.max(0, Math.floor(y0 / CW)); ccy <= Math.min(NCY - 1, Math.floor(y1 / CW)); ccy++)
      for (let ccx = Math.max(0, Math.floor(x0 / CW)); ccx <= Math.min(NCX - 1, Math.floor(x1 / CW)); ccx++)
        for (const l of WORLD.lightBuckets[ccy * NCX + ccx]) light(l.x, l.y, l.r + (l.torch ? Math.sin(T * 10 + l.x) * 8 : 0), 0.9);
    for (const p of S.proj) if (p.k !== 'arrow' && p.k !== 'rock' && p.k !== 'knife') light(p.x, p.y, 70, 0.7);
    for (const h of S.hz) if (h.k === 'pool' || (h.k === 'circle' && !h.done)) light(h.x, h.y, (h.r || 40) * 1.3, 0.5);
    for (const it of WORLD.items) if (!GS.items[it.id]) light(it.x, it.y, 60, 0.6);
    for (const m of WORLD.msgs) light(m.x, m.y, 50, 0.5);
    for (const n of WORLD.npcs) light(n.x, n.y - 20, 120, 0.7);
    if (GS.blood) light(GS.blood.x, GS.blood.y, 70, 0.7);
    for (const m of S.mobs) if (!m.dead && (m.boss || m.mini)) light(m.x, m.y - 20, 160, 0.5);
    for (const f of S.fx) if (f.k === 'shock') light(f.x, f.y, f.r * 1.4, 0.6 * (1 - f.t / f.life));
    lctx.globalAlpha = 1; lctx.globalCompositeOperation = 'source-over';
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(lightCv, 0, 0, lw, lh, 0, 0, cv.width, cv.height);
    ctx.imageSmoothingEnabled = false;
  }
  // brillos de color aditivos
  if (!LOWQ()) {
    ctx.setTransform(DPR * ZOOM, 0, 0, DPR * ZOOM, DPR * (W / 2 - cx * ZOOM), DPR * (H / 2 - cy * ZOOM));
    ctx.globalCompositeOperation = 'lighter';
    const glow = (img, x, y, r, a) => { ctx.globalAlpha = a; ctx.drawImage(img, x - r, y - r, r * 2, r * 2); };
    for (const b of WORLD.bonfires) if (P.lit[b.id] && x0 < b.x && b.x < x1 && y0 < b.y && b.y < y1) glow(SPR._gFire, b.x, b.y - 20, 110 + Math.sin(T * 9) * 6, 0.45);
    const CW = CH * TILE;
    for (let ccy = Math.max(0, Math.floor(y0 / CW)); ccy <= Math.min(NCY - 1, Math.floor(y1 / CW)); ccy++)
      for (let ccx = Math.max(0, Math.floor(x0 / CW)); ccx <= Math.min(NCX - 1, Math.floor(x1 / CW)); ccx++)
        for (const l of WORLD.lightBuckets[ccy * NCX + ccx]) {
          if (l.lava) continue;
          const img = l.col === 'c' ? SPR._gCyan : l.col === 'p' ? SPR._gPurp : l.col === 'g' ? SPR._gGreen : SPR._gFire;
          glow(img, l.x, l.y, l.torch ? 50 : 40, 0.35);
          if (l.torch) { ctx.globalAlpha = 1; ctx.fillStyle = '#ffb04a'; ctx.fillRect(l.x - 3, l.y - 22 + Math.sin(T * 12 + l.x) * 2, 6, 8); ctx.fillStyle = '#5a3825'; ctx.fillRect(l.x - 2, l.y - 14, 4, 10); }
        }
    for (const p of S.proj) {
      const img = p.k === 'fire' ? SPR._gFire : p.k === 'ice' ? SPR._gCyan : p.k === 'acid' ? SPR._gGreen : p.k === 'dark' || p.k === 'crescent' ? SPR._gPurp : p.k === 'light' ? SPR._gWhite : null;
      if (img) glow(img, p.x, p.y, 30, 0.5);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }
}

// ---------------------------------------------------------------- bucle
let lastT = 0;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = Math.min(0.05, (now - lastT) / 1000 || 0.016);
  lastT = now;
  if (typeof TOUCH !== 'undefined') TOUCH.poll && TOUCH.poll();
  musicUpdate();
  if (!S || !P) { renderTitle(dt); clearPressed(); return; }
  if (S.mode === 'play') {
    if (S.hitStop > 0) { S.hitStop -= dt; dt *= 0.15; }
    update(dt);
  } else if (S.mode === 'title') { renderTitle(dt); clearPressed(); return; }
  render();
  drawHUD();
  S.frames++; S.fpsT += dt;
  if (S.fpsT >= 0.5) { S.fps = Math.round(S.frames / S.fpsT); S.frames = 0; S.fpsT = 0; }
  clearPressed();
}

// fondo animado del título: hoguera con ascuas
const titleFx = [];
function renderTitle(dt) {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#07050b'); g.addColorStop(1, '#1a0c10');
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  const t = performance.now() / 1000, bx = W / 2, by = H * 0.86;
  const rg = ctx.createRadialGradient(bx, by, 10, bx, by, Math.max(W, H) * 0.5);
  rg.addColorStop(0, 'rgba(255,140,40,0.35)'); rg.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  if (titleFx.length < 120 && Math.random() < 0.8) titleFx.push({ x: bx + rnd(-30, 30), y: by, vx: rnd(-20, 20), vy: rnd(-120, -50), t: 0, life: rnd(2, 5), s: Math.random() * 6 });
  for (const f of titleFx) { f.t += dt; f.x += (f.vx + Math.sin(f.t * 2 + f.s) * 25) * dt; f.y += f.vy * dt; }
  compact(titleFx, f => f.t < f.life);
  for (const f of titleFx) { ctx.globalAlpha = 1 - f.t / f.life; ctx.fillStyle = f.t < 1 ? '#ffd08a' : '#ff8a2a'; ctx.fillRect(f.x, f.y, 3, 3); }
  ctx.globalAlpha = 1;
  for (let k = 0; k < 5; k++) {
    const h = 40 + Math.sin(t * 9 + k * 1.7) * 10 + k * 4, w = 26 - k * 4;
    ctx.fillStyle = ['#b33a14', '#ff5a1a', '#ff8a2a', '#ffb04a', '#ffe08a'][k];
    ctx.beginPath(); ctx.moveTo(bx - w, by); ctx.quadraticCurveTo(bx + Math.sin(t * 7 + k) * 8, by - h * 1.7, bx + w, by); ctx.fill();
  }
  ctx.fillStyle = '#8a8698'; ctx.fillRect(bx - 3, by - 90, 7, 84);
  ctx.fillStyle = '#b8860b'; ctx.fillRect(bx - 16, by - 90, 33, 6);
}

function boot() {
  buildAllSprites();
  generateWorld();
  resize();
  UI.init();
  requestAnimationFrame(frame);
}
window.addEventListener('load', boot);
