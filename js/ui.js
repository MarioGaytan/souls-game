'use strict';
// =====================================================================
//  INTERFAZ — HUD en canvas (vida, aguante, frasco, objeto rápido,
//  almas, minimapa, barra de jefe, avisos) y menús en DOM (título,
//  hoguera, nivel, viaje, equipo, herrera, mercader, mapa, victoria).
// =====================================================================

const $ = (id) => document.getElementById(id);
const iconCache = {};
function weaponIconURL(id) {
  if (iconCache['w' + id]) return iconCache['w' + id];
  const w = WEAPONS[id], c = document.createElement('canvas'); c.width = 96; c.height = 48;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.translate(48 - w.len * 0.55, 30); g.rotate(-0.35);
  drawWeaponShape(g, w.kind, w.len, w.col, w.el);
  return (iconCache['w' + id] = c.toDataURL());
}
function itemIconURL(id) {
  const key = 'i' + id; if (iconCache[key]) return iconCache[key];
  const c = document.createElement('canvas'); c.width = c.height = 40;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  if (RINGS[id]) { g.strokeStyle = RINGS[id].col; g.lineWidth = 5; g.beginPath(); g.arc(20, 22, 10, 0, TAU); g.stroke(); g.fillStyle = '#ffd43b'; g.fillRect(16, 6, 8, 7); }
  else drawIcon(g, id === 'frasco' ? 'i_frasco' : id, 20, 20, 36);
  return (iconCache[key] = c.toDataURL());
}
function fmtTime(s) { const h = Math.floor(s / 3600), m = Math.floor(s / 60) % 60; return h + 'h ' + String(m).padStart(2, '0') + 'm'; }
function esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

