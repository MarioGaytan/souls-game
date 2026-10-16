'use strict';
// =====================================================================
//  MUNDO — mapa de 200×200 baldosas generado de forma determinista
//  (siempre el mismo mundo). Regiones por Voronoi deformado con ruido,
//  cuevas por autómata celular, catacumbas por salas, pasillos que
//  garantizan el recorrido, rejas con llave, arenas de jefe con muro de
//  niebla, paredes ilusorias y salas secretas.
//  Render del suelo: trozos de 16×16 baldosas pre-dibujados a 16 px por
//  baldosa y escalados ×3 sin suavizado (pixel art barato en memoria).
// =====================================================================

const TILE = 48, MW = 200, MH = 200, TPX = 16, CH = 16;
const T_F = 0, T_W = 1, T_WATER = 2, T_LAVA = 3, T_ICE = 4, T_GATE = 5, T_FOG = 6, T_FAKE = 7;
const NCX = Math.ceil(MW / CH), NCY = Math.ceil(MH / CH);

// ---------------------------------------------------------------- disposición
const LINKS = [
  { pts: [[100, 100], [100, 62]] },
  { pts: [[100, 100], [78, 96], [56, 92]] },
  { pts: [[100, 100], [122, 104], [142, 106]] },
  { pts: [[100, 100], [101, 120], [103, 140]], gate: 'g_cat', key: 'llave_cat', a: 0, b: 4, n: 'Reja de las Catacumbas' },
  { pts: [[25, 105], [35, 112], [35, 142]], gate: 'g_forja', key: 'llave_forja', a: 2, b: 5, n: 'Puerta de la Forja' },
  { pts: [[100, 45], [125, 45], [152, 40]], gate: 'g_eclipse', key: 'souls5', a: 1, b: 6, n: 'Sello del Eclipse' },
  { pts: [[80, 30], [66, 38], [52, 44]] },
];
const PATHS = [
  [[100, 62], [100, 58], [86, 52], [78, 40], [92, 30], [100, 27], [115, 16]],
  [[56, 92], [52, 92], [40, 100], [25, 105], [18, 88], [28, 68], [40, 57], [28, 44], [20, 28]],
  [[142, 106], [146, 106], [160, 94], [176, 84], [186, 104], [172, 124], [160, 134], [180, 145]],
  [[103, 140], [86, 150], [80, 165], [98, 178], [118, 175], [137, 184]],
  [[35, 142], [22, 152], [48, 160], [56, 176], [45, 184], [18, 180]],
  [[152, 40], [162, 54], [182, 58], [188, 42], [172, 38], [160, 34], [178, 16]],
];
const BONFIRES = [
  { id: 'bf_hub', n: 'Santuario de Enlace', x: 100, y: 100 },
  { id: 'bf_f1', n: 'Linde del Bosque', x: 100, y: 59 },
  { id: 'bf_f2', n: 'Claro de los Ahorcados', x: 99, y: 29 },
  { id: 'bf_c1', n: 'Boca de la Gruta', x: 52, y: 93 },
  { id: 'bf_c2', n: 'Lago Cristalino', x: 40, y: 58 },
  { id: 'bf_s1', n: 'Muelle Podrido', x: 146, y: 107 },
  { id: 'bf_s2', n: 'Choza de la Bruja', x: 161, y: 133 },
  { id: 'bf_k1', n: 'Antesala Helada', x: 103, y: 142 },
  { id: 'bf_k2', n: 'Osario Profundo', x: 117, y: 176 },
  { id: 'bf_g1', n: 'Puerta de Escoria', x: 35, y: 145 },
  { id: 'bf_g2', n: 'Yunque Roto', x: 46, y: 183 },
  { id: 'bf_e1', n: 'Atrio del Eclipse', x: 154, y: 41 },
  { id: 'bf_e2', n: 'Trono Velado', x: 161, y: 35 },
];
const ARENAS = [
  { id: 'gorvak', x: 115, y: 16, R: 9 },
  { id: 'sythra', x: 20, y: 28, R: 9 },
  { id: 'hidra', x: 180, y: 145, R: 10 },
  { id: 'halvard', x: 137, y: 184, R: 9 },
  { id: 'brasamor', x: 18, y: 180, R: 9 },
  { id: 'eclipse', x: 178, y: 16, R: 10 },
];
const MINIS = [
  { id: 'm_bk', type: 'blackknight', x: 78, y: 40 },
  { id: 'm_troll', type: 'troll', x: 25, y: 105 },
  { id: 'm_sapo', type: 'sapo', x: 176, y: 84 },
  { id: 'm_verdugo', type: 'verdugo', x: 80, y: 165 },
  { id: 'm_demonio', type: 'demonio', x: 48, y: 160 },
  { id: 'm_garg1', type: 'gargola', x: 179, y: 57 },
  { id: 'm_garg2', type: 'gargola', x: 185, y: 60 },
  { id: 'm_eknight', type: 'eknight', x: 188, y: 42 },
];
const NPCS = [
  { id: 'smith', n: 'Brunhild, la Herrera', spr: 'smith', x: 96, y: 96 },
  { id: 'merchant', n: 'Oswin, el Mercader', spr: 'merchant', x: 104, y: 96 },
];
const REGION_LOOT = {
  1: [['espada_larga'], ['anillo_vida'], ['titanita', 2], ['fragmento'], ['bomba', 3], ['hierba', 2], ['alma_p', 2]],
  2: [['lanza'], ['anillo_verde'], ['titanita'], ['fragmento'], ['ceniza'], ['musgo', 2], ['alma_p', 2]],
  3: [['katana'], ['anillo_acero'], ['titanita'], ['fragmento'], ['musgo', 3], ['resina'], ['alma_p', 3]],
  4: [['mandoble'], ['anillo_ira'], ['titanita', 2], ['fragmento'], ['ceniza'], ['hueso'], ['alma_g']],
  5: [['martillo'], ['anillo_halcon'], ['titanita', 2], ['fragmento'], ['ceniza'], ['bomba', 4], ['alma_g']],
  6: [['alba'], ['anillo_sigilo'], ['titanita', 3], ['alma_g'], ['alma_g']],
};
const RANDOM_LOOT = [['alma_p', 1, 4], ['musgo', 1, 2], ['cuchillo', 4, 2], ['bomba', 2, 1], ['hierba', 1, 1], ['hueso', 1, 1], ['titanita', 1, 0.6]];
const FIXED_CHESTS = [
  { x: 96, y: 105, c: [['cuchillo', 8], ['musgo', 1]] },
  { x: 44, y: 99, c: [['linterna']] },
];
const HINTS = [
  [100, 104, 'Pulsa ESPACIO para rodar. Al rodar eres invulnerable un instante.'],
  [103, 104, 'Descansa en la hoguera para rellenar el frasco... pero los muertos se levantan.'],
  [100, 66, 'Arqueros entre los árboles. No corras en línea recta.'],
  [53, 96, 'Demasiado oscuro... dicen que hay una linterna cerca.'],
  [146, 110, 'El agua envenena. No te quedes dentro.'],
  [103, 144, 'El hielo resbala. Rueda con cuidado.'],
  [35, 148, 'La lava quema. Busca otro camino.'],
  [100, 109, 'Cinco Grandes Almas abrirán el Sello del Eclipse, al este del bosque.'],
  [99, 32, 'Gran enemigo adelante. Prueba a rodar a través de las ondas.'],
  [40, 61, 'Algo enorme anida arriba. Mira hacia el techo.'],
];
const FLAVOR = ['Ánimo, tú puedes', 'Cuidado con la emboscada', '¿Será esto una pared ilusoria?', 'Tesoro adelante... o no', 'Prueba a atacar la pared', 'Si sobrevives, no estás solo', 'Enemigo poderoso adelante', 'Descansa, viajero', 'Rodar, rodar y rodar', 'El fuego se apaga'];

