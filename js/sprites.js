'use strict';
// =====================================================================
//  SPRITES — pixel art definido como texto. Cada letra = un color.
//  Se rasteriza una sola vez a canvas con contorno automático y se
//  cachean versiones espejo y destello blanco. Las variantes de
//  enemigos se crean cambiando la paleta (sin dibujar nada nuevo).
// =====================================================================

const PAL = {
  k: '#14101c', e: '#000000', w: '#f4f4f4',
  g: '#a9b3bd', G: '#5d6670', h: '#3a4048',
  s: '#e0b48a', S: '#a87a58',
  r: '#d63c3c', R: '#8e1f2a', x: '#ff3b2f',
  o: '#ff8a2a', y: '#ffd43b', Y: '#b8860b', i: '#fff3b0',
  l: '#7ee36b', L: '#3a9a3f', D: '#215e2b',
  b: '#4aa3ff', B: '#2b5fb3', n: '#1d2f6b',
  p: '#b066ff', P: '#6a2fb3', u: '#4a3266', v: '#221a2e',
  c: '#8ff3ff', C: '#2f8f9a', z: '#d6f4ff',
  t: '#8a5a3b', T: '#5a3825', q: '#3d3024',
  m: '#e8e0c8', M: '#b5ab8f', a: '#8c8070', f: '#e070b0',
};

