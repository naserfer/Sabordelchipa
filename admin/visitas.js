/* =========================================================
   Visitas a la web (tabla eventos, función estadisticas_visitas)
   Anónimo: la web guarda un id al azar en el navegador, sin IP
   ni datos personales. Las visitas del dueño no se cuentan.
   ========================================================= */
(function () {
  'use strict';
  const P = window.Panel, C = window.Charts;
  const { $, $$, esc } = P;

  const TZ = 'America/Argentina/Buenos_Aires';
  const todayKey = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
  const addDays = (key, n) => { const d = new Date(key + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const keyDate = (k, o) => new Date(k.slice(0, 10) + 'T12:00:00Z').toLocaleDateString('es-AR', { timeZone: 'UTC', ...o });
  const nf = n => (Number(n) || 0).toLocaleString('es-AR');
  const pct = (a, b) => (b ? Math.round(a / b * 100) : 0) + '%';

  const FUENTE = { directo: 'Directo o link compartido', instagram: 'Instagram', google: 'Google', facebook: 'Facebook', whatsapp: 'WhatsApp', tiktok: 'TikTok', x: 'X (Twitter)', bing: 'Bing' };
  const DISP = { movil: 'Celular', compu: 'Compu', tablet: 'Tablet' };

  let rango = 7, data = null, at = 0, pedido = 0;

  async function load() {
    const hoy = todayKey();
    const desde = rango === 0 ? hoy : addDays(hoy, -(rango - 1));
    const body = $('#visBody');
    const mine = ++pedido;
    body.classList.add('is-loading');
    try {
      const r = await SB.rpc('estadisticas_visitas', { p_desde: desde, p_hasta: hoy });
      if (mine !== pedido) return;
      data = r; at = Date.now(); render();
    } catch (e) {
      if (mine !== pedido) return;
      console.warn('[visitas]', e.message);
      if (e.status === 401) return location.reload();
      $('#visKpis').innerHTML = '';
      $('#chartVisitas').innerHTML = `<p class="empty">${e.status === 404
        ? 'El contador de visitas todavía no está activo en la base. Cuando se active, vas a ver acá cuánta gente entra.'
        : 'No se pudieron cargar las visitas. Tocá ↻ para reintentar.'}</p>`;
    } finally { if (mine === pedido) body.classList.remove('is-loading'); }
  }

  function render() {
    const t = data.totales || {};
    const porHora = rango === 0;
    C.kpis($('#visKpis'), [
      { label: porHora ? 'Personas hoy' : 'Personas', value: nf(t.personas), sub: `${nf(t.visitas)} ${t.visitas === 1 ? 'visita' : 'visitas'} · ${nf(t.vistas)} ${t.vistas === 1 ? 'página vista' : 'páginas vistas'}` },
      { label: 'Volvieron', value: pct(t.vuelven, t.personas), sub: `${nf(t.vuelven)} ya habían entrado antes` },
      { label: 'Sumaron al carrito', value: pct(t.carrito, t.visitas), sub: `${nf(t.carrito)} de ${nf(t.visitas)} visitas` },
      { label: 'Enviaron el pedido', value: pct(t.pedidos, t.visitas), sub: `${nf(t.pedidos)} ${t.pedidos === 1 ? 'pedido' : 'pedidos'} por WhatsApp`, tone: t.pedidos ? 'up' : '' }
    ]);

    const serie = data.serie || [];
    $('#visSerieTitulo').textContent = porHora ? 'Personas por hora (hoy)' : 'Personas por día';
    C.columns($('#chartVisitas'), serie.map(d => {
      const h = porHora ? parseInt(d.t.slice(11, 13), 10) : 0;
      return {
        axis: porHora ? h + 'h' : (rango > 31 ? keyDate(d.t, { day: 'numeric', month: 'numeric' }) : keyDate(d.t, rango <= 7 ? { weekday: 'short' } : { day: 'numeric' })),
        label: porHora ? `De ${h} a ${h + 1} h` : keyDate(d.t, { weekday: 'long', day: 'numeric', month: 'long' }),
        value: d.personas,
        display: `${nf(d.personas)} ${d.personas === 1 ? 'persona' : 'personas'}${d.pedidos ? ` · ${d.pedidos} ${d.pedidos === 1 ? 'pedido' : 'pedidos'}` : ''}`
      };
    }), { integer: true, title: porHora ? 'Personas por hora' : 'Personas por día', height: 200, empty: 'Todavía no hay visitas en este período.' });

    $('#tablaVisitas').innerHTML = `<table class="tbl"><thead><tr><th>${porHora ? 'Hora' : 'Día'}</th><th>Personas</th><th>Visitas</th><th>Carrito</th><th>Pedidos</th></tr></thead><tbody>
      ${serie.slice().reverse().map(d => `<tr><td>${esc(porHora ? parseInt(d.t.slice(11, 13), 10) + ' h' : keyDate(d.t, { weekday: 'short', day: 'numeric', month: 'short' }))}</td><td>${nf(d.personas)}</td><td>${nf(d.visitas)}</td><td>${nf(d.carrito)}</td><td>${nf(d.pedidos)}</td></tr>`).join('')}
      </tbody></table>`;

    C.hbars($('#embudo'), [
      { label: 'Entraron a la web', value: t.visitas || 0, display: nf(t.visitas) },
      { label: 'Sumaron algo al carrito', value: t.carrito || 0, display: `${nf(t.carrito)} · ${pct(t.carrito, t.visitas)}` },
      { label: 'Enviaron el pedido', value: t.pedidos || 0, display: `${nf(t.pedidos)} · ${pct(t.pedidos, t.visitas)}` },
      { label: 'Escribieron por WhatsApp (consulta)', value: t.whatsapp || 0, display: `${nf(t.whatsapp)} · ${pct(t.whatsapp, t.visitas)}` }
    ], { empty: 'Todavía no hay visitas en este período.' });

    const totF = (data.fuentes || []).reduce((a, f) => a + f.n, 0);
    C.hbars($('#fuentes'), (data.fuentes || []).map(f => ({ label: FUENTE[f.k] || f.k, value: f.n, display: `${nf(f.n)} · ${pct(f.n, totF)}` })),
      { empty: 'Todavía no hay visitas en este período.' });
    const totD = (data.dispositivos || []).reduce((a, f) => a + f.n, 0);
    C.hbars($('#dispositivos'), (data.dispositivos || []).map(f => ({ label: DISP[f.k] || f.k, value: f.n, display: `${nf(f.n)} · ${pct(f.n, totD)}` })),
      { empty: 'Todavía no hay visitas en este período.' });

    const horas = [...Array(24)].map((_, h) => ({ h, n: 0 }));
    (data.horas || []).forEach(x => { if (horas[x.h]) horas[x.h].n = x.n; });
    C.columns($('#chartHoras'), horas.map(x => ({ axis: x.h + 'h', label: `De ${x.h} a ${x.h + 1} h`, value: x.n, display: `${nf(x.n)} ${x.n === 1 ? 'visita' : 'visitas'}` })),
      { integer: true, anchor: 'start', title: 'Visitas por hora del día', height: 150, empty: 'Todavía no hay visitas en este período.' });
  }

  $('#rangoVisitas').addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    rango = +b.dataset.r;
    $$('#rangoVisitas [data-r]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    load();
  });
  // carga al abrir la pestaña (y de nuevo si pasaron más de 2 minutos)
  P.on('tab', t => { if (t === 'visitas' && Date.now() - at > 120000) load(); });
  P.on('ready', () => { at = 0; if (P.currentTab() === 'visitas') load(); });
  P.on('refresh', () => { if (P.currentTab() === 'visitas') load(); });
})();