// ---------------------------------------------------------------- ruido y azar
function mulberry(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function hash2(x, y, s) {
  let h = Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function vnoise(x, y, s) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = hash2(xi, yi, s), b = hash2(xi + 1, yi, s), c = hash2(xi, yi + 1, s), d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
function fbm(x, y, s) { return vnoise(x, y, s) * 0.5 + vnoise(x * 2, y * 2, s + 7) * 0.3 + vnoise(x * 4, y * 4, s + 13) * 0.2; }

let MAP = null;   // { t, reg, corr, arena, exp, ... }
let WORLD = null; // objetos del mundo

const solidType = (t) => t === T_W || t === T_GATE || t === T_FOG || t === T_FAKE;
function tileT(tx, ty) { return (tx < 0 || ty < 0 || tx >= MW || ty >= MH) ? T_W : MAP.t[ty * MW + tx]; }
function solidTile(tx, ty) { return solidType(tileT(tx, ty)); }
function tileAtW(x, y) { return tileT(Math.floor(x / TILE), Math.floor(y / TILE)); }
function regAtW(x, y) {
  const tx = Math.floor(x / TILE), ty = Math.floor(y / TILE);
  if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) return 0;
  return MAP.reg[ty * MW + tx];
}
const tw = (t) => t * TILE + TILE / 2; // centro de baldosa → mundo

// ---------------------------------------------------------------- generación
function generateWorld() {
  const N = MW * MH;
  const t = new Uint8Array(N).fill(T_W), reg = new Uint8Array(N), corr = new Uint8Array(N);
  const arena = new Uint8Array(N), safe = new Uint8Array(N), band = new Uint8Array(N);
  const R = mulberry(20261015);
  const I = (x, y) => y * MW + x;
  const inb = (x, y) => x >= 3 && y >= 3 && x < MW - 3 && y < MH - 3;

  // 1) regiones (Voronoi deformado)
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const wx = x + (fbm(x * 0.045, y * 0.045, 11) - 0.5) * 24, wy = y + (fbm(x * 0.045, y * 0.045, 29) - 0.5) * 24;
    let best = 0, bd = 1e9;
    for (let r = 0; r < REGIONS.length; r++) {
      const g = REGIONS[r], d = Math.hypot(wx - g.cx, wy - g.cy) / g.wt;
      if (d < bd) { bd = d; best = r; }
    }
    reg[I(x, y)] = best;
  }
  // 2) terreno base
  for (let i = 0; i < N; i++) {
    const g = REGIONS[reg[i]].gen;
    t[i] = g.type === 'cave' ? (R() < g.dens ? T_W : T_F) : g.type === 'open' ? T_F : T_W;
  }
  for (let it = 0; it < 4; it++) {
    const c = t.slice();
    for (let y = 1; y < MH - 1; y++) for (let x = 1; x < MW - 1; x++) {
      const i = I(x, y); if (REGIONS[reg[i]].gen.type !== 'cave') continue;
      let n = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) n += c[I(x + dx, y + dy)] === T_W ? 1 : 0;
      t[i] = n >= 5 ? T_W : T_F;
    }
  }
  // salas (catacumbas y ciudadela)
  REGIONS.forEach((g, ri) => {
    if (g.gen.type !== 'rooms') return;
    const rooms = [];
    for (let tries = 0; tries < 900 && rooms.length < g.gen.rooms; tries++) {
      const w = 5 + Math.floor(R() * 8), h = 4 + Math.floor(R() * 7);
      const x = 4 + Math.floor(R() * (MW - w - 8)), y = 4 + Math.floor(R() * (MH - h - 8));
      if (reg[I(x, y)] !== ri || reg[I(x + w, y)] !== ri || reg[I(x, y + h)] !== ri || reg[I(x + w, y + h)] !== ri) continue;
      if (rooms.some(o => x < o.x + o.w + 2 && x + w + 2 > o.x && y < o.y + o.h + 2 && y + h + 2 > o.y)) continue;
      rooms.push({ x, y, w, h });
    }
    for (const r of rooms) for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) t[I(x, y)] = T_F;
    // pilares en salas grandes
    for (const r of rooms) if (r.w >= 9 && r.h >= 7) {
      for (const [px, py] of [[2, 2], [r.w - 3, 2], [2, r.h - 3], [r.w - 3, r.h - 3]]) t[I(r.x + px, r.y + py)] = T_W;
    }
    for (let k = 1; k < rooms.length; k++) {
      const a = rooms[k], cx = a.x + (a.w >> 1), cy = a.y + (a.h >> 1);
      let bj = 0, bd = 1e9;
      for (let j = 0; j < k; j++) { const b = rooms[j], d = Math.abs(b.x - a.x) + Math.abs(b.y - a.y); if (d < bd) { bd = d; bj = j; } }
      const b = rooms[bj], bx = b.x + (b.w >> 1), by = b.y + (b.h >> 1);
      const lx = (x0, x1, y) => { for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) for (let d = 0; d < 2; d++) if (reg[I(x, y + d)] === ri) t[I(x, y + d)] = T_F; };
      const ly = (y0, y1, x) => { for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) for (let d = 0; d < 2; d++) if (reg[I(x + d, y)] === ri) t[I(x + d, y)] = T_F; };
      if (R() < 0.5) { lx(cx, bx, cy); ly(cy, by, bx); } else { ly(cy, by, cx); lx(cx, bx, by); }
    }
  });
  // santuario: anillo de pilares
  for (let k = 0; k < 12; k++) {
    const a = k / 12 * Math.PI * 2 + 0.26;
    const px = Math.round(100 + Math.cos(a) * 9), py = Math.round(100 + Math.sin(a) * 9);
    t[I(px, py)] = T_W;
  }
  // 3) franja fronteriza entre regiones
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const r0 = reg[I(x, y)];
    let diff = false;
    for (let dy = -2; dy <= 2 && !diff; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
      if (reg[I(xx, yy)] !== r0) { diff = true; break; }
    }
    if (diff) { band[I(x, y)] = 1; t[I(x, y)] = T_W; }
    if (!inb(x, y)) t[I(x, y)] = T_W;
  }
  // utilidades de tallado
  const disc = (cx, cy, r, val, mark) => {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (!inb(x, y)) continue;
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      t[I(x, y)] = val; if (mark) corr[I(x, y)] = mark;
    }
  };
  const carveLine = (ax, ay, bx, by, rad, mark, seed) => {
    const d = Math.hypot(bx - ax, by - ay) || 1, steps = Math.ceil(d * 2);
    const nx = -(by - ay) / d, ny = (bx - ax) / d;
    for (let s = 0; s <= steps; s++) {
      const p = s / steps, dd = p * d;
      const w = (vnoise(dd * 0.12, seed, 5) - 0.5) * 2 * Math.min(1, dd / 6, (d - dd) / 6) * 4;
      disc(ax + (bx - ax) * p + nx * w, ay + (by - ay) * p + ny * w, rad, T_F, mark);
    }
  };
  // 4) arenas de jefe (círculo + anillo de muro)
  ARENAS.forEach((a, k) => {
    for (let y = a.y - a.R - 4; y <= a.y + a.R + 4; y++) for (let x = a.x - a.R - 4; x <= a.x + a.R + 4; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const d = Math.hypot(x - a.x, y - a.y);
      if (d <= a.R) { t[I(x, y)] = T_F; arena[I(x, y)] = k + 1; }
      else if (d <= a.R + 3.2) t[I(x, y)] = T_W;
    }
  });
  // salas de minijefe
  for (const m of MINIS) disc(m.x, m.y, 5.5, T_F, 0);
  // 5) pasillos
  LINKS.forEach((l, k) => {
    for (let s = 0; s < l.pts.length - 1; s++) carveLine(l.pts[s][0], l.pts[s][1], l.pts[s + 1][0], l.pts[s + 1][1], 1.6, 10 + k, k * 7 + s);
  });
  PATHS.forEach((p, k) => {
    for (let s = 0; s < p.length - 1; s++) carveLine(p[s][0], p[s][1], p[s + 1][0], p[s + 1][1], 1.7, 30 + k, 100 + k * 7 + s);
  });
  for (const b of BONFIRES) disc(b.x, b.y, 2.6, T_F, 0);
  for (const c of FIXED_CHESTS) disc(c.x, c.y, 1.6, T_F, 0);
  // 6) salas secretas con pared ilusoria (una por región)
  const secrets = [];
  for (let ri = 1; ri < REGIONS.length; ri++) {
    for (let tries = 0; tries < 400; tries++) {
      const x = 5 + Math.floor(R() * (MW - 10)), y = 5 + Math.floor(R() * (MH - 10));
      const i = I(x, y);
      if (reg[i] !== ri || corr[i] < 30 || arena[i]) continue;
      const dir = [[1, 0], [-1, 0], [0, 1], [0, -1]][Math.floor(R() * 4)];
      // buscar el borde del pasillo
      let ex = x, ey = y, k = 0;
      while (k < 4 && t[I(ex + dir[0], ey + dir[1])] === T_F) { ex += dir[0]; ey += dir[1]; k++; }
      const cx = ex + dir[0] * 4, cy = ey + dir[1] * 4;
      let ok = true;
      for (let yy = cy - 5; yy <= cy + 5 && ok; yy++) for (let xx = cx - 5; xx <= cx + 5; xx++) {
        if (!inb(xx, yy) || reg[I(xx, yy)] !== ri || band[I(xx, yy)] || arena[I(xx, yy)]) { ok = false; break; }
        const d = Math.hypot(xx - cx, yy - cy);
        if (d < 4.2 && corr[I(xx, yy)]) { ok = false; break; }
      }
      if (!ok) continue;
      if (BONFIRES.some(b => Math.hypot(b.x - cx, b.y - cy) < 10)) continue;
      for (let yy = cy - 4; yy <= cy + 4; yy++) for (let xx = cx - 4; xx <= cx + 4; xx++) {
        const d = Math.hypot(xx - cx, yy - cy);
        if (d <= 2.3) t[I(xx, yy)] = T_F; else if (d <= 4.2 && !corr[I(xx, yy)]) t[I(xx, yy)] = T_W;
      }
      // pared ilusoria entre el pasillo y la sala
      for (let s = 1; s <= 2; s++) {
        const fx = ex + dir[0] * s, fy = ey + dir[1] * s;
        if (t[I(fx, fy)] === T_W) t[I(fx, fy)] = T_FAKE;
      }
      secrets.push({ reg: ri, x: cx, y: cy, hx: ex, hy: ey });
      break;
    }
  }
  // 7) conectividad: lo que no se alcanza desde el santuario se rellena
  const seen = new Uint8Array(N), q = [I(100, 100)]; seen[q[0]] = 1;
  while (q.length) {
    const i = q.pop(), x = i % MW, y = (i / MW) | 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= MW || yy >= MH) continue;
      const j = I(xx, yy); if (seen[j] || t[j] === T_W) continue;
      seen[j] = 1; q.push(j);
    }
  }
  for (let i = 0; i < N; i++) if (!seen[i] && t[i] !== T_W) t[i] = T_W;
  // zonas seguras alrededor de hogueras
  const markSafe = (cx, cy, r) => { for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (x >= 0 && y >= 0 && x < MW && y < MH && Math.hypot(x - cx, y - cy) <= r) safe[I(x, y)] = 1; };
  for (const b of BONFIRES) markSafe(b.x, b.y, 6);
  for (const n of NPCS) markSafe(n.x, n.y, 3);
  // 8) terreno peligroso
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y); if (t[i] !== T_F || corr[i] || safe[i] || arena[i]) continue;
    const hz = REGIONS[reg[i]].hazard; if (!hz) continue;
    if (hz === 'water' && fbm(x * 0.08, y * 0.08, 41) > 0.6) t[i] = T_WATER;
    else if (hz === 'lava') { const n = fbm(x * 0.06, y * 0.06, 43); if (Math.abs(n - 0.5) < 0.035 || n > 0.7) t[i] = T_LAVA; }
    else if (hz === 'ice' && fbm(x * 0.09, y * 0.09, 47) > 0.58) t[i] = T_ICE;
  }
  // decorado de arenas
  {
    const h = ARENAS[2]; for (let y = h.y - 3; y <= h.y + 3; y++) for (let x = h.x - 3; x <= h.x + 3; x++) if (Math.hypot(x - h.x, y - h.y) <= 2.6) t[I(x, y)] = T_WATER;
    const b = ARENAS[4]; for (let y = b.y - b.R; y <= b.y + b.R; y++) for (let x = b.x - b.R; x <= b.x + b.R; x++) { const d = Math.hypot(x - b.x, y - b.y); if (d > b.R - 1.2 && d <= b.R && hash2(x, y, 9) < 0.6) t[I(x, y)] = T_LAVA; }
    const k = ARENAS[3]; for (let y = k.y - k.R; y <= k.y + k.R; y++) for (let x = k.x - k.R; x <= k.x + k.R; x++) if (Math.hypot(x - k.x, y - k.y) < k.R - 2 && fbm(x * 0.2, y * 0.2, 5) > 0.55) t[I(x, y)] = T_ICE;
  }
  // 9) rejas: baldosas transitables de la franja entre las dos regiones del enlace
  const gates = [];
  LINKS.forEach((l) => {
    if (!l.gate) return;
    const tiles = [];
    for (let y = 2; y < MH - 2; y++) for (let x = 2; x < MW - 2; x++) {
      const i = I(x, y); if (!band[i] || t[i] === T_W) continue;
      let hasA = false, hasB = false;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const r = reg[I(x + dx, y + dy)]; if (r === l.a) hasA = true; if (r === l.b) hasB = true; }
      if (hasA && hasB) tiles.push(i);
    }
    let sx = 0, sy = 0; for (const i of tiles) { sx += i % MW; sy += (i / MW) | 0; t[i] = T_GATE; }
    gates.push({ id: l.gate, key: l.key, n: l.n, tiles, x: tw(sx / Math.max(1, tiles.length) - 0.5), y: tw(sy / Math.max(1, tiles.length) - 0.5) });
  });
  // niebla de las arenas: baldosas libres justo fuera del círculo
  const arenas = ARENAS.map((a, k) => {
    const fog = [];
    for (let y = a.y - a.R - 4; y <= a.y + a.R + 4; y++) for (let x = a.x - a.R - 4; x <= a.x + a.R + 4; x++) {
      if (x < 0 || y < 0 || x >= MW || y >= MH) continue;
      const d = Math.hypot(x - a.x, y - a.y);
      if (d > a.R + 0.5 && d <= a.R + 3.6 && t[I(x, y)] !== T_W) fog.push(I(x, y));
    }
    return { id: a.id, k, x: tw(a.x), y: tw(a.y), R: a.R * TILE, fog, reg: reg[I(a.x, a.y)] };
  });

  MAP = { t, reg, corr, arena, safe, exp: new Uint8Array(N) };

  // 10) objetos
  const floorList = (ri, pred) => {
    const out = [];
    for (let y = 3; y < MH - 3; y++) for (let x = 3; x < MW - 3; x++) {
      const i = I(x, y); if (reg[i] !== ri || t[i] !== T_F || arena[i] || safe[i]) continue;
      if (pred && !pred(x, y, i)) continue;
      out.push(i);
    }
    return out;
  };
  const wallN = (x, y) => { let n = 0; for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if (t[I(x + dx, y + dy)] === T_W) n++; return n; };
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const nearBonfire = (x, y, d) => BONFIRES.some(b => Math.hypot(b.x - x, b.y - y) < d);

  const chests = [], items = [], msgs = [], spawns = [];
  FIXED_CHESTS.forEach((c, k) => chests.push({ id: 'cf' + k, x: tw(c.x), y: tw(c.y), c: c.c }));
  let cid = 0, iid = 0;
  for (let ri = 1; ri < REGIONS.length; ri++) {
    // cofres en recovecos
    const loot = REGION_LOOT[ri].slice();
    const extra = 3;
    const nooks = shuffle(floorList(ri, (x, y, i) => !corr[i] && wallN(x, y) >= 5 && !nearBonfire(x, y, 9)));
    const placed = [];
    const want = loot.length + extra;
    let mimicDone = ri < 2;
    for (const i of nooks) {
      if (placed.length >= want) break;
      const x = i % MW, y = (i / MW) | 0;
      if (placed.some(p => Math.hypot(p[0] - x, p[1] - y) < 12)) continue;
      placed.push([x, y]);
      let c;
      if (loot.length) c = [loot.shift()];
      else {
        const r = RANDOM_LOOT[Math.floor(R() * RANDOM_LOOT.length)];
        c = [[r[0], r[1]]];
      }
      const ch = { id: 'c' + (cid++), x: tw(x), y: tw(y), c };
      if (!mimicDone && placed.length > REGION_LOOT[ri].length) { ch.mimic = true; ch.c = [['titanita', 2], ['alma_g', 1]]; mimicDone = true; }
      chests.push(ch);
    }
    // sala secreta
    const s = secrets.find(o => o.reg === ri);
    if (s) {
      chests.push({ id: 'cs' + ri, x: tw(s.x), y: tw(s.y), c: [ri === 2 || ri === 6 ? ['alma_g', ri === 6 ? 2 : 1] : ['titanita', 2]] });
      msgs.push({ x: tw(s.hx - (s.hx - s.x) * 0.0), y: tw(s.hy), txt: 'Pared ilusoria adelante' });
    }
    // objetos en el suelo
    const fl = shuffle(floorList(ri, (x, y) => !nearBonfire(x, y, 7)));
    let ip = 0;
    for (let k = 0; k < 9 && ip < fl.length; ip++) {
      const i = fl[ip], x = i % MW, y = (i / MW) | 0;
      if (items.some(o => Math.hypot(o.x - tw(x), o.y - tw(y)) < TILE * 8)) continue;
      const r = RANDOM_LOOT[Math.floor(R() * RANDOM_LOOT.length)];
      items.push({ id: 'i' + (iid++), x: tw(x), y: tw(y), c: [[r[0], r[1]]] });
      k++;
    }
    // mensajes de ambiente
    for (let k = 0; k < 3; k++) {
      const i = fl[Math.floor(R() * fl.length)];
      if (i === undefined) break;
      msgs.push({ x: tw(i % MW), y: tw((i / MW) | 0), txt: FLAVOR[Math.floor(R() * FLAVOR.length)] });
    }
    // enemigos
    const G = REGIONS[ri];
    const tot = G.enemies.reduce((s, e) => s + e[1], 0);
    const cand = shuffle(floorList(ri, (x, y) => !nearBonfire(x, y, 10)).concat(
      G.hazard === 'water' ? [] : []));
    let made = 0;
    for (const i of cand) {
      if (made >= G.count) break;
      const x = i % MW, y = (i / MW) | 0;
      if (spawns.some(s => s.reg === ri && Math.abs(s.tx - x) < 4 && Math.abs(s.ty - y) < 4)) continue;
      if (MINIS.some(m => Math.hypot(m.x - x, m.y - y) < 9)) continue;
      let r = R() * tot, type = G.enemies[0][0];
      for (const e of G.enemies) { r -= e[1]; if (r <= 0) { type = e[0]; break; } }
      const pack = (type === 'wolf' || type === 'cavebat' || type === 'poisonslime' || type === 'magmaslime') ? 2 + Math.floor(R() * 2) : 1;
      for (let p = 0; p < pack; p++) {
        spawns.push({ type, x: tw(x) + (p ? (R() - 0.5) * 60 : 0), y: tw(y) + (p ? (R() - 0.5) * 60 : 0), tx: x, ty: y, reg: ri, tier: G.tier });
        made++;
      }
    }
  }
  for (const h of HINTS) msgs.push({ x: tw(h[0]), y: tw(h[1]), txt: h[2], hint: true });

  // luces fijas (cristales, hongos, antorchas)
  const lights = [];
  for (let y = 1; y < MH - 1; y++) for (let x = 0; x < MW; x++) {
    const i = I(x, y), ri = reg[i], tt = t[i];
    if (tt === T_LAVA && x % 3 === 0 && y % 3 === 0) lights.push({ x: tw(x), y: tw(y), r: 150, col: 'f', lava: true });
    if (tt === T_F) {
      if (ri === 2 && hash2(x, y, 77) < 0.035) lights.push({ x: tw(x), y: tw(y), r: 150, col: hash2(x, y, 78) < 0.5 ? 'c' : 'p' });
      if (ri === 3 && hash2(x, y, 91) < 0.018) lights.push({ x: tw(x), y: tw(y), r: 110, col: 'g' });
    } else if (tt === T_W && (ri === 4 || ri === 6 || ri === 0) && t[I(x, y + 1)] === T_F && hash2(x, y, 55) < (ri === 0 ? 0.0 : 0.07)) {
      lights.push({ x: tw(x), y: tw(y) + TILE * 0.3, r: 200, col: 'f', torch: true });
    }
  }
  const lb = new Array(NCX * NCY);
  for (let k = 0; k < lb.length; k++) lb[k] = [];
  for (const l of lights) lb[Math.floor(l.y / TILE / CH) * NCX + Math.floor(l.x / TILE / CH)].push(l);

  WORLD = {
    bonfires: BONFIRES.map(b => ({ id: b.id, n: b.n, x: tw(b.x), y: tw(b.y), reg: reg[I(b.x, b.y)] })),
    npcs: NPCS.map(n => ({ ...n, x: tw(n.x), y: tw(n.y) })),
    minis: MINIS.map(m => ({ ...m, x: tw(m.x), y: tw(m.y) })),
    chests, items, msgs, spawns, gates, arenas, lightBuckets: lb,
  };
  buildMapImage();
}