const UI = {
  onAct: null, cur: null,
  init() {
    $('panel').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
      sfx('menu');
      this.onAct && this.onAct(b.dataset.a, b.dataset);
    });
    $('title').addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]'); if (!b) return;
      audioInit(); sfx('menu');
      const a = b.dataset.a;
      if (a === 'continue') this.startGame(false);
      else if (a === 'new') { if (hasSave()) this.titleSub('confirm'); else this.startGame(true); }
      else if (a === 'newok') this.startGame(true);
      else if (a === 'controls') this.titleSub('controls');
      else if (a === 'options') this.titleSub('options');
      else if (a === 'back') this.titleSub(null);
      else if (a === 'opt') { this.toggleOpt(b.dataset.k); this.titleSub('options'); }
    });
    this.titleSub(null);
  },
  titleSub(which) {
    const box = $('titleBox');
    if (!which) {
      box.innerHTML = `
        ${hasSave() ? '<button class="btn big" data-a="continue">Continuar</button>' : ''}
        <button class="btn big" data-a="new">Nueva partida</button>
        <div class="row"><button class="btn" data-a="controls">Controles</button><button class="btn" data-a="options">Opciones</button></div>`;
    } else if (which === 'confirm') {
      box.innerHTML = `<p class="dim">¿Empezar una partida nueva? Se perderá la partida guardada.</p>
        <button class="btn big danger" data-a="newok">Sí, empezar de cero</button><button class="btn" data-a="back">Cancelar</button>`;
    } else if (which === 'controls') {
      box.innerHTML = this.controlsHTML() + '<button class="btn" data-a="back">Volver</button>';
    } else {
      box.innerHTML = this.optionsHTML() + '<button class="btn" data-a="back">Volver</button>';
    }
  },
  controlsHTML() {
    if (typeof TOUCH !== 'undefined' && TOUCH.on) return `<div class="ctrl"><p>Joystick izquierdo: moverse · Botones: atacar, fuerte, rodar, frasco, objeto, interactuar.</p><p>Mantén CORRER para esprintar. El ataque apunta solo al enemigo más cercano. FIJAR bloquea el objetivo.</p></div>`;
    return `<table class="ctrl">
      <tr><td>WASD / Flechas</td><td>Moverse</td></tr><tr><td>Ratón</td><td>Apuntar</td></tr>
      <tr><td>Clic izq. / J</td><td>Ataque ligero (combo)</td></tr><tr><td>Clic der. / K</td><td>Ataque fuerte</td></tr>
      <tr><td>Espacio</td><td>Rodar (invulnerable)</td></tr><tr><td>Shift</td><td>Correr</td></tr>
      <tr><td>Q</td><td>Beber Frasco de Ascuas</td></tr><tr><td>F / R / rueda</td><td>Usar / cambiar objeto</td></tr>
      <tr><td>E</td><td>Interactuar · descansar · leer</td></tr><tr><td>Tab / clic central</td><td>Fijar objetivo</td></tr>
      <tr><td>M</td><td>Mapa</td></tr><tr><td>Esc / I</td><td>Menú de equipo</td></tr></table>`;
  },
  optionsHTML() {
    const s = SAVE.settings, on = (v) => v ? 'SÍ' : 'NO';
    return `<div class="opts">
      <button class="btn" data-a="opt" data-k="music">Música: ${on(s.music)}</button>
      <button class="btn" data-a="opt" data-k="sfx">Efectos: ${on(s.sfx)}</button>
      <button class="btn" data-a="opt" data-k="quality">Calidad: ${s.quality === 'high' ? 'ALTA' : 'BAJA'}</button>
      <button class="btn" data-a="opt" data-k="dmgNums">Números de daño: ${on(s.dmgNums)}</button>
      <button class="btn" data-a="opt" data-k="shake">Temblor de cámara: ${on(s.shake)}</button>
      <button class="btn" data-a="opt" data-k="fps">Mostrar FPS: ${on(s.fps)}</button></div>`;
  },
  toggleOpt(k) {
    const s = SAVE.settings;
    if (k === 'quality') { s.quality = s.quality === 'high' ? 'low' : 'high'; resize(); }
    else s[k] = !s[k];
    saveSettings();
    if (k === 'music' && AUD.ctx) { const t = AUD.track; AUD.track = -2; setMusic(t, AUD.boss); }
  },
  startGame(fresh) {
    audioInit();
    $('title').classList.add('hidden');
    if (fresh) newGame(); else loadGame();
    if (typeof TOUCH !== 'undefined' && TOUCH.on) $('touch').classList.remove('hidden');
    resize();
  },
  open(html, onAct, cls) {
    S.mode = 'panel';
    const box = $('panelBox');
    box.className = 'box ' + (cls || '');
    box.innerHTML = html;
    $('panel').classList.remove('hidden');
    this.onAct = onAct;
    for (const k in keys) keys[k] = false;
  },
  close() {
    $('panel').classList.add('hidden');
    this.onAct = null; this.cur = null;
    if (S) S.mode = 'play';
    clearPressed();
  },
  head(title, sub) { return `<div class="hd"><h2>${title}</h2>${sub ? `<div class="sub">${sub}</div>` : ''}<button class="x" data-a="close">✕</button></div>`; },
  soulsLine() { return `<div class="souls">Almas: <b>${P.souls.toLocaleString('es')}</b> · Nivel ${pLevel()}</div>`; },

  // ---------------------------------------------------------------- hoguera
  bonfire(bf) {
    this.cur = 'bonfire';
    this.open(this.head('🔥 ' + esc(bf.n), 'Has descansado. Tu frasco está lleno y los enemigos han vuelto.') + this.soulsLine() + `
      <div class="col">
        <button class="btn big" data-a="level">Subir de nivel</button>
        <button class="btn big" data-a="travel">Viajar</button>
        <button class="btn big" data-a="equip">Equipo</button>
        <button class="btn" data-a="close">Levantarse</button>
      </div>`, (a) => {
      if (a === 'close') this.close();
      else if (a === 'level') this.levelUp(bf);
      else if (a === 'travel') this.travel(bf);
      else if (a === 'equip') this.menu('armas', bf);
    });
  },
  levelUp(bf) {
    const add = { vig: 0, end: 0, str: 0, dex: 0 };
    const names = { vig: ['Vigor', 'Vida máxima'], end: ['Aguante', 'Aguante máximo'], str: ['Fuerza', 'Daño de armas pesadas'], dex: ['Destreza', 'Daño de armas rápidas'] };
    const draw = () => {
      const lv = pLevel(); let cost = 0, n = 0;
      for (const k in add) for (let i = 0; i < add[k]; i++) cost += levelCost(lv + n++);
      const next = levelCost(lv + n);
      const save = P.stats; const tmp = { ...save }; for (const k in add) tmp[k] += add[k];
      P.stats = tmp; const hp = maxHP(), st = maxSta(), dm = Math.round(weaponDmg()); P.stats = save;
      const rows = Object.keys(add).map(k => `<tr><td>${names[k][0]}<small>${names[k][1]}</small></td><td class="num">${P.stats[k]}${add[k] ? ` <b class="up">→ ${P.stats[k] + add[k]}</b>` : ''}</td>
        <td><button class="btn sm" data-a="minus" data-k="${k}" ${add[k] ? '' : 'disabled'}>−</button><button class="btn sm" data-a="plus" data-k="${k}" ${P.souls >= cost + next && P.stats[k] + add[k] < 60 ? '' : 'disabled'}>+</button></td></tr>`).join('');
      this.open(this.head('Subir de nivel', 'Gasta almas para fortalecerte') + this.soulsLine() + `
        <table class="lv">${rows}</table>
        <div class="derived">Vida: <b>${hp}</b> · Aguante: <b>${st}</b> · Daño del arma: <b>${dm}</b></div>
        <div class="derived">Coste: <b>${cost.toLocaleString('es')}</b> almas · Siguiente nivel: ${next.toLocaleString('es')}</div>
        <div class="row"><button class="btn big" data-a="ok" ${n ? '' : 'disabled'}>Confirmar</button><button class="btn" data-a="back">Volver</button></div>`, (a, d) => {
        if (a === 'plus') { add[d.k]++; draw(); }
        else if (a === 'minus') { add[d.k]--; draw(); }
        else if (a === 'ok') {
          P.souls -= cost; for (const k in add) P.stats[k] += add[k];
          P.hp = maxHP(); P.sta = maxSta(); sfx('lvl'); saveGame();
          for (const k in add) add[k] = 0; draw();
        } else if (a === 'back') bf ? this.bonfire(bf) : this.close();
        else if (a === 'close') this.close();
      });
    };
    draw();
  },
  travel(bf) {
    const groups = {};
    for (const b of WORLD.bonfires) if (P.lit[b.id]) (groups[b.reg] = groups[b.reg] || []).push(b);
    let html = this.head('Viajar', 'Hogueras encendidas');
    for (const r in groups) {
      html += `<div class="grp">${REGIONS[r].n}</div><div class="list">` + groups[r].map(b => `<button class="btn ${b.id === bf.id ? 'cur' : ''}" data-a="go" data-id="${b.id}">${esc(b.n)}</button>`).join('') + '</div>';
    }
    html += '<div class="row"><button class="btn" data-a="back">Volver</button></div>';
    this.open(html, (a, d) => {
      if (a === 'go') {
        const to = WORLD.bonfires.find(b => b.id === d.id);
        this.close();
        fadeTo(() => { restAt(to); S.area = { txt: REGIONS[to.reg].n, t: 0 }; });
      } else if (a === 'back') this.bonfire(bf);
      else if (a === 'close') this.close();
    });
  },

  // ---------------------------------------------------------------- equipo
  menu(tab, bf) {
    tab = tab || 'armas'; this.cur = 'menu';
    const tabs = [['armas', 'Armas'], ['anillos', 'Anillos'], ['objetos', 'Objetos'], ['estado', 'Estado'], ['opciones', 'Opciones']];
    let html = this.head('Equipo') + `<div class="tabs">${tabs.map(t => `<button class="tab ${t[0] === tab ? 'on' : ''}" data-a="tab" data-t="${t[0]}">${t[1]}</button>`).join('')}</div>`;
    if (tab === 'armas') {
      html += '<div class="cards">' + P.weapons.map(id => {
        const w = WEAPONS[id], up = P.wlv[id] || 0;
        return `<button class="card ${P.weapon === id ? 'eq' : ''}" data-a="weq" data-id="${id}">
          <img src="${weaponIconURL(id)}" alt=""><div><b>${w.n}${up ? ' +' + up : ''}</b>
          <small>Daño ${Math.round(weaponDmg(id))} · Alcance ${w.reach} · Escala F:${scaleLetter(w.sS)} D:${scaleLetter(w.sD)}${w.el ? ' · ' + { fire: 'Fuego', frost: 'Escarcha', poison: 'Veneno', light: 'Luz' }[w.el] : ''}</small>
          <small class="dim">${w.d}</small></div>${P.weapon === id ? '<span class="tag">EQUIPADA</span>' : ''}</button>`;
      }).join('') + '</div>';
    } else if (tab === 'anillos') {
      html += `<div class="slots">Ranuras: ${P.ringEq.map(r => r ? RINGS[r].n : '— vacía —').join(' · ')}</div>`;
      html += P.rings.length ? '<div class="cards">' + P.rings.map(id => {
        const on = P.ringEq.includes(id);
        return `<button class="card ${on ? 'eq' : ''}" data-a="req" data-id="${id}"><img src="${itemIconURL(id)}" alt=""><div><b>${RINGS[id].n}</b><small>${RINGS[id].d}</small></div>${on ? '<span class="tag">PUESTO</span>' : ''}</button>`;
      }).join('') + '</div>' : '<p class="dim">Aún no tienes anillos. Búscalos en cofres.</p>';
    } else if (tab === 'objetos') {
      const ids = Object.keys(P.inv).filter(k => P.inv[k] > 0);
      html += `<div class="cards"><div class="card"><img src="${itemIconURL('frasco')}" alt=""><div><b>Frasco de Ascuas (${P.flasks}/${P.flaskMax})</b><small>Cura ${healAmt()} de vida. Se rellena en las hogueras.</small></div></div>`;
      html += ids.map(id => `<button class="card ${currentQuick() === id ? 'eq' : ''}" data-a="iq" data-id="${id}"><img src="${itemIconURL(id)}" alt=""><div><b>${ITEMS[id].n} ×${P.inv[id]}</b><small>${ITEMS[id].d}</small></div>${USABLE.includes(id) ? (currentQuick() === id ? '<span class="tag">RÁPIDO</span>' : '') : `<span class="tag dim">${ITEMS[id].k === 'mat' ? 'MATERIAL' : 'CLAVE'}</span>`}</button>`).join('') + '</div>';
    } else if (tab === 'estado') {
      const n = GREAT_SOULS.filter(k => P.inv[k]).length;
      html += `<table class="lv">
        <tr><td>Nivel</td><td class="num">${pLevel()}</td></tr><tr><td>Almas</td><td class="num">${P.souls.toLocaleString('es')}</td></tr>
        <tr><td>Vida</td><td class="num">${Math.ceil(P.hp)} / ${maxHP()}</td></tr><tr><td>Aguante</td><td class="num">${maxSta()}</td></tr>
        <tr><td>Vigor · Aguante · Fuerza · Destreza</td><td class="num">${P.stats.vig} · ${P.stats.end} · ${P.stats.str} · ${P.stats.dex}</td></tr>
        <tr><td>Grandes Almas</td><td class="num">${n} / 5</td></tr>
        <tr><td>Jefes derrotados</td><td class="num">${Object.keys(GS.bosses).length} / 6</td></tr>
        <tr><td>Muertes</td><td class="num">${GS.deaths}</td></tr><tr><td>Tiempo</td><td class="num">${fmtTime(GS.time)}</td></tr></table>
        ${bf ? '<button class="btn" data-a="level">Subir de nivel</button>' : '<p class="dim">Sube de nivel descansando en una hoguera.</p>'}`;
    } else if (tab === 'opciones') {
      html += this.optionsHTML() + `<div class="row"><button class="btn" data-a="controls">Ver controles</button><button class="btn danger" data-a="quit">Guardar y salir al título</button></div><div id="ctrlBox"></div>`;
    }
    html += `<div class="row">${bf ? '<button class="btn" data-a="back">Volver a la hoguera</button>' : '<button class="btn" data-a="close">Continuar</button>'}</div>`;
    this.open(html, (a, d) => {
      if (a === 'tab') this.menu(d.t, bf);
      else if (a === 'weq') { P.weapon = d.id; sfx('pick'); this.menu(tab, bf); }
      else if (a === 'req') {
        const i = P.ringEq.indexOf(d.id);
        if (i >= 0) P.ringEq[i] = null;
        else if (!P.ringEq[0]) P.ringEq[0] = d.id; else if (!P.ringEq[1]) P.ringEq[1] = d.id; else P.ringEq[1] = d.id;
        P.hp = Math.min(P.hp, maxHP()); sfx('pick'); this.menu(tab, bf);
      } else if (a === 'iq') { const l = quickList(); const i = l.indexOf(d.id); if (i >= 0) P.quick = i; this.menu(tab, bf); }
      else if (a === 'opt') { this.toggleOpt(d.k); this.menu(tab, bf); }
      else if (a === 'controls') { $('ctrlBox').innerHTML = this.controlsHTML(); }
      else if (a === 'quit') { saveGame(); this.close(); this.toTitle(); }
      else if (a === 'level') this.levelUp(bf);
      else if (a === 'back') this.bonfire(bf);
      else if (a === 'close') this.close();
    });
  },
  toTitle() {
    S = null; P = null; setMusic(-1, false);
    $('touch').classList.add('hidden');
    $('title').classList.remove('hidden'); this.titleSub(null);
  },

  // ---------------------------------------------------------------- herrera
  smith() {
    this.cur = 'smith';
    const lines = ['Brunhild golpea el yunque sin mirarte. «Trae titanita y almas, y tu acero cantará.»', '«Un arma bien templada es la diferencia entre un cadáver y una leyenda.»'];
    let html = this.head('Brunhild, la Herrera', lines[Math.floor(S.time) % 2]) + this.soulsLine() + `<div class="souls">Titanita: <b>${P.inv.titanita || 0}</b></div><div class="cards">`;
    html += P.weapons.map(id => {
      const w = WEAPONS[id], up = P.wlv[id] || 0, needT = up + 1, needS = 400 * (up + 1);
      const can = up < 5 && (P.inv.titanita || 0) >= needT && P.souls >= needS;
      return `<div class="card"><img src="${weaponIconURL(id)}" alt=""><div><b>${w.n} +${up}</b><small>Daño ${Math.round(weaponDmg(id))}${up < 5 ? ` → ${Math.round(weaponDmg(id) * (1 + 0.13 * (up + 1)) / (1 + 0.13 * up))}` : ''}</small>
        <small class="dim">${up < 5 ? `Coste: ${needT} titanita · ${needS} almas` : 'Refuerzo máximo'}</small></div>
        ${up < 5 ? `<button class="btn sm" data-a="up" data-id="${id}" ${can ? '' : 'disabled'}>Reforzar</button>` : ''}</div>`;
    }).join('') + '</div><div class="row"><button class="btn" data-a="close">Despedirse</button></div>';
    this.open(html, (a, d) => {
      if (a === 'up') {
        const up = P.wlv[d.id] || 0;
        P.inv.titanita -= up + 1; if (P.inv.titanita <= 0) delete P.inv.titanita;
        P.souls -= 400 * (up + 1); P.wlv[d.id] = up + 1;
        sfx('wall'); sfx('lvl'); saveGame(); this.smith();
      } else if (a === 'close') this.close();
    });
  },
  // ---------------------------------------------------------------- mercader
  shop() {
    this.cur = 'shop';
    let html = this.head('Oswin, el Mercader', '«¡Je, je! Almas por mercancía, amigo. Nada de preguntas.»') + this.soulsLine() + '<div class="cards">';
    SHOP.forEach((s, k) => {
      const sold = GS.shop[k] || 0, left = s.stock ? s.stock - sold : Infinity;
      const owned = (WEAPONS[s.id] && P.weapons.includes(s.id)) || (RINGS[s.id] && P.rings.includes(s.id));
      const name = WEAPONS[s.id] ? WEAPONS[s.id].n : RINGS[s.id] ? RINGS[s.id].n : ITEMS[s.id].n;
      const desc = WEAPONS[s.id] ? WEAPONS[s.id].d : RINGS[s.id] ? RINGS[s.id].d : ITEMS[s.id].d;
      const img = WEAPONS[s.id] ? weaponIconURL(s.id) : itemIconURL(s.id);
      const can = left > 0 && !owned && P.souls >= s.price;
      html += `<div class="card"><img src="${img}" alt=""><div><b>${name}${s.n > 1 ? ' ×' + s.n : ''}</b><small>${desc}</small>
        <small class="dim">${s.price} almas${s.stock ? ` · quedan ${left}` : ''}${owned ? ' · ya lo tienes' : ''}</small></div>
        <button class="btn sm" data-a="buy" data-k="${k}" ${can ? '' : 'disabled'}>Comprar</button></div>`;
    });
    html += '</div><div class="row"><button class="btn" data-a="close">Despedirse</button></div>';
    this.open(html, (a, d) => {
      if (a === 'buy') {
        const s = SHOP[+d.k];
        P.souls -= s.price; GS.shop[d.k] = (GS.shop[d.k] || 0) + 1;
        give(s.id, s.n, true); sfx('souls'); saveGame(); this.shop();
      } else if (a === 'close') this.close();
    });
  },

  // ---------------------------------------------------------------- mapa
  map() {
    this.cur = 'map';
    this.open(this.head('Mapa de Umbraterra', 'Solo se muestra lo que has explorado') + `<canvas id="mapC"></canvas>
      <div class="legend"><span><i style="background:#ffb04a"></i>Hoguera</span><span><i style="background:#fff"></i>Tú</span><span><i style="background:#7ee36b"></i>Almas perdidas</span><span><i style="background:#ff3b2f"></i>Jefe</span><span><i style="background:#ffd43b"></i>Reja / sello</span></div>`, (a) => { if (a === 'close') this.close(); }, 'wide');
    const c = $('mapC'), size = Math.min(window.innerWidth - 60, window.innerHeight - 190, 760);
    c.width = c.height = size * Math.min(2, window.devicePixelRatio || 1);
    c.style.width = c.style.height = size + 'px';
    const g = c.getContext('2d'), k = c.width / MW;
    g.fillStyle = '#07050b'; g.fillRect(0, 0, c.width, c.height);
    g.imageSmoothingEnabled = false; g.drawImage(mapCv, 0, 0, c.width, c.height);
    const dot = (x, y, col, r) => { g.fillStyle = col; g.beginPath(); g.arc(x / TILE * k, y / TILE * k, r * k, 0, TAU); g.fill(); };
    for (const gt of WORLD.gates) if (!GS.gates[gt.id] && MAP.exp[Math.floor(gt.y / TILE) * MW + Math.floor(gt.x / TILE)]) dot(gt.x, gt.y, '#ffd43b', 1.6);
    for (const a of WORLD.arenas) if (MAP.exp[Math.floor(a.y / TILE) * MW + Math.floor(a.x / TILE)]) {
      g.font = `${Math.round(5 * k)}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = GS.bosses[a.id] ? '#6a6678' : '#ff3b2f'; g.fillText('☠', a.x / TILE * k, a.y / TILE * k);
    }
    for (const b of WORLD.bonfires) if (P.lit[b.id]) dot(b.x, b.y, '#ffb04a', 1.5);
    if (GS.blood) dot(GS.blood.x, GS.blood.y, '#7ee36b', 1.5);
    g.save(); g.translate(P.x / TILE * k, P.y / TILE * k); g.rotate(P.aim);
    g.fillStyle = '#ffffff'; g.beginPath(); g.moveTo(3 * k, 0); g.lineTo(-2 * k, -2 * k); g.lineTo(-2 * k, 2 * k); g.fill(); g.restore();
    // nombres de las regiones conocidas
    g.font = `bold ${Math.round(2.6 * k)}px Silkscreen, monospace`; g.textAlign = 'center';
    REGIONS.forEach(r => {
      if (!MAP.exp[r.cy * MW + r.cx] && !Object.values(WORLD.bonfires).some(b => P.lit[b.id] && b.reg === REGIONS.indexOf(r))) return;
      g.fillStyle = 'rgba(0,0,0,0.7)'; g.fillText(r.n, r.cx * k + 1, (r.cy - 6) * k + 1);
      g.fillStyle = '#ece6ff'; g.fillText(r.n, r.cx * k, (r.cy - 6) * k);
    });
  },
  victory() {
    this.cur = 'win';
    sfx('victory');
    this.open(`<div class="hd"><h2 class="gold">EL ALBA REGRESA</h2></div>
      <p class="story">El Soberano del Eclipse cae, y con él la noche eterna que cubría Umbraterra. Las cinco Grandes Almas vuelven a la hoguera primigenia y, por primera vez en siglos, el sol asoma tras la ciudadela.</p>
      <table class="lv"><tr><td>Tiempo</td><td class="num">${fmtTime(GS.time)}</td></tr><tr><td>Muertes</td><td class="num">${GS.deaths}</td></tr><tr><td>Nivel</td><td class="num">${pLevel()}</td></tr></table>
      <div class="row"><button class="btn big" data-a="close">Seguir explorando</button><button class="btn" data-a="title">Volver al título</button></div>`, (a) => {
      if (a === 'close') this.close();
      else if (a === 'title') { saveGame(); this.close(); this.toTitle(); }
    });
  },
};

function onKeyUI(e) {
  if (!S || S.mode !== 'panel') return;
  if (e.code === 'Escape' || (e.code === 'KeyM' && UI.cur === 'map') || (e.code === 'KeyI' && UI.cur === 'menu')) {
    e.preventDefault();
    if (UI.cur === 'win') return;
    UI.close();
  }
}

// =====================================================================
//  HUD
// =====================================================================
function drawHUD() {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const T = S.time, touchy = typeof TOUCH !== 'undefined' && TOUCH.on;
  const sc = clamp(Math.min(W / 1280, H / 720) * 1.0, 0.7, 1.3);
  ctx.save(); ctx.scale(sc, sc);
  const VW = W / sc, VH = H / sc;
  ctx.textBaseline = 'alphabetic';
  // ---- vida y aguante
  const mh = maxHP(), ms = maxSta();
  const bx = 22, by = 20;
  const hw = Math.min(520, 120 + mh * 1.3), sw = Math.min(420, 100 + ms * 1.3);
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 3, by - 3, hw + 6, 16); ctx.fillRect(bx - 3, by + 17, sw + 6, 12);
  ctx.fillStyle = '#3a1018'; ctx.fillRect(bx, by, hw, 10);
  S.hpGhost = S.hpGhost === undefined ? P.hp : (S.hpGhost > P.hp ? S.hpGhost - mh * 0.4 * (1 / 60) : P.hp);
  ctx.fillStyle = '#e8c070'; ctx.fillRect(bx, by, hw * clamp(S.hpGhost / mh, 0, 1), 10);
  ctx.fillStyle = P.sts.poison > 0 ? '#5aa04a' : '#c0303a'; ctx.fillRect(bx, by, hw * clamp(P.hp / mh, 0, 1), 10);
  ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(bx, by, hw * clamp(P.hp / mh, 0, 1), 2);
  ctx.fillStyle = '#10301a'; ctx.fillRect(bx, by + 20, sw, 6);
  ctx.fillStyle = P.sta < 15 ? '#c8a030' : '#4ab84a'; ctx.fillRect(bx, by + 20, sw * clamp(P.sta / ms, 0, 1), 6);
  // acumulaciones y estados
  let sy = by + (touchy ? 66 : 36);
  const stbar = (v, col, label) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 2, sy - 2, 124, 9);
    ctx.fillStyle = col; ctx.fillRect(bx, sy, 120 * clamp(v / 100, 0, 1), 5);
    ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = col; ctx.fillText(label, bx + 128, sy + 6); sy += 12;
  };
  if (P.sts.pb > 1) stbar(P.sts.pb, '#7ee36b', 'Veneno');
  if (P.sts.fb > 1) stbar(P.sts.fb, '#8ff3ff', 'Escarcha');
  const icons = [];
  if (P.sts.poison > 0) icons.push(['VENENO', '#7ee36b', P.sts.poison]);
  if (P.sts.burn > 0) icons.push(['QUEMADURA', '#ff8a2a', P.sts.burn]);
  if (P.sts.frost > 0) icons.push(['CONGELADO', '#8ff3ff', P.sts.frost]);
  if (P.sts.slow > 0) icons.push(['ATRAPADO', '#e8e0c8', P.sts.slow]);
  if (P.buf.herb > 0) icons.push(['HIERBA', '#4ab84a', P.buf.herb]);
  if (P.buf.resin > 0) icons.push(['RESINA', '#ff5a3a', P.buf.resin]);
  ctx.font = '10px Silkscreen, monospace';
  icons.forEach((ic, i) => {
    const x = bx + i * 92;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, sy, 88, 16);
    ctx.fillStyle = ic[1]; ctx.fillText(ic[0] + ' ' + Math.ceil(ic[2]), x + 4, sy + 12);
  });

  // ---- ranuras rápidas (abajo a la izquierda)
  if (!touchy) {
    const qx = 26, qy = VH - 96;
    const slot = (x, y, s) => { ctx.fillStyle = 'rgba(10,6,16,0.75)'; ctx.fillRect(x, y, s, s); ctx.strokeStyle = '#5a4a72'; ctx.lineWidth = 2; ctx.strokeRect(x, y, s, s); };
    slot(qx, qy, 70);
    drawIcon(ctx, P.flasks > 0 ? 'i_frasco' : 'i_frascoV', qx + 35, qy + 32, 46);
    ctx.font = 'bold 16px Silkscreen, monospace'; ctx.textAlign = 'right'; ctx.fillStyle = P.flasks ? '#ffd43b' : '#6a6678';
    ctx.fillText(P.flasks, qx + 66, qy + 66);
    ctx.textAlign = 'left'; ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = '#a99cc4'; ctx.fillText('Q', qx + 4, qy + 12);
    const q = currentQuick();
    slot(qx + 80, qy + 10, 60);
    if (q) {
      drawIcon(ctx, q, qx + 110, qy + 38, 34);
      ctx.font = 'bold 14px Silkscreen, monospace'; ctx.textAlign = 'right'; ctx.fillStyle = '#ece6ff'; ctx.fillText(P.inv[q], qx + 136, qy + 66);
      ctx.textAlign = 'left'; ctx.font = '10px Silkscreen, monospace'; ctx.fillStyle = '#ece6ff'; ctx.fillText(ITEMS[q].n, qx + 80, qy + 2);
    }
    ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = '#a99cc4'; ctx.fillText('F', qx + 84, qy + 22);
    slot(qx + 150, qy + 10, 60);
    const w = WEAPONS[P.weapon];
    ctx.save(); ctx.translate(qx + 180 - w.len * 0.4, qy + 48); ctx.rotate(-0.7); ctx.scale(0.8, 0.8); drawWeaponShape(ctx, w.kind, w.len, w.col, w.el); ctx.restore();
    if (P.wlv[P.weapon]) { ctx.font = 'bold 12px Silkscreen, monospace'; ctx.fillStyle = '#ffd43b'; ctx.textAlign = 'right'; ctx.fillText('+' + P.wlv[P.weapon], qx + 206, qy + 66); }
    ctx.textAlign = 'left';
  } else {
    // táctil: contadores junto a los botones (los dibuja touch.js en DOM)
    TOUCH.updateLabels && TOUCH.updateLabels();
  }

  // ---- almas (abajo a la derecha)
  if (touchy) {
    ctx.font = 'bold 18px Silkscreen, monospace';
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(bx - 3, by + 34, 150, 26);
    ctx.fillStyle = '#c8f8ff'; ctx.fillText(P.souls.toLocaleString('es'), bx + 50, by + 54);
    ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = '#a99cc4'; ctx.fillText('ALMAS', bx + 2, by + 51);
  } else {
    ctx.textAlign = 'right';
    ctx.font = 'bold 22px Silkscreen, monospace';
    const sx = VW - 26, syy = VH - 30;
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(sx - 170, syy - 24, 176, 32);
    ctx.fillStyle = '#c8f8ff'; ctx.fillText(P.souls.toLocaleString('es'), sx, syy);
    ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = '#a99cc4'; ctx.fillText('ALMAS', sx - 120, syy - 10);
    ctx.textAlign = 'left';
  }

  // ---- minimapa
  drawMinimap(VW - 176, 16, 160);

  // ---- barra de jefe
  if (S.boss && !S.boss.dead) {
    const b = S.boss, w = touchy ? Math.min(520, VW - 460) : Math.min(760, VW - 120), x = (VW - w) / 2, y = touchy ? 96 : VH - 64;
    ctx.font = '14px Silkscreen, monospace'; ctx.fillStyle = '#ece6ff'; ctx.fillText(S.bossName, x, y - 8);
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 3, y - 3, w + 6, 16);
    ctx.fillStyle = '#3a1018'; ctx.fillRect(x, y, w, 10);
    S.bGhost = S.bGhost === undefined || S.bGhostId !== b ? b.hp : Math.max(b.hp, S.bGhost - b.max * 0.25 / 60);
    S.bGhostId = b;
    ctx.fillStyle = '#e8c070'; ctx.fillRect(x, y, w * clamp(S.bGhost / b.max, 0, 1), 10);
    ctx.fillStyle = '#a8202a'; ctx.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 10);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 2);
  } else if (S.miniBar) {
    const b = S.miniBar, w = Math.min(420, VW - 300), x = (VW - w) / 2, y = 34;
    ctx.font = '11px Silkscreen, monospace'; ctx.textAlign = 'center'; ctx.fillStyle = '#ece6ff'; ctx.fillText(b.d.n, VW / 2, y - 6); ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(x - 2, y - 2, w + 4, 10);
    ctx.fillStyle = '#a8202a'; ctx.fillRect(x, y, w * clamp(b.hp / b.max, 0, 1), 6);
  }

  // ---- aviso de interacción / mensaje
  if (!P.dead && S.mode === 'play') {
    const it = interactables();
    if (it && !(S.msg && it.k === 'msg')) {
      const txt = (touchy ? '' : '[E] ') + it.label;
      ctx.font = '14px Silkscreen, monospace'; ctx.textAlign = 'center';
      const tw2 = ctx.measureText(txt).width + 30, y = VH * 0.72;
      ctx.fillStyle = 'rgba(10,6,16,0.82)'; ctx.fillRect(VW / 2 - tw2 / 2, y - 22, tw2, 32);
      ctx.strokeStyle = '#5a4a72'; ctx.strokeRect(VW / 2 - tw2 / 2, y - 22, tw2, 32);
      ctx.fillStyle = '#ece6ff'; ctx.fillText(txt, VW / 2, y);
      ctx.textAlign = 'left';
    }
  }
  if (S.msg) {
    ctx.font = '15px Silkscreen, monospace'; ctx.textAlign = 'center';
    const lines = wrapText(S.msg.txt, Math.min(560, VW - 80)); const h = 24 + lines.length * 22, y = VH * 0.62;
    const w = Math.min(600, VW - 40);
    ctx.fillStyle = 'rgba(20,10,6,0.88)'; ctx.fillRect(VW / 2 - w / 2, y - h / 2, w, h);
    ctx.strokeStyle = '#ff9a4a'; ctx.strokeRect(VW / 2 - w / 2, y - h / 2, w, h);
    ctx.fillStyle = '#ffd8a8'; lines.forEach((l, i) => ctx.fillText(l, VW / 2, y - h / 2 + 30 + i * 22));
    ctx.textAlign = 'left';
  }

  // ---- avisos de objetos
  S.toasts.forEach((t, i) => {
    const a = Math.min(1, t.t * 5, (3.5 - t.t) * 2), y = VH * 0.36 + i * 40;
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(10,6,16,0.85)'; ctx.fillRect(16, y, 330, 34);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(16, y, 3, 34);
    if (t.icon) {
      if (t.icon.startsWith('w:')) { const w = WEAPONS[t.icon.slice(2)]; ctx.save(); ctx.translate(30, y + 24); ctx.rotate(-0.6); ctx.scale(0.5, 0.5); drawWeaponShape(ctx, w.kind, w.len, w.col, w.el); ctx.restore(); }
      else if (t.icon.startsWith('r:')) { ctx.strokeStyle = RINGS[t.icon.slice(2)].col; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(40, y + 17, 8, 0, TAU); ctx.stroke(); }
      else drawIcon(ctx, t.icon, 40, y + 17, 24);
    }
    ctx.font = '12px Silkscreen, monospace'; ctx.fillStyle = '#ece6ff';
    ctx.fillText(t.txt + (t.n > 1 ? ' ×' + t.n : ''), t.icon ? 62 : 28, y + 22);
    ctx.globalAlpha = 1;
  });

  // ---- nombre de la región
  if (S.area && !S.banner) {
    const a = Math.min(1, S.area.t * 2, (3.5 - S.area.t) * 1.5);
    ctx.globalAlpha = a; ctx.textAlign = 'center';
    ctx.font = 'bold 30px Silkscreen, monospace'; ctx.fillStyle = '#000'; ctx.fillText(S.area.txt, VW / 2 + 2, VH * 0.2 + 2);
    ctx.fillStyle = '#ece6ff'; ctx.fillText(S.area.txt, VW / 2, VH * 0.2);
    ctx.fillStyle = '#ece6ff'; ctx.fillRect(VW / 2 - 200, VH * 0.2 + 12, 400, 1);
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  // ---- gran cartel
  if (S.banner) {
    const b = S.banner, a = Math.min(1, b.t * 2, (b.life - b.t) * 1.5);
    ctx.globalAlpha = a;
    const g = ctx.createLinearGradient(0, VH * 0.4 - 50, 0, VH * 0.4 + 50);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, 'rgba(0,0,0,0.75)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, VH * 0.4 - 60, VW, 120);
    ctx.textAlign = 'center';
    ctx.font = `bold ${Math.min(46, VW / 18)}px Silkscreen, monospace`;
    ctx.fillStyle = b.col; ctx.shadowColor = b.col; ctx.shadowBlur = 18;
    ctx.fillText(b.txt, VW / 2, VH * 0.4 + 12); ctx.shadowBlur = 0;
    if (b.sub) { ctx.font = '14px Silkscreen, monospace'; ctx.fillStyle = '#ece6ff'; ctx.fillText(b.sub, VW / 2, VH * 0.4 + 42); }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
  }
  ctx.restore();

  // ---- muerte
  if (P.dead) {
    const a = Math.min(1, P.t / 1.2);
    ctx.fillStyle = `rgba(0,0,0,${a * 0.55})`; ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, H / 2 - 70, 0, H / 2 + 70);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, `rgba(0,0,0,${a * 0.85})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.fillRect(0, H / 2 - 70, W, 140);
    ctx.textAlign = 'center'; ctx.font = `${Math.min(72, W / 10)}px Silkscreen, monospace`;
    ctx.fillStyle = `rgba(170,20,30,${a})`; ctx.fillText('HAS CAÍDO', W / 2, H / 2 + 24);
    ctx.textAlign = 'left';
  }
  // ---- fundido
  if (S.fade) {
    const p = S.fade.t / S.fade.dur, a = p < 0.5 ? p * 2 : (1 - p) * 2;
    ctx.fillStyle = `rgba(0,0,0,${clamp(a, 0, 1)})`; ctx.fillRect(0, 0, W, H);
  }
  if (SAVE.settings.fps) { ctx.font = '12px monospace'; ctx.fillStyle = '#7ee36b'; ctx.fillText(S.fps + ' fps', 8, H - 8); }
  // vignette suave para dar ambiente
  if (!LOWQ()) {
    if (!S._vig || S._vigW !== W || S._vigH !== H) {
      const c = document.createElement('canvas'); c.width = 256; c.height = 256; const g = c.getContext('2d');
      const r = g.createRadialGradient(128, 128, 60, 128, 128, 180); r.addColorStop(0, 'rgba(0,0,0,0)'); r.addColorStop(1, 'rgba(0,0,0,0.55)');
      g.fillStyle = r; g.fillRect(0, 0, 256, 256); S._vig = c; S._vigW = W; S._vigH = H;
    }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(S._vig, 0, 0, W, H); ctx.imageSmoothingEnabled = false;
  }
}

