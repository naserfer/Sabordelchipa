/* =========================================================
   Gráficos del panel (SVG a mano, sin librerías)
   - columns(): columnas por día u hora, con tooltip al tocar/pasar
   - hbars(): barras horizontales con el valor al costado
   - kpis(): tarjetas de números
   ========================================================= */
(function () {
  'use strict';
  const P = window.Panel;
  const { esc } = P;
  const tip = document.getElementById('chartTip');
  const NS = 'http://www.w3.org/2000/svg';

  /* ---------- tooltip (texto con textContent, nunca innerHTML) ---------- */
  function tipShow(rect, value, label) {
    tip.replaceChildren();
    const b = document.createElement('b'); b.textContent = value;
    const s = document.createElement('span'); s.textContent = label;
    tip.append(b, s);
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    const x = Math.min(innerWidth - w - 8, Math.max(8, rect.left + rect.width / 2 - w / 2));
    const y = rect.top - h - 8 < 8 ? rect.bottom + 8 : rect.top - h - 8;
    tip.style.left = x + 'px'; tip.style.top = y + 'px';
  }
  function tipHide() { tip.hidden = true; }
  addEventListener('scroll', tipHide, { passive: true });

  /* ---------- escalas ---------- */
  function niceMax(v, integer) {
    if (!(v > 0)) return integer ? 2 : 1;
    const e = Math.pow(10, Math.floor(Math.log10(v)));
    const f = v / e;
    let m = (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e;
    if (integer) { m = Math.max(2, m); if (m / 2 !== Math.round(m / 2)) m = Math.ceil(v / 2) * 2; }
    return m;
  }
  const el = (tag, attrs) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); return n; };

  /* ---------- columnas ----------
     data: [{ axis: 'lun', label: 'lunes 28 de septiembre', value: 3, display: '3 personas' }]
     opts: { height, integer, fmt (ticks), empty }                                  */
  const drawn = new WeakMap();
  function columns(box, data, opts = {}) {
    drawn.set(box, [data, opts]);
    observe(box);
    const W = Math.max(240, Math.floor(box.clientWidth || 300));
    const H = opts.height || 170;
    const fmt = opts.fmt || (v => v.toLocaleString('es-AR'));
    const total = data.reduce((a, d) => a + d.value, 0);
    box.classList.toggle('is-empty', !total);
    if (!data.length) { box.innerHTML = `<p class="empty">${esc(opts.empty || 'Todavía no hay datos.')}</p>`; return; }
    const max = niceMax(Math.max(...data.map(d => d.value)), opts.integer);
    const ticks = [0, max / 2, max];
    const padL = Math.max(26, 8 + Math.max(...ticks.map(t => fmt(t).length)) * 6.6), padR = 6, padT = 10, padB = 22;
    const iw = W - padL - padR, ih = H - padT - padB;
    const n = data.length, band = iw / n;
    const bw = Math.max(2, Math.min(24, band - 2));
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, width: W, height: H, class: 'cols', role: 'img',
      'aria-label': (opts.title || 'Gráfico') + '. Total: ' + fmt(total) });
    // grilla y eje Y
    ticks.forEach(t => {
      const y = padT + ih - (t / max) * ih;
      svg.append(el('line', { x1: padL, x2: W - padR, y1: y, y2: y, class: t ? 'grid' : 'base' }));
      const tx = el('text', { x: padL - 6, y: y + 4, 'text-anchor': 'end', class: 'tick' }); tx.textContent = fmt(t); svg.append(tx);
    });
    // etiquetas del eje X sin que se encimen
    const every = Math.max(1, Math.ceil(36 / band));
    data.forEach((d, i) => {
      const x = padL + i * band + (band - bw) / 2;
      const h = max ? (d.value / max) * ih : 0;
      const y = padT + ih - h;
      if (h > 0.5) {
        const r = Math.min(4, bw / 2, h);
        svg.append(el('path', { class: 'bar', d: `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + bw - r}Q${x + bw},${y} ${x + bw},${y + r}V${y + h}Z` }));
      }
      if ((opts.anchor === 'start' ? i : n - 1 - i) % every === 0) {
        const tx = el('text', { x: x + bw / 2, y: H - 6, 'text-anchor': 'middle', class: 'tick' }); tx.textContent = d.axis; svg.append(tx);
      }
      const hit = el('rect', { x: padL + i * band, y: padT, width: band, height: ih, class: 'hit', 'data-i': i });
      if (n <= 31) { hit.setAttribute('tabindex', '0'); hit.setAttribute('aria-label', `${d.label}: ${d.display || fmt(d.value)}`); }
      svg.append(hit);
    });
    const show = e => {
      const r = e.target.closest('.hit'); if (!r) return;
      const d = data[+r.dataset.i];
      svg.querySelectorAll('.hit.on').forEach(x => x.classList.remove('on')); r.classList.add('on');
      tipShow(r.getBoundingClientRect(), d.display || fmt(d.value), d.label);
    };
    const hide = () => { svg.querySelectorAll('.hit.on').forEach(x => x.classList.remove('on')); tipHide(); };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', hide);
    svg.addEventListener('focusin', show);
    svg.addEventListener('focusout', hide);
    box.replaceChildren(svg);
  }
  // redibujar al cambiar el ancho
  const ro = 'ResizeObserver' in window ? new ResizeObserver(es => es.forEach(en => {
    const args = drawn.get(en.target); if (!args) return;
    const w = Math.floor(en.contentRect.width);
    if (w && w !== en.target._w) { en.target._w = w; columns(en.target, ...args); }
  })) : null;
  function observe(box) { if (ro && !box._obs) { box._obs = true; box._w = Math.floor(box.clientWidth); ro.observe(box); } }

  /* ---------- barras horizontales ----------
     rows: [{ label, value, display, sub }] */
  function hbars(box, rows, opts = {}) {
    const max = Math.max(1, ...rows.map(r => r.value));
    box.innerHTML = rows.length && rows.some(r => r.value > 0)
      ? `<ul class="hbars">${rows.map(r => `<li>
          <div class="hb-top"><span class="hb-label">${esc(r.label)}</span><b class="hb-val">${esc(r.display != null ? r.display : r.value.toLocaleString('es-AR'))}</b></div>
          <div class="hb-track"><i style="width:${r.value > 0 ? Math.max(1.5, r.value / max * 100).toFixed(1) : 0}%"></i></div>
          ${r.sub ? `<small class="muted">${esc(r.sub)}</small>` : ''}</li>`).join('')}</ul>`
      : `<p class="empty">${esc(opts.empty || 'Todavía no hay datos.')}</p>`;
  }

  /* ---------- tarjetas de números ----------
     items: [{ label, value, sub, tone: 'up'|'down'|'warn'|'', href }] */
  function kpis(box, items) {
    box.innerHTML = items.map(k => {
      const tag = k.href ? 'a' : 'div';
      return `<${tag} class="kpi${k.tone ? ' kpi-' + k.tone : ''}"${k.href ? ` href="${esc(k.href)}"` : ''}>
        <span class="kpi-label">${esc(k.label)}</span>
        <b class="kpi-value">${esc(k.value)}</b>
        ${k.sub ? `<span class="kpi-sub">${esc(k.sub)}</span>` : ''}
      </${tag}>`;
    }).join('');
  }

  window.Charts = { columns, hbars, kpis, niceMax };
})();