// ---------------------------------------------------------------- mapa (fog of war)
let mapCv = null, mapCtx = null, mapImg = null, mapDirty = false;
function mapColorOf(i) {
  const t = MAP.t[i], g = REGIONS[MAP.reg[i]].col;
  if (t === T_W || t === T_FAKE) return hexRGB(g.face);
  if (t === T_WATER) return [42, 90, 80];
  if (t === T_LAVA) return [230, 90, 20];
  if (t === T_ICE) return [170, 220, 240];
  if (t === T_GATE) return [255, 212, 59];
  const c = hexRGB(g.floor[0]);
  return [Math.min(255, c[0] * 1.9 + 20), Math.min(255, c[1] * 1.9 + 20), Math.min(255, c[2] * 1.9 + 20)];
}
function buildMapImage() {
  mapCv = document.createElement('canvas'); mapCv.width = MW; mapCv.height = MH;
  mapCtx = mapCv.getContext('2d');
  mapImg = mapCtx.createImageData(MW, MH);
  for (let i = 0; i < MW * MH; i++) if (MAP.exp[i]) paintMapTile(i);
  mapCtx.putImageData(mapImg, 0, 0);
}
function paintMapTile(i) {
  const c = mapColorOf(i), o = i * 4;
  mapImg.data[o] = c[0]; mapImg.data[o + 1] = c[1]; mapImg.data[o + 2] = c[2]; mapImg.data[o + 3] = 255;
}
function revealAround(x, y, rad) {
  const cx = Math.floor(x / TILE), cy = Math.floor(y / TILE);
  for (let ty = cy - rad; ty <= cy + rad; ty++) for (let tx = cx - rad; tx <= cx + rad; tx++) {
    if (tx < 0 || ty < 0 || tx >= MW || ty >= MH) continue;
    if ((tx - cx) ** 2 + (ty - cy) ** 2 > rad * rad) continue;
    const i = ty * MW + tx; if (MAP.exp[i]) continue;
    MAP.exp[i] = 1; paintMapTile(i); mapDirty = true;
  }
}
function flushMap() { if (mapDirty) { mapCtx.putImageData(mapImg, 0, 0); mapDirty = false; } }
function setTile(i, v) {
  MAP.t[i] = v;
  if (MAP.exp[i]) { paintMapTile(i); mapDirty = true; }
  const tx = i % MW, ty = (i / MW) | 0;
  invalidateChunk(tx, ty); invalidateChunk(tx, ty - 1);
}
function encodeExp() {
  const b = new Uint8Array(Math.ceil(MW * MH / 8));
  for (let i = 0; i < MW * MH; i++) if (MAP.exp[i]) b[i >> 3] |= 1 << (i & 7);
  let s = ''; for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
}
function decodeExp(str) {
  try {
    const s = atob(str);
    for (let i = 0; i < MW * MH; i++) MAP.exp[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
  } catch (e) { /* guardado viejo */ }
}

// ---------------------------------------------------------------- colisiones
function collideCircle(e, r) {
  const x0 = Math.floor((e.x - r) / TILE), x1 = Math.floor((e.x + r) / TILE);
  const y0 = Math.floor((e.y - r) / TILE), y1 = Math.floor((e.y + r) / TILE);
  let hit = false;
  for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) {
    if (!solidTile(tx, ty)) continue;
    const rx = tx * TILE, ry = ty * TILE;
    const cx = e.x < rx ? rx : e.x > rx + TILE ? rx + TILE : e.x;
    const cy = e.y < ry ? ry : e.y > ry + TILE ? ry + TILE : e.y;
    let dx = e.x - cx, dy = e.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= r * r) continue;
    hit = true;
    if (d2 > 0.0001) { const d = Math.sqrt(d2), p = r - d; e.x += dx / d * p; e.y += dy / d * p; }
    else {
      const l = e.x - rx, rr = rx + TILE - e.x, u = e.y - ry, dd = ry + TILE - e.y, m = Math.min(l, rr, u, dd);
      if (m === l) e.x = rx - r; else if (m === rr) e.x = rx + TILE + r; else if (m === u) e.y = ry - r; else e.y = ry + TILE + r;
    }
  }
  return hit;
}
function moveEnt(e, dx, dy, r) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / (r * 0.6)));
  let hit = false;
  for (let s = 0; s < steps; s++) { e.x += dx / steps; e.y += dy / steps; if (collideCircle(e, r)) hit = true; }
  return hit;
}
function los(x0, y0, x1, y1) {
  const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 20);
  for (let i = 1; i < n; i++) {
    const x = x0 + (x1 - x0) * i / n, y = y0 + (y1 - y0) * i / n;
    if (solidTile(Math.floor(x / TILE), Math.floor(y / TILE))) return false;
  }
  return true;
}
function rayLen(x, y, a, max) {
  const c = Math.cos(a), s = Math.sin(a);
  for (let d = 0; d < max; d += 12) if (solidTile(Math.floor((x + c * d) / TILE), Math.floor((y + s * d) / TILE))) return d;
  return max;
}
function freeSpot(x, y, r) {
  return !solidTile(Math.floor((x - r) / TILE), Math.floor(y / TILE)) && !solidTile(Math.floor((x + r) / TILE), Math.floor(y / TILE)) &&
    !solidTile(Math.floor(x / TILE), Math.floor((y - r) / TILE)) && !solidTile(Math.floor(x / TILE), Math.floor((y + r) / TILE));
}

