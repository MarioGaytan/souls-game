'use strict';
// =====================================================================
//  CONTROLES TÁCTILES — joystick virtual a la izquierda y botones de
//  acción a la derecha. Envían los mismos códigos que el teclado.
// =====================================================================

const TOUCH = {
  on: false, mx: 0, my: 0, run: false, id: null, ox: 0, oy: 0,
  init() {
    this.on = ('ontouchstart' in window || navigator.maxTouchPoints > 0) && window.matchMedia('(pointer: coarse)').matches;
    if (!this.on) return;
    document.body.classList.add('touch');
    const zone = document.getElementById('joyZone'), base = document.getElementById('joy'), knob = document.getElementById('knob');
    const R = 56;
    zone.addEventListener('touchstart', (e) => {
      audioInit();
      const t = e.changedTouches[0]; this.id = t.identifier; this.ox = t.clientX; this.oy = t.clientY;
      base.style.left = (t.clientX - 70) + 'px'; base.style.top = (t.clientY - 70) + 'px'; base.classList.add('on');
      knob.style.transform = 'translate(0px,0px)';
      e.preventDefault();
    }, { passive: false });
    zone.addEventListener('touchmove', (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.id) {
        let dx = t.clientX - this.ox, dy = t.clientY - this.oy;
        const d = Math.hypot(dx, dy); if (d > R) { dx = dx / d * R; dy = dy / d * R; }
        this.mx = dx / R; this.my = dy / R;
        if (Math.hypot(this.mx, this.my) < 0.18) { this.mx = 0; this.my = 0; }
        knob.style.transform = `translate(${dx}px,${dy}px)`;
      }
      e.preventDefault();
    }, { passive: false });
    const end = (e) => {
      for (const t of e.changedTouches) if (t.identifier === this.id) { this.id = null; this.mx = this.my = 0; base.classList.remove('on'); }
    };
    zone.addEventListener('touchend', end); zone.addEventListener('touchcancel', end);
    document.querySelectorAll('#touch [data-k]').forEach(b => {
      b.addEventListener('touchstart', (e) => {
        audioInit();
        const k = b.dataset.k;
        if (k === 'run') this.run = true; else pressed[k] = true;
        b.classList.add('down'); e.preventDefault();
      }, { passive: false });
      const up = (e) => { if (b.dataset.k === 'run') this.run = false; b.classList.remove('down'); e.preventDefault(); };
      b.addEventListener('touchend', up, { passive: false }); b.addEventListener('touchcancel', up, { passive: false });
    });
  },
  updateLabels() {
    if (!this.on || !P) return;
    this._t = (this._t || 0) + 1; if (this._t % 10) return;
    const f = document.getElementById('tFlask'), it = document.getElementById('tItem');
    if (f) f.textContent = 'FRASCO ' + P.flasks;
    const q = currentQuick();
    if (it) it.textContent = q ? (ITEMS[q].n.split(' ')[0] + ' ' + P.inv[q]).toUpperCase() : 'OBJETO';
  },
};
window.addEventListener('load', () => TOUCH.init());