const SPRDEF = {
  // ---------------- héroe ----------------
  player: [
    '.....gggg.......',
    '....gwgggg......',
    '...gggggggG.....',
    '...gGkkkkGG.....',
    '...gGkckckG.....',
    '....GgggggG.....',
    '..CCgGgggGgCC...',
    '.CCCgggrggggCC..',
    '.CC.ggrrrgg.CC..',
    '.C..sgggggs..C..',
    '....tYYYYYt.....',
    '....GgG.GgG.....',
    '....Gg...gG.....',
    '...hhh...hhh....',
  ],
  // ---------------- enemigos normales ----------------
  hollow: [
    '.....MMMM......',
    '....MMMMMM.....',
    '....MkMMkM.....',
    '....MMMMMM.....',
    '.....MkkM......',
    '...TTTTTTTT....',
    '..MTtTTTTtTM...',
    '..M.TTTTTT.M...',
    '..M.TTttTT.M...',
    '....qqqqqq.....',
    '....qq..qq.....',
    '....TT..TT.....',
    '...TTT..TTT....',
  ],
  wolf: [
    '.............G..',
    '...G........GG..',
    '...GG......GGG..',
    '..GGGGGG...GGgGG',
    '.GGGGGGGGGGGxGGG',
    'GGGGGgggggGGGGGw',
    'G.GGGgggggGGGk..',
    '..GGGGGGGGGGG...',
    '..GG.GG.GG.GG...',
    '..kk.kk.kk.kk...',
  ],
  shroom: [
    '....rrrrrrr.....',
    '..rrwrrrrrwrr...',
    '.rrrrrrwrrrrrr..',
    '.rrwrrrrrrrwrr..',
    '..RRRRRRRRRRR...',
    '.....mmmmm......',
    '.....mkmkm......',
    '.....mmmmm......',
    '....mmmmmmm.....',
    '...m.mmmmm.m....',
    '.....mmmmm......',
    '.....m...m......',
    '....mm...mm.....',
  ],
  archer: [
    '.....DDDD.....',
    '....DDDDDD..t.',
    '....DkssDD...t',
    '....DssssD...t',
    '.....DDDD....t',
    '...LLLLLLL...t',
    '..sLLLLLLLsssY',
    '....LLLLLL...t',
    '....TYYYYT...t',
    '....qq..qq...t',
    '....qq..qq..t.',
    '...TTT..TTT...',
  ],
  bat: [
    'P..............P',
    'PP....P..P....PP',
    'PPP...PPPP...PPP',
    'PPPP.PPPPPP.PPPP',
    'PPPPPPxPPxPPPPPP',
    '.PPPPPPPPPPPPPP.',
    '..PPP.PwwP.PPP..',
    '...P...PP...P...',
  ],
  spider: [
    '..k..........k..',
    '...k...uu...k...',
    '.k..k.uuuu.k..k.',
    '..k.kuuuuuuk.k..',
    '...kkuxuuxukk...',
    '.kkkuuuuuuuukkk.',
    'k...kuuPPuuk...k',
    '...k.kuuuuk.k...',
    '..k..k.uu.k..k..',
    '.k...k....k...k.',
  ],
  cgolem: [
    '.....c..c......',
    '....ccGGcc.....',
    '...GGGGGGGG....',
    '...GgcGGcgG....',
    '...GGGGGGGG....',
    '.GGGGGGGGGGGG..',
    'GGgGGGccGGGgGG.',
    'GGgGGcccGGGgGG.',
    'GG.GGGccGGG.GG.',
    'cc.GGGGGGGG.cc.',
    '...GGG..GGG....',
    '...GGG..GGG....',
    '..hhhh..hhhh...',
  ],
  slime: [
    '......llll......',
    '....llllwlll....',
    '...lllllwwlll...',
    '..lllllllllll...',
    '..llkkllkklllL..',
    '..llkkllkkllLL..',
    '..lllllllllLLL..',
    '..LllkkkklLLLL..',
    '...LLLLLLLLLL...',
    '....LLLLLLLL....',
  ],
  bogman: [
    '.....DDDD......',
    '....DLLLLD.....',
    '....LxLLxL.....',
    '....LLLLLL.....',
    '.....LkkL......',
    '...qqqqqqqq....',
    '..LqDqqqqDqL...',
    '..L.qqqqqq.L...',
    '..L.qDqqDq.L...',
    '.....DDDD......',
    '.....D..D......',
    '....DD..DD.....',
  ],
  witch: [
    '.......P.......',
    '......PPP......',
    '.....PPPPP.....',
    '...PPPPPPPPP...',
    '.....lxllxl....',
    '.....llllll....',
    '....uuluuluu..y',
    '...uuuuuuuuu.yy',
    '...luuuuuuuul.t',
    '....uuuuuuuu..t',
    '...uuuuuuuuuu.t',
    '...uuuu..uuuu.t',
  ],
  skel: [
    '.....mmmmm.....',
    '....mmmmmmm....',
    '....mkkmkkm....',
    '....mkkmkkm....',
    '.....mmmmm.....',
    '......mkm......',
    '....mmmmmmm....',
    '...m.mkmkm.m...',
    '...m.mmmmm.m...',
    '...M..mkm..M...',
    '......mmm......',
    '.....m...m.....',
    '.....m...m.....',
    '....mm...mm....',
  ],
  skelarcher: [
    '.....mmmmm...t.',
    '....mmmmmmm...t',
    '....mkkmkkm...t',
    '....mkkmkkm...t',
    '.....mmmmm....t',
    '......mkm.....t',
    '....mmmmmmmmmmY',
    '...m.mkmkm....t',
    '...m.mmmmm....t',
    '...M..mkm.....t',
    '......mmm....t.',
    '.....m...m.....',
    '.....m...m.....',
    '....mm...mm....',
  ],
  wraith: [
    '.....ccccc.....',
    '....czzzzzc....',
    '...czzzzzzzc...',
    '...zzbzzzbzz...',
    '...zzbzzzbzz...',
    '...zzzzzzzzz...',
    '..czzzzbzzzzc..',
    '.cczzzzzzzzzcc.',
    '...czzzzzzzc...',
    '...czczzczzc...',
    '...c.c.cc.c....',
  ],
  knight: [
    '.....hhhh......',
    '....hgggghh....',
    '....hgkkkgh....',
    '....hgxkxgh....',
    '....hhggghh....',
    '..BBhgggggh....',
    '.BbbBgggggggg..',
    '.BbyBgrgggggg..',
    '.BbbBgrrrg..g..',
    '..BBhgggggh....',
    '....tYYYYt.....',
    '....hgh.hgh....',
    '....hg...gh....',
    '...hhh...hhh...',
  ],
  imp: [
    '..R.........R..',
    '..RR.......RR..',
    '...RrrrrrrrR...',
    '...rrrrrrrrr...',
    '...ryyrrryyr...',
    '...rrrrrrrrr...',
    '....rrkkkrr....',
    '.o.rrrrrrrrr.o.',
    '.oorrrrrrrrroo.',
    '..rr.rrrrr.rr..',
    '.....rr.rr.....',
    '....RR...RR....',
  ],
  toad: [
    '...LL.....LL...',
    '..LyyL...LyyL..',
    '..LykL...LykL..',
    '.LLLLLLLLLLLLL.',
    'LLlLLLLLLLLLlLL',
    'LLLLLLLLLLLLLLL',
    'LrrrrrrrrrrrrrL',
    '.LmmmmmmmmmmmL.',
    '.LLmmmmmmmmmLL.',
    'LL.LLLLLLLLL.LL',
    'L...LL...LL...L',
  ],
  gargoyle: [
    '.G...........G.',
    '.GG..hhhhh..GG.',
    '.GGG.hGGGh.GGG.',
    '.GGGGhxGxhGGGG.',
    '..GGGhGGGhGGG..',
    '...GGGGGGGGG...',
    '....GgGGGgG....',
    '....GGGGGGG....',
    '....GG...GG....',
    '...hhh...hhh...',
  ],
  troll: [
    '......TTTT.......',
    '.....TttttT......',
    '.....txttxt......',
    '.....tttttt......',
    '......tkkt.......',
    '...qqqqqqqqqq....',
    '..tqqqqqqqqqqt...',
    '.ttqqqTqqTqqqtt..',
    '.tt.qqqqqqqq.tt..',
    '.tt.qqqqqqqq.tt..',
    '.ss..TTTTTT..ss..',
    '.....qq..qq......',
    '.....qq..qq......',
    '....TTT..TTT.....',
  ],
  // ---------------- jefes ----------------
  gorvak: { left: true, rows: [
    '......LL..........LL....',
    '.....LLLL........LLLL...',
    '....LLtTTTTTTTTTTTtLL...',
    '...LLTTTTTTTTTTTTTTTLL..',
    '..LLTTtTTTLLLLTTTTtTTL..',
    '..LTTTTTTLLlLLLTTTTTTTL.',
    '.LTTTTTTLLLLLLLLTTTTTTT.',
    '.TTTxTTTTLLLLLLTTTTTTTT.',
    'TTTTTTTTTTLLLLTTTTTTTTTT',
    'TwTwTTTTTTTTTTTTTTTTTTTT',
    '.TTTTTTTTTTTTTTTTTTTTTT.',
    '..TTTT..TTTT..TTTT.TTT..',
    '..TTT...TTT...TTT..TTT..',
    '..kkk...kkk...kkk..kkk..',
  ] },
  sythra: [
    '..........pp..........',
    '.........pPPp.........',
    '........pmmmmp........',
    '........mxmxmm........',
    '.........mmmm.........',
    '....k....uuuu....k....',
    '...k.k..uuuuuu..k.k...',
    '..k...kuuPPPPuuk...k..',
    '.k...kuuPuuuuPuuk...k.',
    'k...kuuuuuxxuuuuuk...k',
    '...kuuuuuuuuuuuuuuk...',
    '..k.kuuuuPPPPuuuuk.k..',
    '.k..k.kuuuuuuuuk.k..k.',
    'k...k..kkuuuukk..k...k',
    '...k..k...kk...k..k...',
    '..k..k..........k..k..',
  ],
  hydra: [
    '..LL.......LL.......LL..',
    '.LxLL.....LxLL.....LxLL.',
    '.LLLLy....LLLLy....LLLLy',
    '..LLL......LLL......LLL.',
    '...LL.......LL.....LL...',
    '...LLL......LL....LLL...',
    '....LLL.....LL...LLL....',
    '.....LLL...LLLL.LLL.....',
    '......LLLLLLLLLLLLL.....',
    '....DLLLLlLLLLLlLLLLD...',
    '...DDLLLLLLLLLLLLLLLDD..',
    '..bbDDDDDDDDDDDDDDDDDbb.',
    '.bBbbbBbbbbBbbbbBbbbbBb.',
    'bbbBbbbbBbbbbBbbbbBbbbbb',
  ],
  halvard: [
    '.......y.y.y.......',
    '.......yyyyy.......',
    '......zzzzzzz......',
    '......zbkkkbz......',
    '......zkcckcz......',
    '......zzzzzzz......',
    '....nnzzzzzzznn....',
    '...nnzzzbzbzzznn...',
    '..nnnzzbbbbbzzznn..',
    '..nn.zzzbbbzzz.nn..',
    '..nn.czzzzzzzc.nn..',
    '..nn..zzyyyzz..nn..',
    '.nnn..zzzzzzz..nnn.',
    '.nn...zzz.zzz...nn.',
    '.n....zzz.zzz....n.',
    '......bbb.bbb......',
  ],
  brasamor: [
    '.......RRRRRRRR.......',
    '......RhhhhhhhhR......',
    '.....RhhohhhhohhR.....',
    '.....hhhyyhhyyhhh.....',
    '.....hhhhhoohhhhh.....',
    '...hhhhhhhhhhhhhhhh...',
    '..hhohhhhhoohhhhhohh..',
    '.hhhhhhhhooyoohhhhhhh.',
    '.hhohh.hhhooohhh.hhohh',
    '.hhhh..hhhhohhhh..hhhh',
    '.ooo...hhhhhhhhh...ooo',
    '.oyo...hhhhhhhhh...oyo',
    '.......hhhh.hhhh......',
    '......Rhhhh.hhhhR.....',
    '.....RRRRR...RRRRR....',
  ],
  eclipse: [
    '........y...y........',
    '........yyyyy........',
    '.......vvvvvvv.......',
    '.......vpkkkpv.......',
    '.......vkxkxkv.......',
    '.......vvvvvvv.......',
    '.....PPvvvvvvvPP.....',
    '....PPvvvpvpvvvPP....',
    '...PPPvvpppppvvPPP...',
    '...PP.vvvpppvvv.PP...',
    '...PP.vvvvvvvvv.PP...',
    '..PPP..vvyyyvv..PPP..',
    '..PP...vvvvvvv...PP..',
    '.PP....vvv.vvv....PP.',
    '.P.....vvv.vvv.....P.',
    '.......hhh.hhh.......',
  ],
  // ---------------- PNJ ----------------
  smith: [
    '.....tttt......',
    '....tssssT.....',
    '....sksksT.....',
    '....ssssss.....',
    '....TTTTTT.....',
    '..ssqqqqqqss...',
    '..ssqqqqqqss.G.',
    '..s.qqqqqq.sGGG',
    '....qqqqqq..t..',
    '....tYYYYt..t..',
    '....qq..qq.....',
    '...TTT..TTT....',
  ],
  merchant: [
    '.....uuuu......',
    '....uuuuuu.....',
    '...uukyykuu....',
    '...uussssuu....',
    '....uusssu.....',
    '..uuuuuuuuuu...',
    '.uuuuuyyuuuuu..',
    '.uu.uuuuuuu.uu.',
    '.ss.uuuuuuu.ss.',
    '....tttttttt...',
    '...tTyTtTyTt...',
    '...tttttttttt..',
  ],
  chest: [
    '..TTTTTTTTTT..',
    '.TttttttttttT.',
    'TtttttttttttT.',
    'TYYYYYYYYYYYYT',
    'TttttYyYtttttT',
    'TttttYYYtttttT',
    'TttttttttttttT',
    'TTTTTTTTTTTTTT',
  ],
  chestOpen: [
    '.TTTTTTTTTTTT.',
    'TkkkkkkkkkkkkT',
    'TkkkyykkkkkkkT',
    'TYYYYYYYYYYYYT',
    'TttttttttttttT',
    'TttttttttttttT',
    'TttttttttttttT',
    'TTTTTTTTTTTTTT',
  ],
  // ---------------- iconos de objetos ----------------
  i_frasco: ['...mm...', '...kk...', '..oyyo..', '.oyiyyo.', '.oyyyyo.', '.oyyyyo.', '..oooo..'],
  i_frascoV: ['...mm...', '...kk...', '..GGGG..', '.G....G.', '.G....G.', '.G....G.', '..GGGG..'],
  i_bomba: ['.....y.', '....t..', '..hhh..', '.hGhhh.', '.hhhhh.', '.hhhhh.', '..hhh..'],
  i_cuchillo: ['......g', '.....gw', '....gw.', '...gw..', '..Tg...', '.TT....', 'T......'],
  i_musgo: ['..pp...', '.ppPp..', 'pPpppP.', 'pppPpp.', '.pPppp.', '..ppp..'],
  i_hierba: ['...l...', '..lLl..', '.lLlLl.', '..lLl..', '...L...', '...L...'],
  i_resina: ['..mm..', '..kk..', '.rrrr.', 'rrxrrr', 'rrrrrr', '.rrrr.'],
  i_hueso: ['mm...mm', 'mmmmmmm', '.mmmmm.', 'mmmmmmm', 'mm...mm'],
  i_alma: ['...c...', '..ccc..', '.cwwwc.', '.cwwwc.', '..ccc..', '...c...'],
  i_almaG: ['...y...', '..yyy..', '.yiiiy.', 'yiwwwiy', '.yiiiy.', '..yyy..', '...y...'],
  i_llave: ['.yyy....', 'y...y...', 'y...yyyy', '.yyy..yy', '.......y'],
  i_titanita: ['..z..', '.zcz.', 'zcczz', '.zcz.', '..z..'],
  i_fragmento: ['..o..', '.oyo.', 'oyiyo', '.oyo.', '..o..'],
  i_ceniza: ['..G..', '.GaG.', 'GaaaG', 'aaaaa', '.aaa.'],
  i_anillo: ['.yyy.', 'y...y', 'y...y', 'y...y', '.yyy.'],
  i_linterna: ['..h..', '.hhh.', '.ccc.', '.czc.', '.ccc.', '.hhh.'],
};