// ---------------------------------------------------------------- trozos pre-dibujados
const chunkCache = new Map();
let chunkFrame = 0;
function invalidateChunk(tx, ty) {
  if (tx < 0 || ty < 0) return;
  chunkCache.delete(Math.floor(ty / CH) * NCX + Math.floor(tx / CH));
}
function getChunk(cx, cy) {
  const key = cy * NCX + cx;
  let e = chunkCache.get(key);
  if (!e) {
    e = { c: bakeChunk(cx, cy), used: 0 };
    chunkCache.set(key, e);
    if (chunkCache.size > 90) {
      let oldK = -1, oldU = Infinity;
      for (const [k, v] of chunkCache) if (v.used < oldU) { oldU = v.used; oldK = k; }
      chunkCache.delete(oldK);
    }
  }
  e.used = chunkFrame;
  return e.c;
}
function bakeChunk(cx, cy) {
  const c = document.createElement('canvas'); c.width = c.height = CH * TPX;
  const g = c.getContext('2d');
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const tx = cx * CH + x, ty = cy * CH + y;
    if (tx >= MW || ty >= MH) continue;
    drawTileTex(g, tx, ty, x * TPX, y * TPX);
  }
  // capa animada (lava y agua): una sola imagen por trozo que se dibuja con alfa variable
  let haz = null;
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const tx = cx * CH + x, ty = cy * CH + y;
    if (tx >= MW || ty >= MH) continue;
    const t = MAP.t[ty * MW + tx];
    if (t !== T_LAVA && t !== T_WATER) continue;
    if (!haz) { haz = document.createElement('canvas'); haz.width = haz.height = CH * TPX; }
    const hg = haz.getContext('2d'), X = x * TPX, Y = y * TPX;
    if (t === T_LAVA) {
      hg.fillStyle = '#ffb030'; hg.fillRect(X, Y, TPX, TPX);
      hg.fillStyle = '#fff3b0'; hg.fillRect(X + (hash2(tx, ty, 61) * 12 | 0), Y + (hash2(tx, ty, 62) * 12 | 0), 3, 2);
    } else {
      hg.fillStyle = '#9ad8c0';
      hg.fillRect(X + (hash2(tx, ty, 63) * 10 | 0), Y + 4, 5, 1); hg.fillRect(X + (hash2(tx, ty, 64) * 10 | 0), Y + 11, 4, 1);
    }
  }
  c.haz = haz;
  // copas de árbol que sobresalen (segunda pasada para que tapen el suelo)
  for (let y = 0; y < CH; y++) for (let x = 0; x < CH; x++) {
    const tx = cx * CH + x, ty = cy * CH + y;
    if (tx >= MW || ty >= MH) continue;
    const i = ty * MW + tx, st = REGIONS[MAP.reg[i]].col.style;
    if ((MAP.t[i] === T_W || MAP.t[i] === T_FAKE) && (st === 'tree' || st === 'deadtree')) drawCanopy(g, tx, ty, x * TPX, y * TPX, st);
  }
  return c;
}
function px(g, col, x, y, w, h) { g.fillStyle = col; g.fillRect(x, y, w || 1, h || 1); }
function drawTileTex(g, tx, ty, X, Y) {
  const i = ty * MW + tx, t = MAP.t[i], G = REGIONS[MAP.reg[i]], C = G.col;
  const h = hash2(tx, ty, 3), h2 = hash2(tx, ty, 4);
  const solid = t === T_W || t === T_FAKE;
  if (solid) {
    const below = solidType(tileT(tx, ty + 1)) && tileT(tx, ty + 1) !== T_GATE;
    const inner = below && solidType(tileT(tx, ty - 1)) && solidType(tileT(tx - 1, ty)) && solidType(tileT(tx + 1, ty));
    if (C.style === 'tree' || C.style === 'deadtree') {
      px(g, C.wall, X, Y, TPX, TPX);
      if (!below) { px(g, C.floor[0], X, Y + 10, TPX, 6); px(g, 'rgba(0,0,0,0.35)', X, Y + 10, TPX, 6); }
      return;
    }
    if (inner) { px(g, C.wall, X, Y, TPX, TPX); if (h < 0.3) px(g, C.face, X + (h2 * 12 | 0), Y + (h * 40 | 0) % 14, 2, 2); return; }
    px(g, C.top, X, Y, TPX, TPX);
    for (let k = 0; k < 6; k++) { const a = hash2(tx * 7 + k, ty, 5); px(g, k & 1 ? C.wall : C.speck, X + (a * 16 | 0), Y + (hash2(tx, ty * 5 + k, 6) * 10 | 0), 2, 1); }
    if (C.style === 'brick' || C.style === 'stone') {
      px(g, 'rgba(255,255,255,0.12)', X, Y, TPX, 1);
    }
    if (!below) {
      const fh = 7;
      px(g, C.face, X, Y + TPX - fh, TPX, fh);
      px(g, 'rgba(255,255,255,0.10)', X, Y + TPX - fh, TPX, 1);
      if (C.style === 'brick' || C.style === 'stone') {
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.fillRect(X, Y + TPX - fh + 3, TPX, 1);
        const off = (ty & 1) ? 4 : 0;
        g.fillRect(X + ((off + 0) % 16), Y + TPX - fh + 1, 1, 2); g.fillRect(X + ((off + 8) % 16), Y + TPX - fh + 1, 1, 2);
        g.fillRect(X + ((off + 4) % 16), Y + TPX - fh + 4, 1, 3); g.fillRect(X + ((off + 12) % 16), Y + TPX - fh + 4, 1, 3);
      } else {
        for (let k = 0; k < 3; k++) px(g, 'rgba(0,0,0,0.3)', X + (hash2(tx, ty, 20 + k) * 14 | 0), Y + TPX - fh + 1 + k * 2, 3, 1);
      }
    }
    return;
  }
  // ---- suelo
  if (t === T_WATER) {
    px(g, '#1e3a34', X, Y, TPX, TPX);
    for (let k = 0; k < 3; k++) px(g, '#2c5a4c', X + (hash2(tx, ty, 30 + k) * 12 | 0), Y + (hash2(tx, ty, 40 + k) * 15 | 0), 4, 1);
    if (h < 0.08) { px(g, '#3a7a3a', X + 5, Y + 6, 5, 3); px(g, '#4a9a4a', X + 6, Y + 6, 2, 1); }
  } else if (t === T_LAVA) {
    px(g, '#a8320c', X, Y, TPX, TPX);
    for (let k = 0; k < 4; k++) px(g, '#f07a14', X + (hash2(tx, ty, 30 + k) * 13 | 0), Y + (hash2(tx, ty, 40 + k) * 13 | 0), 3, 2);
    px(g, '#ffd43b', X + (h * 14 | 0), Y + (h2 * 14 | 0), 1, 1);
  } else if (t === T_ICE) {
    px(g, '#8ec8e0', X, Y, TPX, TPX);
    for (let k = 0; k < 5; k++) px(g, '#d6f4ff', X + ((h * 10 + k * 3) % 16 | 0), Y + 12 - k * 2, 2, 1);
    if (h2 < 0.4) px(g, '#6aa8c8', X + (h2 * 30 | 0), Y + 3, 1, 6);
  } else {
    px(g, C.floor[(h * 3) | 0], X, Y, TPX, TPX);
    for (let k = 0; k < 5; k++) px(g, k & 1 ? C.speck : 'rgba(0,0,0,0.18)', X + (hash2(tx, ty, 10 + k) * 15 | 0), Y + (hash2(tx, ty, 20 + k) * 15 | 0), 1 + (k === 0 ? 1 : 0), 1);
    const deco = C.deco;
    if (deco === 'slab' || deco === 'bone' || deco === 'gold') {
      px(g, 'rgba(0,0,0,0.22)', X, Y + TPX - 1, TPX, 1); px(g, 'rgba(0,0,0,0.22)', X + TPX - 1, Y, 1, TPX);
      px(g, 'rgba(255,255,255,0.05)', X, Y, TPX, 1);
    }
    if (deco === 'grass') {
      if (h2 < 0.3) for (let k = 0; k < 3; k++) { const gx = X + (hash2(tx, ty, 50 + k) * 13 | 0), gy = Y + (hash2(tx, ty, 60 + k) * 12 | 0) + 2; px(g, '#4a7a3a', gx, gy, 1, 3); px(g, '#5a8a44', gx + 1, gy + 1, 1, 2); }
      if (h2 > 0.965) { px(g, h > 0.5 ? '#e05a5a' : '#ffd43b', X + 7, Y + 7, 2, 2); px(g, '#4a7a3a', X + 7, Y + 9, 1, 2); }
      if (h2 > 0.93 && h2 <= 0.965) { px(g, '#6a5a4a', X + 4, Y + 9, 4, 3); px(g, '#8a7a6a', X + 5, Y + 9, 2, 1); }
    } else if (deco === 'crystal') {
      if (hash2(tx, ty, 77) < 0.035) {
        const cc = hash2(tx, ty, 78) < 0.5 ? ['#8ff3ff', '#2f8f9a'] : ['#d8a8ff', '#6a2fb3'];
        px(g, cc[1], X + 6, Y + 4, 4, 9); px(g, cc[0], X + 7, Y + 2, 2, 9); px(g, cc[1], X + 3, Y + 8, 3, 5); px(g, cc[0], X + 4, Y + 7, 1, 5);
        px(g, '#ffffff', X + 7, Y + 3, 1, 2);
      } else if (h2 < 0.15) px(g, '#4a4560', X + (h * 12 | 0), Y + 8, 3, 2);
    } else if (deco === 'reed') {
      if (h2 < 0.18) for (let k = 0; k < 3; k++) px(g, '#5a6a2a', X + 3 + k * 4, Y + 4 + (k & 1) * 2, 1, 8);
      if (hash2(tx, ty, 91) < 0.018) { px(g, '#7ee36b', X + 5, Y + 7, 6, 3); px(g, '#c8ffb0', X + 6, Y + 7, 2, 1); px(g, '#e8e0c8', X + 7, Y + 10, 2, 3); }
    } else if (deco === 'bone') {
      if (h2 < 0.05) { px(g, '#d8d4c8', X + 3, Y + 8, 9, 2); px(g, '#d8d4c8', X + 2, Y + 7, 2, 4); px(g, '#d8d4c8', X + 11, Y + 7, 2, 4); }
      else if (h2 < 0.07) { px(g, '#d8d4c8', X + 5, Y + 5, 6, 5); px(g, '#14101c', X + 6, Y + 7, 1, 1); px(g, '#14101c', X + 9, Y + 7, 1, 1); }
    } else if (deco === 'ash') {
      if (h2 < 0.12) { px(g, '#ff5a1a', X + (h * 8 | 0), Y + 7, 6, 1); px(g, '#ff5a1a', X + (h * 8 | 0) + 5, Y + 8, 3, 1); }
      else if (h2 < 0.2) px(g, '#5a4a44', X + 4, Y + 4, 3, 2);
    } else if (deco === 'gold') {
      if ((tx + ty) % 6 === 0) px(g, 'rgba(255,212,59,0.25)', X + 7, Y, 2, TPX);
      if (h2 < 0.035) { px(g, 'rgba(176,102,255,0.35)', X + 4, Y + 7, 8, 2); px(g, 'rgba(176,102,255,0.35)', X + 7, Y + 4, 2, 8); }
    } else if (deco === 'slab') {
      if (h2 < 0.12) px(g, 'rgba(0,0,0,0.3)', X + 3, Y + (h * 12 | 0), 8, 1);
    }
  }
  // sombras de muros vecinos
  if (solidType(tileT(tx, ty - 1)) && tileT(tx, ty - 1) !== T_GATE) px(g, 'rgba(0,0,0,0.38)', X, Y, TPX, 4);
  if (solidType(tileT(tx - 1, ty)) && tileT(tx - 1, ty) !== T_GATE) px(g, 'rgba(0,0,0,0.22)', X, Y, 2, TPX);
  if (solidType(tileT(tx + 1, ty)) && tileT(tx + 1, ty) !== T_GATE) px(g, 'rgba(0,0,0,0.22)', X + TPX - 2, Y, 2, TPX);
}
function drawCanopy(g, tx, ty, X, Y, st) {
  const C = REGIONS[MAP.reg[ty * MW + tx]].col;
  const h = hash2(tx, ty, 8), below = solidType(tileT(tx, ty + 1));
  const ox = X + 8 + (h - 0.5) * 6, oy = Y + (below ? 8 : 4) + (hash2(tx, ty, 9) - 0.5) * 4;
  if (!below) { px(g, st === 'tree' ? '#4a3020' : '#3a3428', X + 6, Y + 9, 4, 7); px(g, 'rgba(0,0,0,0.3)', X + 9, Y + 9, 1, 7); }
  if (st === 'tree') {
    g.fillStyle = C.face; g.beginPath(); g.arc(ox, oy + 1, 10, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.top; g.beginPath(); g.arc(ox, oy, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#3a6634'; g.beginPath(); g.arc(ox - 3, oy - 3, 4, 0, Math.PI * 2); g.fill();
    px(g, '#4a7a3a', ox - 4 | 0, oy - 5 | 0, 2, 1);
    if (h < 0.15) { px(g, '#8a3a3a', ox + 2 | 0, oy + 1 | 0, 2, 2); }
  } else {
    g.fillStyle = C.face; g.beginPath(); g.arc(ox, oy + 1, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.top; g.beginPath(); g.arc(ox, oy, 8, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#4a4a34';
    for (let k = 0; k < 3; k++) { const a = hash2(tx, ty, 70 + k) * 6.28; g.fillRect(ox + Math.cos(a) * 5 | 0, oy + Math.sin(a) * 5 | 0, 2, 2); }
    if (h < 0.3) px(g, '#5a6a3a', ox - 2 | 0, oy - 4 | 0, 4, 1);
  }
}
