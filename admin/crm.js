/* =========================================================
   CRM del panel: Inicio, Pedidos y Clientes
   Tablas: clientes, pedidos (ver supabase/migrations/20261004_crm.sql)
   - Los pedidos de la web entran solos (crear_pedido_web).
   - Al pasar un pedido a «Entregado» la base descuenta el stock.
   ========================================================= */
(function () {
  'use strict';
  const P = window.Panel, C = window.Charts;
  const { $, $$, esc, money, digits } = P;

  let clientes = [], pedidos = [];
  let cById = new Map(), stats = new Map();
  let visitas14 = null;   // estadísticas de visitas para el inicio
  let loaded = false;
  let fEstado = 'activos', qPed = '', pageP = 1;
  let fCli = 'todos', qCli = '', sCli = 'ultimo', pageC = 1;
  const PAGE = 40;

  /* ---------- utilidades ---------- */
  const TZ = 'America/Argentina/Buenos_Aires';
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const dayKey = d => new Date(d).toLocaleDateString('en-CA', { timeZone: TZ });
  const todayKey = () => dayKey(Date.now());
  const addDays = (key, n) => { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const daysBetween = (a, b) => Math.round((new Date(b + 'T12:00:00Z') - new Date(a + 'T12:00:00Z')) / 864e5);
  const keyDate = (k, o) => new Date(k + 'T12:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC', ...o });
  const hora = iso => new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
  const fechaCorta = iso => new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', timeZone: TZ });
  function relDay(iso) {
    const k = dayKey(iso), n = daysBetween(k, todayKey());
    if (n === 0) return 'Hoy'; if (n === 1) return 'Ayer';
    const s = keyDate(k, { weekday: 'long', day: 'numeric', month: 'long' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
  function ago(iso) {
    if (!iso) return '—';
    const s = (Date.now() - new Date(iso)) / 1000;
    if (s < 60) return 'recién'; if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
    const d = daysBetween(dayKey(iso), todayKey());
    if (d === 0) return `hace ${Math.floor(s / 3600)} h`; if (d === 1) return 'ayer';
    if (d < 30) return `hace ${d} días`;
    if (d < 365) { const m = Math.floor(d / 30); return `hace ${m} ${m === 1 ? 'mes' : 'meses'}`; }
    const y = Math.floor(d / 365); return `hace ${y} ${y === 1 ? 'año' : 'años'}`;
  }
  const kgTxt = kg => (Math.round((Number(kg) || 0) * 100) / 100).toLocaleString('es-AR', { maximumFractionDigits: 2 }) + '\u00a0kg';
  const moneyShort = v => v >= 1e6 ? '$' + (v / 1e6).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' M' : v >= 1e3 ? '$' + Math.round(v / 1e3).toLocaleString('es-AR') + ' mil' : '$' + v;
  const sizeTxt = s => (s === 'kilo' ? '1 kg' : '½ kg');
  const kgOf = it => (it.size === 'kilo' ? 1 : 0.5) * (Number(it.qty) || 1);
  const priceOf = (p, size) => (p ? (size === 'kilo' ? p.precio_kilo : p.precio_medio) : null);
  const corto = n => { const t = String(n).replace(/^Chipá\s+/i, '').replace(/\s+de chipá$/i, ''); return t.charAt(0).toUpperCase() + t.slice(1); };
  const initials = n => String(n || '?').trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0)).join('').toUpperCase() || '?';
  function waNum(tel) {
    let d = digits(tel); if (!d) return '';
    if (d.startsWith('54')) return d;
    if (d.startsWith('0')) d = d.slice(1);
    const m = d.match(/^(11)15(\d{8})$/); if (m) d = m[1] + m[2];
    return d.length === 10 ? '549' + d : d;
  }
  const telTxt = t => { const d = digits(t); return d.length === 10 ? `${d.slice(0, 2)} ${d.slice(2, 6)}-${d.slice(6)}` : d; };
  const newCode = () => Date.now().toString(36).slice(-4).toUpperCase();

  const EST = { nuevo: 'Nuevo', confirmado: 'Confirmado', entregado: 'Entregado', cancelado: 'Cancelado' };
  const cuenta = o => o.estado === 'confirmado' || o.estado === 'entregado';
  const nombreDe = o => (o.cliente_id && cById.get(o.cliente_id) ? cById.get(o.cliente_id).nombre : o.cliente_nombre) || 'Sin nombre';
  const itemTxt = it => `${it.qty || 1} × ${it.product_id === 'mix' ? 'Mix ½ kg' : `${it.nombre || (P.productById(it.product_id) || {}).nombre || it.product_id} ${sizeTxt(it.size)}`}${it.opt ? ' (' + it.opt + ')' : ''}`;

  async function quiet(fn) {
    try { return await fn(); }
    catch (e) { console.warn('[crm]', e.message); if (e.status === 401) location.reload(); return null; }
  }

  /* ---------- datos ---------- */
  async function load() {
    const r = await quiet(() => Promise.all([
      SB.select('clientes', 'select=*&order=created_at.desc&limit=5000'),
      SB.select('pedidos', 'select=*&order=created_at.desc&limit=3000')
    ]));
    if (!r) {
      $('#olist').innerHTML = $('#clist').innerHTML = '<li class="empty">No se pudieron cargar los datos. Revisá la conexión y tocá ↻.</li>';
      return;
    }
    [clientes, pedidos] = [r[0] || [], r[1] || []];
    loaded = true;
    index(); renderAll();
    loadVisitas();
  }
  async function loadVisitas() {
    const hoy = todayKey();
    const v = await quiet(() => SB.rpc('estadisticas_visitas', { p_desde: addDays(hoy, -13), p_hasta: hoy }));
    visitas14 = v || null;
    renderDash();
  }
  function index() {
    cById = new Map(clientes.map(c => [c.id, c]));
    stats = new Map();
    for (const o of pedidos) {
      if (!o.cliente_id || o.estado === 'cancelado') continue;
      let s = stats.get(o.cliente_id);
      if (!s) stats.set(o.cliente_id, s = { n: 0, compras: 0, gastado: 0, ultimo: null, prods: {} });
      s.n++;
      if (cuenta(o)) { s.compras++; s.gastado += o.total || 0; }
      if (!s.ultimo || o.created_at > s.ultimo) s.ultimo = o.created_at;
      for (const it of o.items || []) {
        const k = it.product_id === 'mix' ? 'Mix' : (it.nombre || it.product_id);
        s.prods[k] = (s.prods[k] || 0) + kgOf(it);
      }
    }
    const nuevos = pedidos.filter(o => o.estado === 'nuevo').length;
    const b = $('#badgePedidos'); b.hidden = !nuevos; b.textContent = nuevos;
    document.title = (nuevos ? `(${nuevos}) ` : '') + 'Panel · Sabor del Chipá';
  }
  const statOf = id => stats.get(id) || { n: 0, compras: 0, gastado: 0, ultimo: null, prods: {} };
  function renderAll() { renderDash(); renderPedidos(); renderClientes(); }
  function replaceOrder(o) {
    const i = pedidos.findIndex(x => x.id === o.id);
    if (i >= 0) pedidos[i] = o; else pedidos.unshift(o);
    pedidos.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  }
  // si un pedido entra o sale de «Entregado», la base mueve el stock y puede cambiar «Hay stock»
  async function afterStockChange(before, after) {
    if ((before && before.estado === 'entregado') || (after && after.estado === 'entregado')) {
      if (window.Stock) await Stock.load();
      await P.reloadProducts().catch(() => {});
    }
  }

  /* =========================================================
     INICIO
     ========================================================= */
  function renderDash() {
    if (!loaded) return;
    const h = new Date().toLocaleString('en-US', { hour: 'numeric', hour12: false, timeZone: TZ }) | 0;
    $('#hola').textContent = h >= 5 && h < 13 ? '¡Buen día!' : h >= 13 && h < 20 ? '¡Buenas tardes!' : '¡Buenas noches!';
    const hoyTxt = new Date().toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ });
    $('#hoyFecha').textContent = hoyTxt.charAt(0).toUpperCase() + hoyTxt.slice(1);

    const hoy = todayKey(), mes = hoy.slice(0, 7);
    const delMes = pedidos.filter(o => cuenta(o) && dayKey(o.created_at).slice(0, 7) === mes);
    const ventasMes = delMes.reduce((a, o) => a + (o.total || 0), 0);
    const nuevos = pedidos.filter(o => o.estado === 'nuevo');
    const confirmados = pedidos.filter(o => o.estado === 'confirmado');
    const cliMes = clientes.filter(c => dayKey(c.created_at).slice(0, 7) === mes).length;
    const serie = visitas14 && visitas14.serie || [];
    const vHoy = serie.length ? serie[serie.length - 1].personas : null, vAyer = serie.length > 1 ? serie[serie.length - 2].personas : null;
    C.kpis($('#kpis'), [
      { label: 'Personas hoy en la web', value: vHoy == null ? '—' : vHoy.toLocaleString('es-AR'), sub: vAyer == null ? 'Contador sin datos todavía' : `Ayer: ${vAyer.toLocaleString('es-AR')}`, href: '#visitas' },
      { label: 'Pedidos por confirmar', value: String(nuevos.length), sub: confirmados.length ? `${confirmados.length} para entregar` : 'Nada para entregar', tone: nuevos.length ? 'warn' : '', href: '#pedidos' },
      { label: 'Ventas del mes', value: money(ventasMes), sub: delMes.length ? `${delMes.length} ${delMes.length === 1 ? 'pedido' : 'pedidos'} · ticket ${money(Math.round(ventasMes / delMes.length))}` : 'Sin pedidos confirmados aún' },
      { label: 'Clientes', value: clientes.length.toLocaleString('es-AR'), sub: cliMes ? `+${cliMes} este mes` : 'Ninguno nuevo este mes', href: '#clientes' }
    ]);

    // para hacer
    const sinCobrar = pedidos.filter(o => o.estado === 'entregado' && !o.pagado);
    const cumples = clientes.filter(c => c.cumple && (() => {
      for (let i = 0; i <= 7; i++) if (addDays(hoy, i).slice(5) === c.cumple.slice(5)) return true; return false;
    })());
    const parts = [];
    if (nuevos.length) parts.push(`<h4>Confirmar (${nuevos.length})</h4><ul class="mini-list">${nuevos.slice(0, 5).map(o => miniOrder(o, 'confirmado', 'Confirmar')).join('')}</ul>`);
    if (confirmados.length) {
      const orden = [...confirmados].sort((a, b) => String(a.fecha_entrega || '9').localeCompare(String(b.fecha_entrega || '9')));
      parts.push(`<h4>Entregar (${confirmados.length})</h4><ul class="mini-list">${orden.slice(0, 5).map(o => miniOrder(o, 'entregado', 'Entregado ✓')).join('')}</ul>`);
    }
    if (sinCobrar.length) parts.push(`<h4>Cobrar</h4><p class="small"><a href="#pedidos" data-filtro="cobrar">${sinCobrar.length} ${sinCobrar.length === 1 ? 'pedido entregado' : 'pedidos entregados'} sin cobrar · ${money(sinCobrar.reduce((a, o) => a + (o.total || 0), 0))}</a></p>`);
    if (cumples.length) parts.push(`<h4>Cumpleaños esta semana 🎂</h4><ul class="mini-list">${cumples.map(c => `<li><button type="button" class="linkish" data-open-client="${esc(c.id)}"><span>${esc(c.nombre)}</span><span class="muted small">${esc(keyDate(hoy.slice(0, 4) + c.cumple.slice(4), { day: 'numeric', month: 'long' }))}</span></button></li>`).join('')}</ul>`);
    $('#tareas').innerHTML = parts.join('') || '<p class="ok-line">✓ Todo al día. No hay pedidos pendientes.</p>';

    // ventas 30 días
    const dias = [...Array(30)].map((_, i) => addDays(hoy, i - 29));
    const porDia = {}; dias.forEach(d => { porDia[d] = { v: 0, n: 0 }; });
    pedidos.forEach(o => { if (!cuenta(o)) return; const k = dayKey(o.created_at); if (porDia[k]) { porDia[k].v += o.total || 0; porDia[k].n++; } });
    const tot30 = dias.reduce((a, d) => a + porDia[d].v, 0);
    $('#ventas30Total').textContent = 'Total: ' + money(tot30);
    C.columns($('#chartVentas'), dias.map(d => ({
      axis: keyDate(d, { day: 'numeric' }), label: keyDate(d, { weekday: 'long', day: 'numeric', month: 'long' }),
      value: porDia[d].v, display: `${money(porDia[d].v)} · ${porDia[d].n} ${porDia[d].n === 1 ? 'pedido' : 'pedidos'}`
    })), { fmt: moneyShort, title: 'Ventas por día', height: 180 });

    // más vendido (kg, 30 días)
    const desde = addDays(hoy, -29), kg = {};
    pedidos.forEach(o => {
      if (!cuenta(o) || dayKey(o.created_at) < desde) return;
      (o.items || []).forEach(it => {
        if (it.product_id === 'mix' && Array.isArray(it.mix) && it.mix.length) it.mix.forEach(id => { const n = (P.productById(id) || {}).nombre || id; kg[n] = (kg[n] || 0) + kgOf(it) / it.mix.length; });
        else { const n = it.product_id === 'mix' ? 'Mix' : (it.nombre || it.product_id); kg[n] = (kg[n] || 0) + kgOf(it); }
      });
    });
    C.hbars($('#topProductos'), Object.entries(kg).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([k, v]) => ({ label: k, value: v, display: kgTxt(v) })),
      { empty: 'Cuando confirmes pedidos, acá vas a ver qué se vende más.' });

    // visitas 14 días
    if (visitas14) {
      C.columns($('#chartVisitasMini'), serie.map(d => ({
        axis: keyDate(d.t, { day: 'numeric' }), label: keyDate(d.t, { weekday: 'long', day: 'numeric', month: 'long' }),
        value: d.personas, display: `${d.personas} ${d.personas === 1 ? 'persona' : 'personas'}`
      })), { integer: true, title: 'Personas por día', height: 150 });
    } else {
      $('#chartVisitasMini').innerHTML = '<p class="empty">El contador de visitas se activa cuando la base termina de configurarse.</p>';
    }

    // clientes
    const conCompras = clientes.filter(c => statOf(c.id).compras > 0);
    const repiten = conCompras.filter(c => statOf(c.id).compras > 1).length;
    const reactivar = clientes.filter(c => { const s = statOf(c.id); return s.ultimo && daysBetween(dayKey(s.ultimo), hoy) > 45; }).length;
    $('#dashClientes').innerHTML = `<div class="mini-kpis">
      <a href="#clientes" data-segmento="nuevos"><b>${cliMes}</b><span>nuevos este mes</span></a>
      <a href="#clientes" data-segmento="frecuentes"><b>${conCompras.length ? Math.round(repiten / conCompras.length * 100) + '%' : '—'}</b><span>volvieron a comprar</span></a>
      <a href="#clientes" data-segmento="reactivar"><b>${reactivar}</b><span>hace más de 45 días que no piden</span></a>
    </div>`;
  }
  function miniOrder(o, next, label) {
    return `<li><button type="button" class="linkish" data-open-order="${esc(o.id)}"><span><b>${esc(nombreDe(o))}</b> <span class="muted small">#${esc(o.codigo)} · ${esc(o.entrega || ago(o.created_at))}</span></span><span class="small">${money(o.total)}</span></button>
      <button type="button" class="btn btn-xs btn-primary" data-next="${esc(o.id)}" data-to="${next}">${label}</button></li>`;
  }

  /* =========================================================
     PEDIDOS
     ========================================================= */
  const FILTROS = [
    ['activos', 'Activos', o => o.estado === 'nuevo' || o.estado === 'confirmado'],
    ['nuevo', 'Nuevos', o => o.estado === 'nuevo'],
    ['confirmado', 'Confirmados', o => o.estado === 'confirmado'],
    ['entregado', 'Entregados', o => o.estado === 'entregado'],
    ['cobrar', 'Sin cobrar', o => o.estado === 'entregado' && !o.pagado],
    ['cancelado', 'Cancelados', o => o.estado === 'cancelado'],
    ['todos', 'Todos', () => true]
  ];
  function pedidosFiltrados() {
    const f = (FILTROS.find(x => x[0] === fEstado) || FILTROS[0])[2];
    const q = norm(qPed.trim());
    return pedidos.filter(o => f(o) && (!q || norm([o.codigo, nombreDe(o), o.cliente_tel, o.direccion, o.notas, o.entrega, ...(o.items || []).map(itemTxt)].join(' ')).includes(q)));
  }
  function renderPedidos() {
    if (!loaded) return;
    $('#fPedidos').innerHTML = FILTROS.map(([k, label, f]) => {
      const n = pedidos.filter(f).length;
      return `<button type="button" data-f="${k}" aria-pressed="${k === fEstado}">${label}${k !== 'todos' ? ` <small>${n}</small>` : ''}</button>`;
    }).join('');
    const list = pedidosFiltrados();
    const shown = list.slice(0, pageP * PAGE);
    let last = '';
    $('#olist').innerHTML = shown.map(o => {
      const d = relDay(o.created_at); const head = d !== last ? `<li class="ogroup">${esc(d)}</li>` : ''; last = d;
      return head + orderRow(o);
    }).join('') || `<li class="empty">${pedidos.length ? 'No hay pedidos con este filtro.' : 'Todavía no hay pedidos. Cuando alguien toque «Enviar pedido por WhatsApp» en la web, aparece acá.'}</li>`;
    $('#morePedidos').hidden = list.length <= shown.length;
  }
  function orderRow(o) {
    const next = o.estado === 'nuevo' ? ['confirmado', 'Confirmar'] : o.estado === 'confirmado' ? ['entregado', 'Entregado ✓'] : o.estado === 'entregado' && !o.pagado ? ['pagado', 'Cobrado ✓'] : null;
    const items = (o.items || []).map(itemTxt);
    return `<li class="oitem e-${o.estado}">
      <button type="button" class="o-main" data-open-order="${esc(o.id)}">
        <span class="o-top"><b>${esc(nombreDe(o))}</b><span class="o-code">#${esc(o.codigo)}</span>${o.origen === 'web' ? '<span class="tag-web">Web</span>' : ''}</span>
        <span class="o-items">${esc(items.slice(0, 3).join(' · '))}${items.length > 3 ? ` <span class="muted">+${items.length - 3}</span>` : ''}</span>
        <span class="o-meta">${esc(hora(o.created_at))}${o.entrega ? ' · ' + esc(o.entrega) : ''}${o.fecha_entrega ? ' · ' + esc(keyDate(o.fecha_entrega, { weekday: 'short', day: 'numeric', month: 'short' })) : ''} · ${kgTxt(o.kg)}</span>
      </button>
      <div class="o-side">
        <b class="o-total">${money(o.total)}${o.precio_pendiente ? '<small>+ a confirmar</small>' : ''}</b>
        <span class="pills"><span class="pill p-${o.estado}">${EST[o.estado]}</span>${o.pagado ? '<span class="pill p-pagado">Cobrado</span>' : o.estado === 'entregado' ? '<span class="pill p-debe">Sin cobrar</span>' : ''}</span>
        ${next ? `<button type="button" class="btn btn-xs ${next[0] === 'pagado' ? 'btn-ghost' : 'btn-primary'}" data-next="${esc(o.id)}" data-to="${next[0]}">${next[1]}</button>` : ''}
      </div>
    </li>`;
  }
  $('#fPedidos').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; fEstado = b.dataset.f; pageP = 1; renderPedidos(); });
  $('#qPedidos').addEventListener('input', e => { qPed = e.target.value; pageP = 1; renderPedidos(); });
  $('#morePedidos').addEventListener('click', () => { pageP++; renderPedidos(); });

  // avance rápido de estado (desde la lista o el inicio)
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-next]'); if (!b) return;
    const o = pedidos.find(x => x.id === b.dataset.next); if (!o) return;
    const patch = b.dataset.to === 'pagado' ? { pagado: true } : { estado: b.dataset.to };
    const msg = b.dataset.to === 'pagado' ? 'Marcado como cobrado ✓' : b.dataset.to === 'entregado' ? 'Entregado ✓' : 'Pedido confirmado ✓';
    try {
      const r = await P.guard(() => SB.update('pedidos', 'id=eq.' + encodeURIComponent(o.id), patch), msg);
      if (r && r[0]) replaceOrder(r[0]);
      index(); renderAll(); refreshClientSheet();
      await afterStockChange(o, r && r[0]);
    } catch (_) {}
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open-order]'); if (!b) return;
    const o = pedidos.find(x => x.id === b.dataset.openOrder); if (o) openOrder(o);
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-filtro]'); if (a) { fEstado = a.dataset.filtro; pageP = 1; renderPedidos(); }
    const s = e.target.closest('[data-segmento]'); if (s) { fCli = s.dataset.segmento; pageC = 1; renderClientes(); }
  });
  $$('[data-new-order]').forEach(b => b.addEventListener('click', () => openOrder(null)));

  /* ---------- hoja del pedido ---------- */
  const oSheet = $('#orderSheet'), of = $('#orderEdit');
  let ord = null, items = [], linkedId = null, totalManual = false;

  function blankItem() {
    const p = P.products.find(x => x.disponible) || P.products[0];
    return p ? { product_id: p.id, nombre: p.nombre, size: 'medio', opt: (p.opciones || [])[0] || '', qty: 1, unit: priceOf(p, 'medio') } : { product_id: '', nombre: '', size: 'medio', opt: '', qty: 1, unit: null };
  }
  const subtotal = () => items.reduce((a, it) => a + (it.unit == null ? 0 : it.unit * (Number(it.qty) || 1)), 0);
  const pendiente = () => items.some(it => it.unit == null);

  function openOrder(o, preset) {
    ord = o || null;
    const v = o ? o : { estado: 'nuevo', items: [], envio: 0, total: 0, pago: 'Transferencia', pagado: false, entrega: '', fecha_entrega: null, notas: '', cliente_id: null, cliente_nombre: '', cliente_tel: '', direccion: '', ...(preset || {}) };
    of.reset(); $('#oError').hidden = true;
    items = JSON.parse(JSON.stringify(v.items || []));
    if (!items.length) items.push(blankItem());
    linkedId = v.cliente_id || null;
    of.estado.value = v.estado;
    of.cliente_nombre.value = (v.cliente_id && cById.get(v.cliente_id) ? cById.get(v.cliente_id).nombre : v.cliente_nombre) || '';
    of.cliente_tel.value = v.cliente_tel || '';
    of.direccion.value = v.direccion || '';
    of.envio.value = v.envio || '';
    of.entrega.value = v.entrega || '';
    of.fecha_entrega.value = v.fecha_entrega || '';
    const pagos = [...of.pago.options].map(x => x.value);
    if (v.pago && !pagos.includes(v.pago)) of.pago.add(new Option(v.pago, v.pago));
    of.pago.value = v.pago || 'Transferencia';
    of.pagado.checked = !!v.pagado;
    of.notas.value = v.notas || '';
    totalManual = !!o && (o.total || 0) !== subtotal() + (o.envio || 0);
    of.total.value = o ? (o.total || 0) : subtotal();
    $('#oTitle').textContent = o ? `Pedido #${o.codigo}` : 'Nuevo pedido';
    $('#oMeta').textContent = o ? `${o.origen === 'web' ? 'Entró por la web' : 'Cargado a mano'} · ${relDay(o.created_at).toLowerCase()} ${hora(o.created_at)}` : 'Cargalo a mano (por ejemplo, si te escribieron por Instagram).';
    $('#oDelete').hidden = !o;
    $('#oEntregas').innerHTML = (P.settings.opciones_entrega || []).map(x => `<option value="${esc(x)}">`).join('');
    renderItems(); renderTotals(); renderLinked(); renderStockNote(); updateWa();
    $('#oSuggest').hidden = true;
    P.openSheet(oSheet);
  }

  function prodOptions(sel) {
    const ps = P.products;
    const has = sel === 'mix' || ps.some(p => p.id === sel);
    return ps.map(p => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.nombre)}${p.disponible ? '' : ' (sin stock)'}</option>`).join('')
      + `<option value="mix"${sel === 'mix' ? ' selected' : ''}>Mix ½ kg (varias variedades)</option>`
      + (!has && sel ? `<option value="${esc(sel)}" selected>${esc(sel)} (ya no existe)</option>` : '');
  }
  function renderItems() {
    $('#oItems').innerHTML = items.map((it, i) => {
      const p = P.productById(it.product_id);
      const opts = p ? (p.opciones || []) : [];
      const mix = it.product_id === 'mix';
      const sub = it.unit == null ? 'a confirmar' : money(it.unit * (Number(it.qty) || 1));
      const inv = window.Stock && p ? Stock.invOf(p.id) : null;
      return `<div class="irow" data-i="${i}">
        <select data-f="product_id" aria-label="Producto">${prodOptions(it.product_id)}</select>
        <div class="irow-2">
          <select data-f="size" aria-label="Tamaño"${mix ? ' disabled' : ''}><option value="medio"${it.size !== 'kilo' ? ' selected' : ''}>½ kg</option><option value="kilo"${it.size === 'kilo' ? ' selected' : ''}>1 kg</option></select>
          <span class="stepper"><button type="button" data-step="-1" aria-label="Uno menos">−</button><input data-f="qty" inputmode="numeric" value="${Number(it.qty) || 1}" aria-label="Cantidad"><button type="button" data-step="1" aria-label="Uno más">+</button></span>
          <span class="isub${it.unit == null ? ' isub-pend' : ''}">${sub}</span>
          <button type="button" class="icon-btn icon-sm" data-del-item aria-label="Quitar producto">✕</button>
        </div>
        ${opts.length ? `<select data-f="opt" aria-label="Variedad"><option value="">Variedad sin elegir</option>${[...new Set([...opts, it.opt].filter(Boolean))].map(x => `<option${x === it.opt ? ' selected' : ''}>${esc(x)}</option>`).join('')}</select>` : ''}
        ${mix ? `<div class="mixchips" role="group" aria-label="Variedades del mix">${P.products.filter(x => x.en_mix || (it.mix || []).includes(x.id)).map(x => `<label><input type="checkbox" value="${esc(x.id)}"${(it.mix || []).includes(x.id) ? ' checked' : ''}><span>${esc(corto(x.nombre))}</span></label>`).join('')}</div>` : ''}
        ${inv ? `<small class="muted">Stock: ${esc(Stock.fmtKg(inv.stock_kg))}</small>` : ''}
      </div>`;
    }).join('');
  }
  function renderTotals() {
    const sub = subtotal(), envio = parseInt(digits(of.envio.value) || '0', 10);
    $('#oSubtotal').textContent = money(sub) + (pendiente() ? ' + a confirmar' : '');
    if (!totalManual) of.total.value = sub + envio;
    const kg = items.reduce((a, it) => a + kgOf(it), 0);
    $('#oTotalHint').textContent = pendiente() ? 'Hay productos con precio a confirmar (mix o sin precio): poné el total final a mano.'
      : totalManual ? `Calculado: ${money(sub + envio)}. Lo cambiaste a mano (por ejemplo, precio por cantidad).`
      : kg > 3 ? `Son ${kgTxt(kg)}: si hacés precio por cantidad, cambiá el total.` : '';
  }
  function renderLinked() {
    const c = linkedId && cById.get(linkedId);
    const box = $('#oLinked');
    box.hidden = !c;
    if (c) {
      const s = statOf(c.id);
      box.innerHTML = `<span>Cliente: <b>${esc(c.nombre)}</b>${s.n ? ` · ${s.n} ${s.n === 1 ? 'pedido' : 'pedidos'}` : ' · nuevo'}</span>
        <span class="linked-actions"><button type="button" class="btn btn-ghost btn-xs" data-open-client="${esc(c.id)}">Ver ficha</button><button type="button" class="btn btn-ghost btn-xs" id="oUnlink">Cambiar</button></span>`;
    }
  }
  function renderStockNote() {
    const n = $('#oStockNote');
    const est = of.estado.value;
    const tracked = items.some(it => window.Stock && (it.product_id === 'mix' ? (it.mix || []).some(id => Stock.invOf(id)) : Stock.invOf(it.product_id)));
    let t = '';
    if (ord && ord.stock_descontado && est === 'entregado') t = '✓ El stock de este pedido ya está descontado.';
    else if (ord && ord.stock_descontado && est !== 'entregado') t = 'Al guardar, los kilos de este pedido vuelven al stock.';
    else if (est === 'entregado' && tracked) t = 'Al guardar como «Entregado», se descuentan los kilos del stock.';
    n.textContent = t; n.hidden = !t;
  }
  function waMsg() {
    const nombre = of.cliente_nombre.value.trim().split(/\s+/)[0] || '';
    const cod = ord ? ord.codigo : '';
    const est = of.estado.value;
    if (est === 'entregado') return `¡Hola ${nombre}! ¿Qué tal estuvo el chipá? Gracias por elegirnos${cod ? ` (pedido N.º ${cod})` : ''}. Cuando quieras repetir, escribinos por acá.`;
    const lineas = items.map(it => '• ' + itemTxt(it));
    const cuando = [of.entrega.value.trim(), of.fecha_entrega.value ? keyDate(of.fecha_entrega.value, { weekday: 'long', day: 'numeric', month: 'long' }) : ''].filter(Boolean).join(', ');
    return [`¡Hola ${nombre}! Te confirmamos tu pedido${cod ? ` N.º ${cod}` : ''} de *Sabor del Chipá*:`, ...lineas,
      `*Total: ${money(parseInt(digits(of.total.value) || '0', 10))}*`, cuando ? `Entrega: ${cuando}.` : '', '¡Gracias!'].filter(Boolean).join('\n');
  }
  function updateWa() {
    const n = waNum(of.cliente_tel.value);
    const a = $('#oWa'); a.hidden = !n;
    a.href = n ? `https://wa.me/${n}?text=${encodeURIComponent(waMsg())}` : '#';
  }

  // edición de items
  $('#oItems').addEventListener('change', e => {
    const row = e.target.closest('.irow'); if (!row) return;
    const it = items[+row.dataset.i];
    const f = e.target.dataset.f;
    if (f === 'product_id') {
      it.product_id = e.target.value;
      if (it.product_id === 'mix') { Object.assign(it, { nombre: 'Mix ½ kg', size: 'medio', unit: null, opt: '', mix: [] }); }
      else { const p = P.productById(it.product_id); delete it.mix; Object.assign(it, { nombre: p ? p.nombre : it.product_id, unit: priceOf(p, it.size), opt: p && (p.opciones || [])[0] || '' }); }
      renderItems();
    } else if (f === 'size') {
      it.size = e.target.value; it.unit = priceOf(P.productById(it.product_id), it.size); renderItems();
    } else if (f === 'opt') {
      it.opt = e.target.value;
    } else if (f === 'qty') {
      it.qty = Math.min(99, Math.max(1, parseInt(digits(e.target.value) || '1', 10))); renderItems();
    } else if (e.target.closest('.mixchips')) {
      it.mix = $$('.mixchips input:checked', row).map(x => x.value);
      it.opt = it.mix.map(id => (P.productById(id) || {}).nombre || id).join(' + ');
    }
    renderTotals(); renderStockNote(); updateWa();
  });
  $('#oItems').addEventListener('click', e => {
    const row = e.target.closest('.irow'); if (!row) return;
    const i = +row.dataset.i;
    const st = e.target.closest('[data-step]');
    if (st) { items[i].qty = Math.min(99, Math.max(1, (Number(items[i].qty) || 1) + Number(st.dataset.step))); }
    else if (e.target.closest('[data-del-item]')) { items.splice(i, 1); if (!items.length) items.push(blankItem()); }
    else return;
    renderItems(); renderTotals(); renderStockNote(); updateWa();
  });
  $('#oAddItem').addEventListener('click', () => {
    items.push(blankItem()); renderItems(); renderTotals(); updateWa();
    const rows = $$('#oItems .irow'); const sel = rows[rows.length - 1] && $('select', rows[rows.length - 1]); if (sel) sel.focus();
  });
  of.envio.addEventListener('input', () => { renderTotals(); updateWa(); });
  of.total.addEventListener('input', () => { totalManual = of.total.value.trim() !== ''; renderTotals(); updateWa(); });
  of.total.addEventListener('blur', () => { if (!of.total.value.trim()) { totalManual = false; renderTotals(); } });
  $$('[name=estado]', of).forEach(r => r.addEventListener('change', () => { renderStockNote(); updateWa(); }));
  ['entrega', 'fecha_entrega', 'cliente_tel'].forEach(n => of[n].addEventListener('input', updateWa));

  // buscar cliente existente mientras escribís el nombre o el teléfono
  function suggest() {
    const box = $('#oSuggest');
    if (linkedId) { box.hidden = true; return; }
    const q = norm(of.cliente_nombre.value.trim()), t = digits(of.cliente_tel.value);
    if (q.length < 2 && t.length < 4) { box.hidden = true; return; }
    const res = clientes.filter(c => (q.length >= 2 && norm(c.nombre).includes(q)) || (t.length >= 4 && c.telefono.includes(t))).slice(0, 6);
    box.hidden = !res.length;
    box.innerHTML = res.map(c => { const s = statOf(c.id); return `<li><button type="button" data-pick="${esc(c.id)}"><b>${esc(c.nombre)}</b><span>${esc([telTxt(c.telefono), c.direccion, s.n ? s.n + (s.n === 1 ? ' pedido' : ' pedidos') : ''].filter(Boolean).join(' · '))}</span></button></li>`; }).join('');
  }
  of.cliente_nombre.addEventListener('input', () => { suggest(); updateWa(); });
  of.cliente_tel.addEventListener('input', suggest);
  $('#oSuggest').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    const c = cById.get(b.dataset.pick); if (!c) return;
    linkedId = c.id;
    of.cliente_nombre.value = c.nombre;
    if (c.telefono) of.cliente_tel.value = c.telefono;
    if (c.direccion) of.direccion.value = c.direccion;
    $('#oSuggest').hidden = true; renderLinked(); updateWa();
  });
  $('#oLinked').addEventListener('click', e => { if (e.target.id === 'oUnlink') { linkedId = null; renderLinked(); of.cliente_nombre.focus(); suggest(); } });
  document.addEventListener('click', e => { if (!e.target.closest('.ac')) $('#oSuggest').hidden = true; });

  of.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#oError');
    const nombre = of.cliente_nombre.value.trim();
    const bad = m => { err.textContent = m; err.hidden = false; err.scrollIntoView({ block: 'center' }); };
    if (!nombre) return bad('Poné el nombre del cliente.');
    if (!items.length || items.some(it => !it.product_id)) return bad('Elegí los productos.');
    if (items.some(it => it.product_id === 'mix' && (it.mix || []).length < 2)) return bad('En el mix elegí al menos 2 variedades.');
    err.hidden = true;
    const tel = digits(of.cliente_tel.value).slice(0, 15), dir = of.direccion.value.trim();
    const row = {
      estado: of.estado.value,
      cliente_nombre: nombre.slice(0, 80), cliente_tel: tel, direccion: dir.slice(0, 200),
      items: items.map(it => ({ product_id: it.product_id, nombre: it.nombre || '', size: it.product_id === 'mix' ? 'medio' : it.size, opt: it.opt || '', qty: Number(it.qty) || 1, unit: it.unit == null ? null : it.unit, ...(it.product_id === 'mix' ? { mix: it.mix || [] } : {}) })),
      envio: parseInt(digits(of.envio.value) || '0', 10),
      total: parseInt(digits(of.total.value) || '0', 10),
      precio_pendiente: pendiente() && !totalManual,
      entrega: of.entrega.value.trim(), fecha_entrega: of.fecha_entrega.value || null,
      pago: of.pago.value, pagado: of.pagado.checked, notas: of.notas.value.trim()
    };
    const before = ord ? { ...ord } : null;
    try {
      const saved = await P.guard(async () => {
        let cid = linkedId;
        if (!cid) {   // ¿ya existe? por teléfono, o por nombre + dirección
          const m = (tel.length >= 8 && clientes.find(c => c.telefono && c.telefono.slice(-10) === tel.slice(-10)))
            || clientes.find(c => norm(c.nombre) === norm(nombre) && norm(c.direccion) === norm(dir));
          if (m) cid = m.id;
          else { const c = (await SB.insert('clientes', { nombre: row.cliente_nombre, telefono: tel, direccion: row.direccion, origen: 'manual' }))[0]; clientes.unshift(c); cid = c.id; }
        } else {
          const c = cById.get(cid), patch = {};
          if (c && !c.telefono && tel) patch.telefono = tel;
          if (c && !c.direccion && dir) patch.direccion = row.direccion;
          if (Object.keys(patch).length) { const u = await SB.update('clientes', 'id=eq.' + cid, patch); if (u && u[0]) Object.assign(c, u[0]); }
        }
        row.cliente_id = cid;
        const r = ord ? await SB.update('pedidos', 'id=eq.' + encodeURIComponent(ord.id), row)
          : await SB.insert('pedidos', { ...row, origen: 'manual', codigo: newCode() });
        return r && r[0];
      }, 'Pedido guardado ✓');
      if (saved) replaceOrder(saved);
      index(); renderAll();
      P.closeSheet(oSheet);
      refreshClientSheet();
      await afterStockChange(before, saved);
    } catch (_) { /* el toast ya avisó */ }
  });

  $('#oDelete').addEventListener('click', async () => {
    if (!ord) return;
    if (!confirm(`¿Eliminar el pedido #${ord.codigo} de ${nombreDe(ord)}? No se puede deshacer.${ord.stock_descontado ? ' Los kilos vuelven al stock.' : ''}`)) return;
    const before = { ...ord };
    try {
      await P.guard(() => SB.remove('pedidos', 'id=eq.' + encodeURIComponent(ord.id)), 'Pedido eliminado');
      pedidos = pedidos.filter(x => x.id !== before.id);
      index(); renderAll(); P.closeSheet(oSheet); refreshClientSheet();
      await afterStockChange(before, null);
    } catch (_) {}
  });

  /* =========================================================
     CLIENTES
     ========================================================= */
  const SEG = [
    ['todos', 'Todos', () => true],
    ['nuevos', 'Nuevos', c => daysBetween(dayKey(c.created_at), todayKey()) <= 30],
    ['frecuentes', 'Frecuentes', c => statOf(c.id).compras >= 2],
    ['reactivar', 'Para reactivar', c => { const s = statOf(c.id); return s.ultimo && daysBetween(dayKey(s.ultimo), todayKey()) > 45; }],
    ['cumple', 'Cumplen este mes', c => c.cumple && c.cumple.slice(5, 7) === todayKey().slice(5, 7)],
    ['sin', 'Sin pedidos', c => !statOf(c.id).n]
  ];
  function clientesFiltrados() {
    const f = (SEG.find(x => x[0] === fCli) || SEG[0])[2];
    const q = norm(qCli.trim()), qd = digits(qCli);
    const list = clientes.filter(c => f(c) && (!q || norm([c.nombre, c.direccion, c.email, c.notas, ...(c.etiquetas || [])].join(' ')).includes(q) || (qd.length >= 3 && c.telefono.includes(qd))));
    const by = {
      ultimo: (a, b) => String(statOf(b.id).ultimo || '').localeCompare(String(statOf(a.id).ultimo || '')) || (a.created_at < b.created_at ? 1 : -1),
      gastado: (a, b) => statOf(b.id).gastado - statOf(a.id).gastado,
      pedidos: (a, b) => statOf(b.id).n - statOf(a.id).n,
      nuevos: (a, b) => (a.created_at < b.created_at ? 1 : -1),
      nombre: (a, b) => a.nombre.localeCompare(b.nombre, 'es')
    }[sCli];
    return list.sort(by);
  }
  function renderClientes() {
    if (!loaded) return;
    $('#fClientes').innerHTML = SEG.map(([k, label, f]) => {
      const n = clientes.filter(f).length;
      if (k === 'cumple' && !n && fCli !== k) return '';
      return `<button type="button" data-f="${k}" aria-pressed="${k === fCli}">${label} <small>${n}</small></button>`;
    }).join('');
    const compraron = clientes.filter(c => statOf(c.id).compras > 0).length;
    $('#clientesResumen').textContent = clientes.length
      ? `${clientes.length} ${clientes.length === 1 ? 'cliente' : 'clientes'} · ${compraron} con compras confirmadas. Se crean solos con cada pedido de la web.`
      : 'Se crean solos con cada pedido de la web. También los podés cargar a mano.';
    const list = clientesFiltrados(), shown = list.slice(0, pageC * PAGE);
    $('#clist').innerHTML = shown.map(c => {
      const s = statOf(c.id), wa = waNum(c.telefono);
      return `<li class="citem">
        <button type="button" class="c-main" data-open-client="${esc(c.id)}">
          <span class="avatar" aria-hidden="true">${esc(initials(c.nombre))}</span>
          <span class="c-txt"><b>${esc(c.nombre)}</b>
            <span class="muted small">${esc([c.direccion, s.n ? `${s.n} ${s.n === 1 ? 'pedido' : 'pedidos'}` : 'sin pedidos', s.gastado ? money(s.gastado) : ''].filter(Boolean).join(' · '))}</span>
            <span class="muted small">${s.ultimo ? 'Último pedido ' + esc(ago(s.ultimo)) : 'Cliente desde ' + esc(fechaCorta(c.created_at))}</span>
            ${(c.etiquetas || []).length ? `<span class="chips-mini">${c.etiquetas.map(t => `<span class="chip">${esc(t)}</span>`).join('')}</span>` : ''}
          </span>
        </button>
        ${wa ? `<a class="icon-btn wa-btn" href="https://wa.me/${wa}" target="_blank" rel="noopener" aria-label="WhatsApp a ${esc(c.nombre)}">${WA_ICON}</a>` : ''}
      </li>`;
    }).join('') || `<li class="empty">${clientes.length ? 'No hay clientes con este filtro.' : 'Todavía no hay clientes.'}</li>`;
    $('#moreClientes').hidden = list.length <= shown.length;
  }
  const WA_ICON = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Z"/></svg>';
  $('#fClientes').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (!b) return; fCli = b.dataset.f; pageC = 1; renderClientes(); });
  $('#qClientes').addEventListener('input', e => { qCli = e.target.value; pageC = 1; renderClientes(); });
  $('#sClientes').addEventListener('change', e => { sCli = e.target.value; renderClientes(); });
  $('#moreClientes').addEventListener('click', () => { pageC++; renderClientes(); });
  $('#newCliente').addEventListener('click', () => openClient(null));
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-open-client]'); if (!b) return;
    const c = cById.get(b.dataset.openClient); if (c) openClient(c);
  });

  /* ---------- hoja del cliente ---------- */
  const cSheet = $('#clientSheet'), cf = $('#clientEdit');
  let cli = null;
  function openClient(c) {
    cli = c || null;
    cf.reset(); $('#cError').hidden = true; $('#cMergeBox').open = false; $('#cMergeQ').value = ''; $('#cMergeList').innerHTML = '';
    const v = c || { nombre: '', telefono: '', email: '', direccion: '', cumple: null, origen: 'whatsapp', etiquetas: [], notas: '' };
    cf.nombre.value = v.nombre; cf.telefono.value = v.telefono; cf.email.value = v.email || ''; cf.direccion.value = v.direccion || '';
    cf.cumple.value = v.cumple || '';
    if (![...cf.origen.options].some(o => o.value === v.origen)) cf.origen.add(new Option(v.origen, v.origen));
    cf.origen.value = v.origen || 'manual';
    cf.etiquetas.value = (v.etiquetas || []).join(', '); cf.notas.value = v.notas || '';
    renderClientSheet();
    P.openSheet(cSheet);
    if (!c) setTimeout(() => cf.nombre.focus(), 60);
  }
  function renderClientSheet() {
    const c = cli;
    $('#cTitle').textContent = c ? c.nombre : 'Nuevo cliente';
    const ORIG = { web: 'vino por la web', whatsapp: 'vino por WhatsApp', instagram: 'vino por Instagram', recomendacion: 'vino recomendado' };
    $('#cMeta').textContent = c ? `Cliente desde ${fechaCorta(c.created_at)}${ORIG[c.origen] ? ' · ' + ORIG[c.origen] : ''}` : '';
    $('#cHistBox').hidden = $('#cMergeBox').hidden = $('#cDelete').hidden = !c;
    const s = c ? statOf(c.id) : null;
    $('#cStats').hidden = !c; $('#cFav').hidden = !c;
    const wa = waNum(c ? c.telefono : cf.telefono.value);
    $('#cWa').hidden = !wa; $('#cWa').href = wa ? `https://wa.me/${wa}` : '#';
    if (!c) return;
    $('#cStats').innerHTML = `
      <div><b>${s.n}</b><span>${s.n === 1 ? 'pedido' : 'pedidos'}</span></div>
      <div><b>${money(s.gastado)}</b><span>gastado</span></div>
      <div><b>${s.compras ? money(Math.round(s.gastado / s.compras)) : '—'}</b><span>por compra</span></div>
      <div><b>${s.ultimo ? esc(ago(s.ultimo)) : '—'}</b><span>último pedido</span></div>`;
    const fav = Object.entries(s.prods).sort((a, b) => b[1] - a[1]).slice(0, 3);
    $('#cFav').innerHTML = fav.length ? `<p class="small fav"><span class="muted">Lo que más pide:</span> ${fav.map(([k, v]) => `<span class="chip">${esc(k)} · ${kgTxt(v)}</span>`).join(' ')}</p>` : '';
    const hist = pedidos.filter(o => o.cliente_id === c.id);
    $('#cHist').innerHTML = hist.map(o => `<li><button type="button" class="linkish" data-open-order="${esc(o.id)}">
        <span><b>#${esc(o.codigo)}</b> <span class="muted small">${esc(fechaCorta(o.created_at))}</span><br><span class="small">${esc((o.items || []).map(itemTxt).join(' · '))}</span></span>
        <span class="h-side"><span class="pill p-${o.estado}">${EST[o.estado]}</span><b class="small">${money(o.total)}</b></span></button></li>`).join('')
      || '<li class="empty">Todavía no hizo pedidos.</li>';
  }
  function refreshClientSheet() {
    if (cSheet.hidden || !cli) return;
    cli = cById.get(cli.id) || null;
    if (!cli) { P.closeSheet(cSheet); return; }
    renderClientSheet();
  }
  cf.telefono.addEventListener('input', () => { const wa = waNum(cf.telefono.value); $('#cWa').hidden = !wa; $('#cWa').href = wa ? `https://wa.me/${wa}` : '#'; });
  $('#cNewOrder').addEventListener('click', () => {
    if (!cli) return;
    openOrder(null, { cliente_id: cli.id, cliente_nombre: cli.nombre, cliente_tel: cli.telefono, direccion: cli.direccion });
  });

  cf.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#cError');
    const nombre = cf.nombre.value.trim();
    if (!nombre) { err.textContent = 'Poné el nombre.'; err.hidden = false; return; }
    const tel = digits(cf.telefono.value).slice(0, 15);
    const dup = tel.length >= 8 && clientes.find(c => c.id !== (cli && cli.id) && c.telefono && c.telefono.slice(-10) === tel.slice(-10));
    if (dup && !confirm(`Ya hay un cliente con ese WhatsApp: «${dup.nombre}». ¿Guardar igual?`)) return;
    err.hidden = true;
    const row = {
      nombre: nombre.slice(0, 80), telefono: tel, email: cf.email.value.trim().slice(0, 120), direccion: cf.direccion.value.trim().slice(0, 200),
      cumple: cf.cumple.value || null, origen: cf.origen.value,
      etiquetas: cf.etiquetas.value.split(',').map(s => s.trim()).filter(Boolean).slice(0, 12), notas: cf.notas.value.trim().slice(0, 2000)
    };
    try {
      const r = await P.guard(() => cli ? SB.update('clientes', 'id=eq.' + cli.id, row) : SB.insert('clientes', row), 'Cliente guardado ✓');
      const c = r && r[0];
      if (c) { const i = clientes.findIndex(x => x.id === c.id); if (i >= 0) clientes[i] = c; else clientes.unshift(c); cli = c; }
      index(); renderAll(); renderClientSheet();
      if (!$('#orderSheet').hidden) renderLinked();
    } catch (_) {}
  });

  $('#cDelete').addEventListener('click', async () => {
    if (!cli) return;
    const n = statOf(cli.id).n;
    if (!confirm(`¿Eliminar a «${cli.nombre}»?${n ? ` Sus ${n} pedidos quedan guardados, sin cliente asignado.` : ''} No se puede deshacer.`)) return;
    try {
      await P.guard(() => SB.remove('clientes', 'id=eq.' + cli.id), 'Cliente eliminado');
      const id = cli.id;
      clientes = clientes.filter(c => c.id !== id);
      pedidos.forEach(o => { if (o.cliente_id === id) o.cliente_id = null; });
      index(); renderAll(); P.closeSheet(cSheet);
    } catch (_) {}
  });

  // unir duplicados
  $('#cMergeQ').addEventListener('input', e => {
    const q = norm(e.target.value.trim()), qd = digits(e.target.value);
    const res = q.length < 2 && qd.length < 3 ? [] : clientes.filter(c => c.id !== (cli && cli.id) && (norm(c.nombre).includes(q) || (qd.length >= 3 && c.telefono.includes(qd)))).slice(0, 6);
    $('#cMergeList').innerHTML = res.map(c => `<li><button type="button" data-merge="${esc(c.id)}"><b>${esc(c.nombre)}</b><span>${esc([telTxt(c.telefono), c.direccion, statOf(c.id).n + ' pedidos'].filter(Boolean).join(' · '))}</span></button></li>`).join('')
      || (q.length >= 2 ? '<li class="muted small">No encontré ninguno.</li>' : '');
  });
  $('#cMergeList').addEventListener('click', async e => {
    const b = e.target.closest('[data-merge]'); if (!b || !cli) return;
    const keep = cById.get(b.dataset.merge); if (!keep) return;
    if (!confirm(`¿Unir «${cli.nombre}» con «${keep.nombre}»?\nLos pedidos pasan a «${keep.nombre}» y «${cli.nombre}» se borra.`)) return;
    try {
      await P.guard(() => SB.rpc('unir_clientes', { p_conservar: keep.id, p_borrar: cli.id }), 'Clientes unidos ✓');
      P.closeSheet(cSheet);
      await load();
      const k = cById.get(keep.id); if (k) openClient(k);
    } catch (_) {}
  });

  /* ---------- exportar a CSV (se abre con Excel o Google Sheets) ---------- */
  function csv(rows, name) {
    const cell = v => {
      if (v == null) return '';
      if (typeof v === 'number') return String(v).replace('.', ',');
      let s = String(v);
      if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;            // que Excel no lo tome como fórmula
      return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const text = rows.map(r => r.map(cell).join(';')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' }));
    a.download = name; document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  $('#csvPedidos').addEventListener('click', () => {
    const list = pedidosFiltrados();
    if (!list.length) return P.toast('No hay pedidos para exportar con este filtro.', true);
    csv([['Fecha', 'Hora', 'Código', 'Estado', 'Cobrado', 'Cliente', 'WhatsApp', 'Dirección', 'Productos', 'Kg', 'Envío', 'Total', 'Entrega', 'Fecha de entrega', 'Pago', 'Origen', 'Notas'],
      ...list.map(o => [dayKey(o.created_at), hora(o.created_at), o.codigo, EST[o.estado], o.pagado ? 'Sí' : 'No', nombreDe(o), o.cliente_tel, o.direccion,
        (o.items || []).map(itemTxt).join(' | '), Number(o.kg) || 0, o.envio || 0, o.total || 0, o.entrega, o.fecha_entrega || '', o.pago, o.origen === 'web' ? 'Web' : 'Manual', o.notas])],
      `pedidos-${todayKey()}.csv`);
  });
  $('#csvClientes').addEventListener('click', () => {
    const list = clientesFiltrados();
    if (!list.length) return P.toast('No hay clientes para exportar con este filtro.', true);
    csv([['Nombre', 'WhatsApp', 'Mail', 'Dirección', 'Cumpleaños', 'Cómo llegó', 'Etiquetas', 'Pedidos', 'Compras confirmadas', 'Gastado', 'Último pedido', 'Cliente desde', 'Notas'],
      ...list.map(c => { const s = statOf(c.id); return [c.nombre, c.telefono, c.email, c.direccion, c.cumple || '', c.origen, (c.etiquetas || []).join(', '), s.n, s.compras, s.gastado, s.ultimo ? dayKey(s.ultimo) : '', dayKey(c.created_at), c.notas]; })],
      `clientes-${todayKey()}.csv`);
  });

  /* ---------- pedidos nuevos mientras el panel está abierto ---------- */
  let timer = null;
  async function poll() {
    if (!loaded || document.hidden || $('#viewApp').hidden) return;
    const newest = pedidos.reduce((m, o) => (o.created_at > m ? o.created_at : m), '1970-01-01T00:00:00Z');
    const r = await quiet(() => SB.select('pedidos', 'select=id,cliente_nombre,codigo&created_at=gt.' + encodeURIComponent(newest) + '&order=created_at.asc'));
    if (r && r.length) {
      await load();
      P.toast(r.length === 1 ? `🔔 Pedido nuevo de ${r[0].cliente_nombre} (#${r[0].codigo})` : `🔔 ${r.length} pedidos nuevos`);
    }
  }
  function startPolling() { clearInterval(timer); timer = setInterval(poll, 60000); }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });

  P.on('ready', () => { load(); startPolling(); });
  P.on('refresh', load);
  P.on('logout', () => { clearInterval(timer); loaded = false; });
  P.on('tab', t => { if (t === 'inicio') renderDash(); });
  P.on('products', () => { if (loaded) renderDash(); });

  window.CRM = { load, openOrder, openClient };
})();