// Variantes por cambio de paleta: { base, pal }
const SPRVAR = {
  skelice: { base: 'skel', pal: { m: '#c9e8f5', M: '#7fb0c8', k: '#1d2f6b' } },
  magmaslime: { base: 'slime', pal: { l: '#ff8a2a', L: '#b33a14', w: '#ffd43b', k: '#3a0a05' } },
  poisonslime: { base: 'slime', pal: { l: '#b066ff', L: '#6a2fb3', w: '#e8c8ff' } },
  ashknight: { base: 'knight', pal: { g: '#5a4a44', h: '#24140f', B: '#8e1f2a', b: '#d63c3c', y: '#ff8a2a', x: '#ffd43b' } },
  frostknight: { base: 'knight', pal: { g: '#b8d4e8', h: '#3a5068', B: '#2b5fb3', b: '#8ff3ff' } },
  ecknight: { base: 'knight', pal: { g: '#5a4a7a', h: '#221a2e', B: '#6a2fb3', b: '#b066ff', r: '#b066ff', R: '#6a2fb3' } },
  blackknight: { base: 'knight', pal: { g: '#4a4650', h: '#14101c', B: '#221a2e', b: '#3a3048', y: '#b8860b', r: '#8e1f2a' } },
  cultist: { base: 'witch', pal: { P: '#221a2e', u: '#3a2a4e', l: '#c8b8d8', x: '#b066ff', y: '#b066ff' } },
  executioner: { base: 'skel', pal: { m: '#d8c8b0', M: '#8a7a60', k: '#8e1f2a' } },
  ashdemon: { base: 'imp', pal: { r: '#4a2a22', R: '#24140f', y: '#ff8a2a', o: '#ffd43b' } },
  emberarcher: { base: 'skelarcher', pal: { m: '#c8a080', M: '#8a5040', k: '#ff3b2f' } },
  darkwraith: { base: 'wraith', pal: { c: '#6a2fb3', z: '#3a2a4e', b: '#ff3b2f' } },
  cavebat: { base: 'bat', pal: { P: '#3a3644', x: '#8ff3ff', w: '#8ff3ff' } },
  bogwitch: { base: 'witch', pal: { P: '#215e2b', u: '#3a4a2a', l: '#a8c890' } },
  eclipse2: { base: 'eclipse', pal: { v: '#0a0610', p: '#ff3b2f', P: '#3a1050', h: '#14101c', y: '#ff8a2a' } },
  clone: { base: 'eclipse', pal: { v: '#3a2a6e', p: '#b066ff', P: '#2a1a4e', y: '#8ff3ff' } },
  gargoyle2: { base: 'gargoyle', pal: { G: '#6a5a7e', g: '#9a8aae', h: '#2a2238' } },
  mimic: { base: 'chestOpen', pal: { k: '#8e1f2a', y: '#f4f4f4', Y: '#e8e0c8' } },
  bandit: { base: 'hollow', pal: { M: '#c8a080', T: '#3a3048', t: '#5a4a6a', q: '#221a2e' } },
};

