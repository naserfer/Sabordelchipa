/* =========================================================
   Stock en kilos (tablas inventario y movimientos_stock)
   - Cada producto puede tener control de stock o no.
   - Entradas (producción), salidas (merma) y correcciones a mano.
   - Las ventas las descuenta la base sola al marcar un pedido
     como «Entregado» (trigger pedidos_antes).
   - Es solo para el panel: el stock NO bloquea la web (casi todo
     se hace a pedido). El interruptor «Se puede pedir» es manual.
   - Gustos hechos (products.opciones_listas): se tildan acá y la
     web los marca con «Hay hecho».
   ========================================================= */
(function () {
  'use strict';
  const P = window.Panel;
  const { $, $$, esc } = P;

  let inv = {};          // product_id → { stock_kg, minimo_kg }
  let movs = [];         // últimos movimientos de todos los productos
  let editingId = null;

  const num = v => Number(v) || 0;
  const fmtKg = kg => (Math.round(num(kg) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + '\u00a0kg';
  const parseKg = s => {
    const t = String(s || '').trim().replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    const n = parseFloat(t);
    return Number.isFinite(n) ? Math.round(n * 1000) / 1000 : NaN;
  };
  const MOTIVO = { produccion: 'Producción', venta: 'Venta', devolucion: 'Vuelve al stock', ajuste: 'Corrección', merma: 'Merma o regalo' };
  // a pedido: estar en 0 kg es lo normal, así que no avisa
  const estadoDe = (r, p) => {
    if (!r) return null;
    const kg = num(r.stock_kg);
    if (p && p.a_pedido) return kg > 0 ? 'ok' : 'pedido';
    return kg <= 0 ? 'out' : kg <= num(r.minimo_kg) ? 'low' : 'ok';
  };
  const ESTADO_TXT = { out: 'Hacer más', low: 'Queda poco', ok: 'En stock', pedido: 'Se hace a pedido' };
  const listasDe = p => (p.opciones_listas || []).filter(o => (p.opciones || []).includes(o));
  const when = iso => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const nameOf = id => (P.productById(id) || {}).nombre || id;

  async function quiet(fn) {
    try { return await fn(); }
    catch (e) { console.warn('[stock]', e.message); if (e.status === 401) location.reload(); return null; }
  }

  /* ---------- datos ---------- */
  async function load() {
    const r = await quiet(() => Promise.all([
      SB.select('inventario', 'select=*'),
      SB.select('movimientos_stock', 'select=*&order=created_at.desc&limit=60')
    ]));
    if (!r) return;
    inv = {}; (r[0] || []).forEach(x => { inv[x.product_id] = x; });
    movs = r[1] || [];
    renderAll();
  }
  function renderAll() { P.renderProducts(); renderResumen(); renderDash(); renderMovs(); }

  /* ---------- en la lista de productos ---------- */
  P.productExtra = p => {
    const r = inv[p.id];
    const listas = listasDe(p);
    const hechos = listas.length ? `<span class="hechos-line">✓ Hechos: ${esc(listas.join(', '))}</span>` : '';
    if (!r) return '<span class="stock-line s-none">Stock sin controlar</span>' + hechos;
    const e = estadoDe(r, p);
    return `<span class="stock-line s-${e}"><i aria-hidden="true"></i>${fmtKg(r.stock_kg)} · ${ESTADO_TXT[e]}</span>` + hechos;
  };

  function lowList() {
    return P.products.filter(p => inv[p.id] && ['out', 'low'].includes(estadoDe(inv[p.id], p)))
      .sort((a, b) => num(inv[a.id].stock_kg) - num(inv[b.id].stock_kg));
  }

  function renderResumen() {
    const box = $('#stockResumen');
    const tracked = P.products.filter(p => inv[p.id]);
    const low = lowList();
    const badge = $('#badgeStock');
    badge.hidden = !low.length; badge.textContent = low.length;
    if (!tracked.length) {
      box.innerHTML = `<div class="callout"><b>Controlá el stock en kilos.</b> Tocá «Stock» en un producto y cargá cuántos kilos tenés.
        Cuando marques un pedido como «Entregado», se descuenta solo. Es solo para vos: la web sigue tomando pedidos aunque esté en 0.</div>`;
      return;
    }
    const total = tracked.reduce((a, p) => a + Math.max(0, num(inv[p.id].stock_kg)), 0);
    box.innerHTML = `<div class="stock-sum">
      <div><span class="muted small">En el freezer</span><b>${fmtKg(total)}</b></div>
      <div><span class="muted small">Con control</span><b>${tracked.length} de ${P.products.length}</b></div>
      <div class="${low.length ? 'is-warn' : ''}"><span class="muted small">Para reponer</span><b>${low.length ? (low.length === 1 ? '1 producto' : low.length + ' productos') : 'Ninguno ✓'}</b></div>
    </div>`;
  }

  function renderDash() {
    const box = $('#dashStock'); if (!box) return;
    const tracked = P.products.filter(p => inv[p.id]);
    if (!tracked.length) {
      box.innerHTML = `<p class="empty">Todavía no controlás el stock de ningún producto. <a href="#productos">Empezá acá →</a></p>`;
      return;
    }
    const low = lowList();
    if (!low.length) { box.innerHTML = `<p class="ok-line">✓ Todo con stock. ${tracked.length === 1 ? '1 producto controlado' : tracked.length + ' productos controlados'}.</p>`; return; }
    box.innerHTML = `<ul class="mini-list">${low.map(p => {
      const e = estadoDe(inv[p.id], p);
      return `<li><button type="button" class="linkish" data-stock-id="${esc(p.id)}">
        <span>${esc(p.nombre)}</span><span class="stock-line s-${e}"><i aria-hidden="true"></i>${fmtKg(inv[p.id].stock_kg)} · ${ESTADO_TXT[e]}</span></button></li>`;
    }).join('')}</ul>
    <p class="muted small">Es solo para vos: en la web se puede seguir pidiendo.</p>`;
  }

  function movHtml(m, withName) {
    const d = num(m.delta);
    return `<li>
      <div><b>${withName ? esc(nameOf(m.product_id)) : esc(MOTIVO[m.motivo] || m.motivo)}</b>
        <span class="muted small">${withName ? esc(MOTIVO[m.motivo] || m.motivo) + ' · ' : ''}${esc(when(m.created_at))}${m.nota ? ' · ' + esc(m.nota) : ''}</span></div>
      <b class="delta ${d > 0 ? 'pos' : 'neg'}">${d > 0 ? '+' : '−'}${fmtKg(Math.abs(d))}</b>
    </li>`;
  }
  function renderMovs() {
    $('#movsAll').innerHTML = movs.length ? movs.slice(0, 40).map(m => movHtml(m, true)).join('') : '<li class="empty">Todavía no hay movimientos.</li>';
  }

  /* ---------- hoja de stock ---------- */
  const form = $('#stockEdit');
  const sheet = $('#stockSheet');
  function tipo() { return (form.querySelector('[name=tipo]:checked') || {}).value || 'produccion'; }
  function syncTipo() {
    const r = inv[editingId];
    const t = r ? tipo() : 'ajuste';
    $('#sQtyLabel').textContent = !r ? '¿Cuántos kilos tenés ahora?' : t === 'produccion' ? 'Kilos que entran' : t === 'merma' ? 'Kilos que salen' : '¿Cuántos kilos hay ahora?';
    $('#sSave').textContent = !r ? 'Empezar a controlar' : t === 'ajuste' ? 'Corregir stock' : t === 'merma' ? 'Restar del stock' : 'Sumar al stock';
  }
  function renderSheet() {
    const p = P.productById(editingId); if (!p) return;
    const r = inv[editingId];
    $('#sTitle').textContent = p.nombre;
    $('#sSub').textContent = p.a_pedido ? 'Se hace a pedido' : 'Stock en kilos';
    renderListas(p);
    $('#sTipos').hidden = !r;
    $('#sConfBox').hidden = !r;
    $('#sMoveLegend').textContent = r ? 'Cargar movimiento' : 'Empezar a controlar el stock';
    if (r) {
      const e = estadoDe(r, p), kg = num(r.stock_kg);
      $('#sNow').innerHTML = `<b class="big">${fmtKg(kg)}</b>
        <span class="stock-line s-${e}"><i aria-hidden="true"></i>${ESTADO_TXT[e]}</span>
        <span class="muted small">${kg > 0 ? '≈ ' + Math.floor(kg / 0.5 + 1e-9) + ' bolsas de ½ kg · ' : ''}${p.a_pedido ? 'a pedido: no avisa' : 'aviso con menos de ' + fmtKg(r.minimo_kg)}</span>`;
      form.minimo.value = String(num(r.minimo_kg)).replace('.', ',');
    } else {
      $('#sNow').innerHTML = `<p class="muted">Este producto todavía no tiene control de stock. Cargá cuántos kilos tenés y desde ahí:</p>
        <ul class="bullets"><li>al marcar un pedido como <b>Entregado</b> se descuenta solo;</li><li>si queda poco, te avisa en el Inicio;</li><li>es solo para vos: <b>la web no se bloquea</b>, aunque esté en 0 se puede seguir pidiendo.</li></ul>`;
    }
    syncTipo();
  }
  /* ---------- gustos hechos (products.opciones_listas) ---------- */
  function renderListas(p) {
    const ops = p.opciones || [];
    const on = new Set(listasDe(p));
    $('#sListasBox').hidden = !ops.length;
    $('#sListas').innerHTML = ops.map(o => `<label class="check"><input type="checkbox" data-lista value="${esc(o)}"${on.has(o) ? ' checked' : ''}> ${esc(o)}</label>`).join('');
  }
  $('#sListas').addEventListener('change', async e => {
    const box = e.target.closest('[data-lista]'); if (!box) return;
    const id = editingId, p = P.productById(id); if (!p) return;
    const listas = $$('[data-lista]:checked', $('#sListas')).map(i => i.value);
    try {
      await P.guard(() => SB.update('products', 'id=eq.' + encodeURIComponent(id), { opciones_listas: listas }),
        box.checked ? `${box.value}: hay hecho ✓` : `${box.value}: a pedido`);
      p.opciones_listas = listas;
      P.renderProducts();
    } catch (_) { if (editingId === id) renderListas(p); }
  });

  async function open(id) {
    editingId = id;
    form.reset();
    renderSheet();
    $('#sHist').innerHTML = '<li class="muted small">Cargando…</li>';
    P.openSheet(sheet);
    // con gustos, lo primero que se ve son los gustos hechos (sin saltar al campo de kilos)
    if (!((P.productById(id) || {}).opciones || []).length) setTimeout(() => form.kg.focus(), 80);
    const h = await quiet(() => SB.select('movimientos_stock', `select=*&product_id=eq.${encodeURIComponent(id)}&order=created_at.desc&limit=50`));
    if (editingId === id) $('#sHist').innerHTML = h && h.length ? h.map(m => movHtml(m, false)).join('') : '<li class="empty">Sin movimientos todavía.</li>';
  }

  $('#sTipos').addEventListener('change', syncTipo);
  $('#sQuick').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    form.kg.value = b.dataset.q.replace('.', ',');
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const id = editingId, r = inv[id];
    const kg = parseKg(form.kg.value);
    if (!Number.isFinite(kg) || kg < 0 || kg > 100000) return P.toast('Poné los kilos con números. Ej.: 2,5', true);
    const t = r ? tipo() : 'ajuste';
    const actual = r ? num(r.stock_kg) : 0;
    let delta = t === 'produccion' ? kg : t === 'merma' ? -kg : Math.round((kg - actual) * 1000) / 1000;
    if (t !== 'ajuste' && kg === 0) return P.toast('Poné cuántos kilos.', true);
    const nota = form.nota.value.trim();
    try {
      await P.guard(async () => {
        if (delta !== 0) await SB.insert('movimientos_stock', { product_id: id, delta, motivo: t, nota });
        else if (!r) await SB.insert('inventario', { product_id: id, stock_kg: 0 });
        else throw new Error('El stock ya estaba en ' + fmtKg(actual) + '.');
      });
      await load();
      P.toast(`Stock de ${nameOf(id)}: ${fmtKg(inv[id] ? inv[id].stock_kg : 0)} ✓`);
      if (editingId === id) { form.kg.value = ''; form.nota.value = ''; renderSheet(); open(id); }
    } catch (_) { /* el toast ya avisó */ }
  });

  $('#sSaveMin').addEventListener('click', async () => {
    const v = parseKg(form.minimo.value);
    if (!Number.isFinite(v) || v < 0) return P.toast('Poné un número de kilos. Ej.: 1', true);
    try {
      await P.guard(() => SB.update('inventario', 'product_id=eq.' + encodeURIComponent(editingId), { minimo_kg: v }), 'Aviso guardado ✓');
      await load(); renderSheet();
    } catch (_) {}
  });
  $('#sStop').addEventListener('click', async () => {
    const p = P.productById(editingId);
    if (!confirm(`¿Dejar de controlar el stock de «${p ? p.nombre : ''}»? El historial queda guardado.`)) return;
    try {
      await P.guard(() => SB.remove('inventario', 'product_id=eq.' + encodeURIComponent(editingId)), 'Listo, sin control de stock');
      await load(); P.closeSheet(sheet);
    } catch (_) {}
  });

  // botones «Stock» de la lista de productos y del inicio
  $('#plist').addEventListener('click', e => {
    const b = e.target.closest('[data-stock-open]'); if (!b) return;
    open(b.closest('.pitem').dataset.id);
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-stock-id]'); if (!b) return;
    open(b.dataset.stockId);
  });

  P.on('ready', load);
  P.on('refresh', load);
  P.on('products', () => { renderResumen(); renderDash(); });

  window.Stock = { load, open, invOf: id => inv[id], fmtKg, lowList, reload: load };
})();
