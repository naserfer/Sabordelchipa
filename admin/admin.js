/* =========================================================
   Panel de administración — Sabor del Chipá
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const D = window.SABOR_DEFAULTS;
  const money = n => (n == null ? '—' : '$' + Number(n).toLocaleString('es-AR'));
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const imgSrc = v => !v ? '../img/logo-200.png' : /^(https?:|data:|blob:)/.test(v) ? v : '../' + String(v).replace(/^\/+/, '');
  const digits = v => String(v ?? '').replace(/\D/g, '');
  const price = v => { const d = digits(v); return d ? parseInt(d, 10) : null; };
  const lines = v => String(v || '').split('\n').map(s => s.trim()).filter(Boolean);
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'producto';

  let products = [], settings = null, editing = null, pendingPhoto = null;

  /* ---------- utilidades de UI ---------- */
  function show(view) {
    ['Login', 'Setup', 'App'].forEach(v => $('#view' + v).hidden = v.toLowerCase() !== view);
  }
  let tt;
  function toast(msg, bad = false) {
    const t = $('#toast'); t.textContent = msg; t.classList.toggle('bad', bad); t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), bad ? 4200 : 2200);
  }
  const busy = on => { $('#busy').hidden = !on; };
  async function guard(fn, okMsg) {
    busy(true);
    try { const r = await fn(); if (okMsg) toast(okMsg); return r; }
    catch (e) {
      console.error(e);
      if (e.status === 401) { await SB.signOut(); show('login'); showLoginError('Tu sesión venció. Entrá de nuevo.'); }
      else toast(e.message || 'Algo salió mal', true);
      throw e;
    } finally { busy(false); }
  }
  function showLoginError(m) { const e = $('#loginError'); e.textContent = m; e.hidden = !m; }

  /* ---------- arranque ---------- */
  async function boot() {
    if (!window.SB || !SB.configured) return show('setup');
    if (!SB.session) return show('login');
    try {
      const ok = await SB.rpc('is_admin');
      if (ok !== true) { await SB.signOut(); show('login'); showLoginError('Esta cuenta no tiene permiso de administrador.'); return; }
    } catch (e) {
      if (e.status === 401) { await SB.signOut(); show('login'); return; }
      show('login'); showLoginError(e.message); return;
    }
    show('app');
    $('#accountEmail').textContent = 'Sesión iniciada como ' + (SB.session.email || '');
    await loadAll().catch(() => {});
  }

  $('#loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get('email') || '').trim(), password = String(f.get('password') || '');
    if (!email || !password) return showLoginError('Completá mail y contraseña.');
    showLoginError('');
    const btn = $('button[type=submit]', e.currentTarget); btn.disabled = true; btn.textContent = 'Entrando…';
    try { await SB.signIn(email, password); await boot(); }
    catch (err) { showLoginError(err.message); }
    finally { btn.disabled = false; btn.textContent = 'Entrar'; }
  });
  $('.pw-toggle').addEventListener('click', e => {
    const i = $('input[name=password]'); i.type = i.type === 'password' ? 'text' : 'password';
    e.currentTarget.setAttribute('aria-label', i.type === 'password' ? 'Mostrar contraseña' : 'Ocultar contraseña');
  });

  /* ---------- pestañas ---------- */
  $$('.tab').forEach(t => t.addEventListener('click', () => {
    $$('.tab').forEach(x => { x.classList.toggle('is-active', x === t); x.setAttribute('aria-selected', String(x === t)); });
    $$('.panel').forEach(p => p.hidden = p.id !== 'tab-' + t.dataset.tab);
    scrollTo(0, 0);
  }));

  /* ---------- datos ---------- */
  async function loadAll() {
    await guard(async () => {
      const [p, s] = await Promise.all([
        SB.select('products', 'select=*&order=orden.asc,nombre.asc'),
        SB.select('settings', 'select=*&id=eq.1')
      ]);
      products = p || [];
      settings = (s && s[0]) || null;
      if (!settings) settings = (await SB.insert('settings', { id: 1, ...D.settings }))[0];
    });
    renderList(); fillSettings();
  }

  /* ---------- lista de productos ---------- */
  function renderList() {
    const ul = $('#plist');
    if (!products.length) { ul.innerHTML = '<li class="muted">Todavía no hay productos. Tocá «＋ Nuevo».</li>'; return; }
    ul.innerHTML = products.map((p, i) => `
      <li class="pitem${p.disponible ? '' : ' off'}" data-id="${esc(p.id)}">
        <img src="${esc(imgSrc(p.img))}" alt="" loading="lazy">
        <div class="pmain" data-edit role="button" tabindex="0" aria-label="Editar ${esc(p.nombre)}">
          <b>${esc(p.nombre)}</b>
          <span><span class="nw">½ kg ${money(p.precio_medio)}</span> · <span class="nw">1 kg ${money(p.precio_kilo)}</span></span>
          <div class="chips">${p.a_pedido ? '<span class="chip">A pedido</span>' : ''}${p.en_mix ? '<span class="chip">Mix</span>' : ''}${p.disponible ? '' : '<span class="chip">Sin stock</span>'}</div>
        </div>
        <div class="pside">
          <label class="switch" title="Hay stock"><input type="checkbox" data-stock ${p.disponible ? 'checked' : ''} aria-label="Hay stock de ${esc(p.nombre)}"><span></span></label>
          <div class="order">
            <button type="button" data-move="-1" ${i === 0 ? 'disabled' : ''} aria-label="Subir">▲</button>
            <button type="button" data-move="1" ${i === products.length - 1 ? 'disabled' : ''} aria-label="Bajar">▼</button>
          </div>
        </div>
      </li>`).join('');
  }

  $('#plist').addEventListener('click', async e => {
    const li = e.target.closest('.pitem'); if (!li) return;
    const p = products.find(x => x.id === li.dataset.id);
    if (e.target.closest('[data-edit]')) return openEditor(p);
    const mv = e.target.closest('[data-move]');
    if (mv) {
      const i = products.indexOf(p), j = i + Number(mv.dataset.move);
      if (j < 0 || j >= products.length) return;
      [products[i], products[j]] = [products[j], products[i]];
      const changes = [];
      products.forEach((x, k) => { if (x.orden !== k + 1) { x.orden = k + 1; changes.push(x); } });
      renderList();
      await guard(() => Promise.all(changes.map(x => SB.update('products', 'id=eq.' + encodeURIComponent(x.id), { orden: x.orden }))), 'Orden guardado ✓').catch(loadAll);
    }
  });
  $('#plist').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[data-edit]')) { e.preventDefault(); e.target.click(); } });
  $('#plist').addEventListener('change', async e => {
    if (!e.target.matches('[data-stock]')) return;
    const id = e.target.closest('.pitem').dataset.id, p = products.find(x => x.id === id);
    const val = e.target.checked;
    try {
      await guard(() => SB.update('products', 'id=eq.' + encodeURIComponent(id), { disponible: val }), val ? 'Marcado con stock ✓' : 'Marcado sin stock');
      p.disponible = val; renderList();
    } catch (_) { e.target.checked = !val; }
  });

  /* ---------- editor ---------- */
  const form = $('#productForm');
  function openEditor(p) {
    editing = p || null; pendingPhoto = null;
    form.reset(); $('#productError').hidden = true;
    $('#sheetTitle').textContent = p ? 'Editar producto' : 'Nuevo producto';
    $('#deleteProduct').hidden = !p;
    const v = p || { disponible: true, en_mix: false, a_pedido: false };
    form.nombre.value = v.nombre || '';
    form.descripcion.value = v.descripcion || '';
    form.precio_medio.value = v.precio_medio ?? '';
    form.precio_kilo.value = v.precio_kilo ?? '';
    form.unidades.value = v.unidades || '';
    form.tags.value = (v.tags || []).join(', ');
    form.opciones.value = (v.opciones || []).join('\n');
    form.disponible.checked = !!v.disponible;
    form.a_pedido.checked = !!v.a_pedido;
    form.en_mix.checked = !!v.en_mix;
    $('#photoPreview').src = imgSrc(v.img);
    $('#sheet').hidden = false; $('#sheetBg').hidden = false; document.body.style.overflow = 'hidden';
    $('#sheet').scrollTop = 0;
    setTimeout(() => form.nombre.focus(), 60);
  }
  function closeEditor() { $('#sheet').hidden = true; $('#sheetBg').hidden = true; document.body.style.overflow = ''; editing = null; pendingPhoto = null; }
  $('#newProduct').addEventListener('click', () => openEditor(null));
  $('#closeSheet').addEventListener('click', closeEditor);
  $('#sheetBg').addEventListener('click', closeEditor);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#sheet').hidden) closeEditor(); });

  // achicar la foto en el celular antes de subirla
  async function shrink(file, max = 1400, quality = .85) {
    const url = URL.createObjectURL(file);
    try {
      const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('No se pudo leer la imagen.')); i.src = url; });
      const s = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
      const c = document.createElement('canvas'); c.width = Math.round(im.naturalWidth * s); c.height = Math.round(im.naturalHeight * s);
      const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(im, 0, 0, c.width, c.height);
      return await new Promise((res, rej) => c.toBlob(b => b ? res(b) : rej(new Error('No se pudo procesar la imagen.')), 'image/jpeg', quality));
    } finally { URL.revokeObjectURL(url); }
  }
  $('#photoInput').addEventListener('change', async e => {
    const f = e.target.files && e.target.files[0]; if (!f) return;
    if (!f.type.startsWith('image/')) return toast('Elegí una imagen.', true);
    try {
      pendingPhoto = await shrink(f);
      $('#photoPreview').src = URL.createObjectURL(pendingPhoto);
      toast(`Foto lista (${Math.round(pendingPhoto.size / 1024)} KB). Tocá «Guardar».`);
    } catch (err) { toast(err.message, true); }
    e.target.value = '';
  });

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const err = $('#productError');
    const nombre = form.nombre.value.trim();
    if (!nombre) { err.textContent = 'Poné un nombre.'; err.hidden = false; return; }
    err.hidden = true;
    const row = {
      nombre,
      descripcion: form.descripcion.value.trim(),
      precio_medio: price(form.precio_medio.value),
      precio_kilo: price(form.precio_kilo.value),
      unidades: form.unidades.value.trim(),
      tags: form.tags.value.split(',').map(s => s.trim()).filter(Boolean),
      opciones: lines(form.opciones.value),
      disponible: form.disponible.checked,
      a_pedido: form.a_pedido.checked,
      en_mix: form.en_mix.checked
    };
    let id = editing && editing.id;
    if (!id) {
      id = slug(nombre); let n = 2; const base = id;
      while (products.some(p => p.id === id)) id = `${base}-${n++}`;
      row.id = id;
      row.orden = products.reduce((m, p) => Math.max(m, p.orden || 0), 0) + 1;
    }
    try {
      await guard(async () => {
        if (pendingPhoto) row.img = await SB.upload(`productos/${id}-${Date.now()}.jpg`, pendingPhoto, 'image/jpeg');
        if (editing) await SB.update('products', 'id=eq.' + encodeURIComponent(id), row);
        else await SB.insert('products', { img: '', ...row });
      }, 'Guardado ✓');
      closeEditor(); await loadAll();
    } catch (_) { /* el toast ya mostró el error */ }
  });

  $('#deleteProduct').addEventListener('click', async () => {
    if (!editing) return;
    if (!confirm(`¿Eliminar «${editing.nombre}»? No se puede deshacer.`)) return;
    try {
      await guard(() => SB.remove('products', 'id=eq.' + encodeURIComponent(editing.id)), 'Producto eliminado');
      closeEditor(); await loadAll();
    } catch (_) {}
  });

  /* ---------- datos del negocio ---------- */
  const sform = $('#settingsForm');
  function diaRow(d = { dia: '', detalle: '' }) {
    return `<div class="row"><input data-dia placeholder="Ej.: Lunes y miércoles" value="${esc(d.dia)}" aria-label="Día"><input data-det placeholder="Ej.: Por la tarde" value="${esc(d.detalle)}" aria-label="Detalle"><button type="button" class="icon-btn" data-del aria-label="Quitar">✕</button></div>`;
  }
  function fillSettings() {
    const s = settings || D.settings;
    sform.whatsapp.value = s.whatsapp || '';
    sform.instagram.value = s.instagram || '';
    sform.zona.value = s.zona || '';
    sform.opciones_entrega.value = (s.opciones_entrega || []).join('\n');
    sform.precios_actualizados.value = s.precios_actualizados || '';
    sform.aviso.value = s.aviso || '';
    $('#diasRows').innerHTML = (s.dias || []).map(diaRow).join('') || diaRow();
    updateWaTest();
  }
  function updateWaTest() {
    const n = digits(sform.whatsapp.value);
    $('#waTest').href = 'https://wa.me/' + n + '?text=' + encodeURIComponent('Prueba desde el panel de Sabor del Chipá');
  }
  sform.whatsapp.addEventListener('input', updateWaTest);
  $('#addDia').addEventListener('click', () => $('#diasRows').insertAdjacentHTML('beforeend', diaRow()));
  $('#diasRows').addEventListener('click', e => { const b = e.target.closest('[data-del]'); if (b) b.closest('.row').remove(); });
  sform.addEventListener('submit', async e => {
    e.preventDefault();
    const wa = digits(sform.whatsapp.value);
    if (wa.length < 10 || wa.length > 15) return toast('Revisá el número de WhatsApp: tiene que tener entre 10 y 15 dígitos, con código de país.', true);
    const patch = {
      whatsapp: wa,
      instagram: sform.instagram.value.trim(),
      zona: sform.zona.value.trim(),
      dias: $$('#diasRows .row').map(r => ({ dia: $('[data-dia]', r).value.trim(), detalle: $('[data-det]', r).value.trim() })).filter(d => d.dia || d.detalle),
      opciones_entrega: lines(sform.opciones_entrega.value),
      precios_actualizados: sform.precios_actualizados.value.trim(),
      aviso: sform.aviso.value.trim()
    };
    try {
      const r = await guard(() => SB.update('settings', 'id=eq.1', patch), 'Datos guardados ✓');
      if (r && r[0]) settings = r[0];
      fillSettings();
    } catch (_) {}
  });

  /* ---------- cuenta ---------- */
  $('#pwForm').addEventListener('submit', async e => {
    e.preventDefault();
    const f = e.currentTarget;
    const a = f.pw1.value, b = f.pw2.value;
    if (a.length < 8) return toast('La contraseña tiene que tener al menos 8 caracteres.', true);
    if (a !== b) return toast('Las contraseñas no coinciden.', true);
    try { await guard(() => SB.setPassword(a), 'Contraseña cambiada ✓'); f.reset(); } catch (_) {}
  });
  $('#logout').addEventListener('click', async () => { await SB.signOut(); show('login'); showLoginError(''); });

  boot();
})();