const SPR = {};

function hexRGB(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rasterize(rows, pal, left) {
  const h = rows.length, w = Math.max(...rows.map(r => r.length));
  const W2 = w + 2, H2 = h + 2;
  const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const g = c.getContext('2d');
  const img = g.createImageData(W2, H2), d = img.data;
  const solid = new Uint8Array(W2 * H2);
  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '.' || !pal[ch]) continue;
      const [r, gg, b] = hexRGB(pal[ch]);
      const xx = left ? (w - 1 - x) : x;
      const o = ((y + 1) * W2 + xx + 1) * 4;
      d[o] = r; d[o + 1] = gg; d[o + 2] = b; d[o + 3] = 255;
      solid[(y + 1) * W2 + xx + 1] = 1;
    }
  }
  // contorno automático
  for (let y = 0; y < H2; y++) for (let x = 0; x < W2; x++) {
    if (solid[y * W2 + x]) continue;
    const n = (x > 0 && solid[y * W2 + x - 1]) || (x < W2 - 1 && solid[y * W2 + x + 1]) ||
      (y > 0 && solid[(y - 1) * W2 + x]) || (y < H2 - 1 && solid[(y + 1) * W2 + x]);
    if (n) { const o = (y * W2 + x) * 4; d[o] = 12; d[o + 1] = 8; d[o + 2] = 18; d[o + 3] = 235; }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function variantCanvas(src, mode) {
  const c = document.createElement('canvas'); c.width = src.width; c.height = src.height;
  const g = c.getContext('2d');
  if (mode === 'flip') { g.translate(src.width, 0); g.scale(-1, 1); g.drawImage(src, 0, 0); }
  else {
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = mode; g.fillRect(0, 0, c.width, c.height);
  }
  return c;
}

function buildSprite(name, rows, pal, left) {
  const c = rasterize(rows, pal, left);
  SPR[name] = { c, f: variantCanvas(c, 'flip'), wh: variantCanvas(c, '#ffffff'), w: c.width, h: c.height };
}

function buildAllSprites() {
  for (const k in SPRDEF) {
    const d = SPRDEF[k];
    if (Array.isArray(d)) buildSprite(k, d, PAL, false);
    else buildSprite(k, d.rows, PAL, d.left);
  }
  for (const k in SPRVAR) {
    const v = SPRVAR[k], d = SPRDEF[v.base];
    const pal = Object.assign({}, PAL, v.pal);
    if (Array.isArray(d)) buildSprite(k, d, pal, false);
    else buildSprite(k, d.rows, pal, d.left);
  }
  // brillo radial para la luz (se reutiliza escalado)
  const gc = document.createElement('canvas'); gc.width = gc.height = 128;
  const gg = gc.getContext('2d');
  const grd = gg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.75)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  gg.fillStyle = grd; gg.fillRect(0, 0, 128, 128);
  SPR._glow = gc;
  const glowCol = (col) => {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'); const r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    r.addColorStop(0, col); r.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = r; g.fillRect(0, 0, 64, 64); return c;
  };
  SPR._gFire = glowCol('rgba(255,140,40,0.9)');
  SPR._gCyan = glowCol('rgba(120,240,255,0.9)');
  SPR._gPurp = glowCol('rgba(180,100,255,0.9)');
  SPR._gGreen = glowCol('rgba(120,255,120,0.9)');
  SPR._gRed = glowCol('rgba(255,60,50,0.9)');
  SPR._gWhite = glowCol('rgba(255,250,220,0.9)');
}