function wrapText(txt, maxW) {
  const words = txt.split(' '), lines = []; let cur = '';
  for (const w of words) { const t = cur ? cur + ' ' + w : w; if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t; }
  if (cur) lines.push(cur);
  return lines;
}

function drawMinimap(x, y, s) {
  const span = 46, tx = P.x / TILE - span / 2, ty = P.y / TILE - span / 2;
  ctx.fillStyle = 'rgba(6,3,12,0.8)'; ctx.fillRect(x - 3, y - 3, s + 6, s + 6);
  ctx.save(); ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = 0.9;
  ctx.drawImage(mapCv, tx, ty, span, span, x, y, s, s);
  ctx.globalAlpha = 1;
  const k = s / span;
  const pt = (wx, wy, col, r) => { const px = x + (wx / TILE - tx) * k, py = y + (wy / TILE - ty) * k; ctx.fillStyle = col; ctx.fillRect(px - r, py - r, r * 2, r * 2); };
  for (const b of WORLD.bonfires) if (P.lit[b.id]) pt(b.x, b.y, '#ffb04a', 3);
  if (GS.blood) pt(GS.blood.x, GS.blood.y, '#7ee36b', 3);
  for (const m of S.mobs) if (!m.dead && (m.st === 'chase' || m.st === 'atk')) pt(m.x, m.y, m.boss || m.mini ? '#ff3b2f' : '#d05050', m.boss || m.mini ? 3 : 1.5);
  ctx.save(); ctx.translate(x + s / 2, y + s / 2); ctx.rotate(P.aim);
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(-4, -4); ctx.lineTo(-4, 4); ctx.fill(); ctx.restore();
  ctx.restore();
  ctx.strokeStyle = '#5a4a72'; ctx.lineWidth = 2; ctx.strokeRect(x - 2, y - 2, s + 4, s + 4);
  ctx.font = '9px Silkscreen, monospace'; ctx.fillStyle = '#a99cc4'; ctx.textAlign = 'right';
  ctx.fillText(REGIONS[Math.max(0, S.reg)].n, x + s, y + s + 14); ctx.textAlign = 'left';
}