// Dibuja centrado en (x, y). sc = escala de pixel.
function drawSpr(g, name, x, y, sc, flip, flash, alpha) {
  const s = SPR[name]; if (!s) return;
  const img = flash ? s.wh : (flip ? s.f : s.c);
  const w = s.w * sc, h = s.h * sc;
  if (alpha !== undefined && alpha < 1) g.globalAlpha = Math.max(0, alpha);
  if (flash && flip) {
    g.save(); g.translate(x, y); g.scale(-1, 1); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
  } else g.drawImage(img, Math.round(x - w / 2), Math.round(y - h / 2), w, h);
  if (alpha !== undefined && alpha < 1) g.globalAlpha = 1;
}

function drawIcon(g, id, x, y, size) {
  const it = (typeof ITEMS !== 'undefined' && ITEMS[id]) || null;
  const name = it ? it.icon : id.startsWith('i_') ? id : ('i_' + id);
  const s = SPR[name];
  if (!s) return;
  const sc = Math.max(1, Math.floor(size / Math.max(s.w, s.h)));
  g.drawImage(s.c, Math.round(x - s.w * sc / 2), Math.round(y - s.h * sc / 2), s.w * sc, s.h * sc);
}

// Dibujo procedural de armas (en el mundo y en la interfaz)
function drawWeaponShape(g, kind, len, col, el) {
  // origen en la empuñadura, apunta hacia +x
  const blade = col || '#cfd6df';
  g.fillStyle = '#5a3825';
  switch (kind) {
    case 'dagger':
      g.fillRect(-4, -2, 7, 4); g.fillStyle = '#b8860b'; g.fillRect(2, -4, 2, 8);
      g.fillStyle = blade; g.fillRect(4, -2, len - 6, 4); g.fillRect(len - 2, -1, 2, 2); break;
    case 'claw':
      g.fillStyle = '#3a9a3f'; g.fillRect(-4, -5, 8, 10);
      g.fillStyle = blade;
      for (let k = -1; k <= 1; k++) { g.fillRect(4, k * 4 - 1, len - 8, 2); g.fillRect(len - 4, k * 4 - 2, 3, 2); }
      break;
    case 'spear':
      g.fillRect(-10, -2, len - 10, 4);
      g.fillStyle = blade; g.beginPath(); g.moveTo(len - 14, -5); g.lineTo(len + 4, 0); g.lineTo(len - 14, 5); g.fill();
      break;
    case 'great':
      g.fillRect(-10, -3, 14, 6); g.fillStyle = '#b8860b'; g.fillRect(3, -9, 4, 18);
      g.fillStyle = blade; g.fillRect(7, -5, len - 12, 10);
      g.beginPath(); g.moveTo(len - 5, -5); g.lineTo(len + 4, 0); g.lineTo(len - 5, 5); g.fill(); break;
    case 'axe':
      g.fillRect(-8, -2, len, 4); g.fillStyle = blade;
      g.beginPath(); g.moveTo(len - 16, -2); g.lineTo(len - 10, -16); g.lineTo(len + 2, -14); g.lineTo(len - 2, -2); g.fill(); break;
    case 'hammer':
      g.fillRect(-8, -2, len - 6, 4); g.fillStyle = blade; g.fillRect(len - 16, -12, 16, 24);
      g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(len - 16, 6, 16, 6); break;
    case 'katana':
      g.fillStyle = '#221a2e'; g.fillRect(-8, -2, 12, 4); g.fillStyle = '#b8860b'; g.fillRect(3, -4, 2, 8);
      g.fillStyle = blade; g.beginPath(); g.moveTo(5, -2); g.quadraticCurveTo(len * 0.6, -6, len + 2, -6); g.lineTo(len - 6, 1); g.quadraticCurveTo(len * 0.5, 2, 5, 2); g.fill(); break;
    case 'scythe':
      g.fillRect(-10, -2, len, 4); g.fillStyle = blade;
      g.beginPath(); g.moveTo(len - 12, -2); g.quadraticCurveTo(len + 10, -10, len - 2, -30); g.quadraticCurveTo(len + 2, -10, len - 16, 2); g.fill(); break;
    default: // sword
      g.fillRect(-7, -2, 9, 4); g.fillStyle = '#b8860b'; g.fillRect(1, -7, 3, 14);
      g.fillStyle = blade; g.fillRect(4, -3, len - 8, 6);
      g.beginPath(); g.moveTo(len - 4, -3); g.lineTo(len + 3, 0); g.lineTo(len - 4, 3); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(4, -3, len - 8, 2);
  }
  if (el) {
    g.globalAlpha = 0.55; g.fillStyle = el === 'fire' ? '#ff8a2a' : el === 'frost' ? '#8ff3ff' : el === 'poison' ? '#7ee36b' : '#b066ff';
    g.fillRect(8, -2, len - 12, 4); g.globalAlpha = 1;
  }
}
