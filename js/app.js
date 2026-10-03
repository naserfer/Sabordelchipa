/* =========================================================
   Sabor del Chipá — catálogo, pedido y WhatsApp
   Los datos vienen del panel /admin (Supabase). Si la base
   no responde, se usa la última copia guardada o js/data.js.
   ========================================================= */
(function () {
  'use strict';
  document.documentElement.classList.add('js');

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => '$' + Math.round(n).toLocaleString('es-AR');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const STORE = 'sabor-pedido-v2';
  const CACHE = 'sabor-datos-v1';
  const imgSrc = v => {
    if (!v) return 'img/logo-200.png';
    if (/^(https?:|data:|blob:)/.test(v)) return v;
    return (window.__INLINE_IMG && window.__INLINE_IMG[v]) || v;
  };

  // ---------- datos: caché → respaldo → base ----------
  let data = null;
  try { data = JSON.parse(localStorage.getItem(CACHE)); } catch (_) { data = null; }
  if (!data || !data.settings || !Array.isArray(data.products)) data = JSON.parse(JSON.stringify(window.SABOR_DEFAULTS));
  let S = data.settings, P = data.products;
  const waBase = () => 'https://wa.me/' + String(S.whatsapp || '').replace(/\D/g, '');
  const byId = id => P.find(p => p.id === id);
  const sorted = () => [...P].sort((a, b) => (a.orden || 0) - (b.orden || 0));

  // ---------- datos del negocio ----------
  function applySettings() {
    $$('[data-wa-link]').forEach(a => a.href = waBase() + '?text=' + encodeURIComponent('¡Hola! Quiero hacer una consulta sobre el chipá 🧉'));
    $$('[data-ig-link]').forEach(a => { a.href = S.instagram || '#'; a.hidden = !S.instagram; });
    $$('[data-updated]').forEach(el => el.textContent = S.precios_actualizados ? ` (actualizados en ${S.precios_actualizados})` : '');
    $$('[data-zone]').forEach(el => el.textContent = S.zona || 'CABA');
    const icons = ['🛵', '📅', '🧉'];
    $('#deliveryDays').innerHTML = (S.dias || []).map((d, i) =>
      `<li><span class="d-ico" aria-hidden="true">${icons[i % icons.length]}</span><div><b>${esc(d.dia)}</b><span>${esc(d.detalle)}</span></div></li>`).join('');
    const sel = $('#deliverySelect'), prev = sel.value;
    sel.innerHTML = (S.opciones_entrega || []).map(o => `<option>${esc(o)}</option>`).join('') + '<option>Lo coordinamos por WhatsApp</option>';
    if (prev) sel.value = prev;
    // cartel de aviso
    const aviso = (S.aviso || '').trim(), bar = $('#aviso');
    let closed = ''; try { closed = sessionStorage.getItem('aviso-cerrado') || ''; } catch (_) {}
    const showAviso = !!aviso && closed !== aviso;
    $('#avisoText').textContent = aviso;
    bar.hidden = !showAviso;
    document.documentElement.classList.toggle('has-aviso', showAviso);
  }
  $('#avisoClose').addEventListener('click', () => {
    try { sessionStorage.setItem('aviso-cerrado', (S.aviso || '').trim()); } catch (_) {}
    $('#aviso').hidden = true; document.documentElement.classList.remove('has-aviso');
  });

  // ---------- catálogo ----------
  const tagHtml = t => `<span class="${/vegan/i.test(t) ? 'tag tag-vegano' : /pedido/i.test(t) ? 'tag tag-pedido' : 'tag'}">${esc(t)}</span>`;
  const priceBtn = (size, label, val, on) =>
    `<button type="button" data-size="${size}" aria-pressed="${on}" ${val == null ? 'data-ask' : ''}><small>${label}</small><b>${val == null ? 'Consultar' : money(val)}</b></button>`;
  function renderGrid() {
    $('#productGrid').innerHTML = sorted().map(p => {
      const off = p.disponible === false;
      const tags = [...(p.tags || [])]; if (p.a_pedido && !tags.some(t => /pedido/i.test(t))) tags.push('A pedido');
      const firstOn = p.precio_medio != null || p.precio_kilo == null;
      return `
      <article class="card${off ? ' is-unavailable' : ''}" data-id="${esc(p.id)}">
        <div class="card-media"><img src="${esc(imgSrc(p.img))}" alt="${esc(p.nombre)}" loading="lazy" decoding="async"><div class="card-tags">${tags.map(tagHtml).join('')}</div></div>
        <div class="card-body">
          <h3 class="h3">${esc(p.nombre)}</h3>
          <p class="card-desc">${esc(p.descripcion)}</p>
          ${p.unidades ? `<p class="card-units">${esc(p.unidades)}</p>` : ''}
          <div class="card-foot">
            ${(p.opciones || []).length ? `<select class="select" aria-label="Variedad de ${esc(p.nombre)}">${p.opciones.map(o => `<option>${esc(o)}</option>`).join('')}</select>` : ''}
            <div class="seg" role="group" aria-label="Presentación">
              ${priceBtn('medio', '½ kg', p.precio_medio, firstOn)}${priceBtn('kilo', '1 kg', p.precio_kilo, !firstOn)}
            </div>
            <button class="btn btn-primary add-btn" type="button" data-add ${off ? 'disabled' : ''}>${off ? 'Sin stock por ahora' : 'Sumar al pedido'}</button>
          </div>
        </div>
      </article>`;
    }).join('') || '<p class="section-sub">Pronto vas a ver acá nuestras variedades.</p>';
    renderMix();
  }
  function renderMix() {
    const opts = sorted().filter(p => p.en_mix && p.disponible !== false);
    $('#mix').hidden = opts.length < 2;
    $('#mixOptions').innerHTML = opts.map(p => `<label><input type="checkbox" value="${esc(p.nombre)}"><span>${esc(p.nombre.replace(/^Chipá\s+/i, '').replace(/\s+de chipá$/i, ''))}</span></label>`).join('');
  }

  $('#productGrid').addEventListener('click', e => {
    const seg = e.target.closest('.seg button');
    if (seg) { $$('button', seg.parentElement).forEach(b => b.setAttribute('aria-pressed', String(b === seg))); return; }
    const add = e.target.closest('[data-add]');
    if (!add) return;
    const card = add.closest('.card');
    const p = byId(card.dataset.id); if (!p) return;
    const size = $('.seg [aria-pressed="true"]', card).dataset.size;
    const opt = $('select', card)?.value || '';
    addItem({ id: p.id, size, opt });
    window.SaborFX?.fly(add);
    toast(`Sumaste ${p.nombre} ${size === 'medio' ? '½ kg' : '1 kg'} 🙌`);
  });

  $('#addMix').addEventListener('click', e => {
    const chosen = $$('#mixOptions input:checked').map(i => i.value);
    if (chosen.length < 2) { toast('Elegí al menos 2 variedades para tu mix'); return; }
    addItem({ id: 'mix', size: 'medio', opt: chosen.join(' + ') });
    window.SaborFX?.fly(e.currentTarget);
    toast('Sumaste un mix de ½ kg 🙌');
    $$('#mixOptions input').forEach(i => i.checked = false);
  });

  // ---------- pedido ----------
  let cart = [];
  try { cart = JSON.parse(localStorage.getItem(STORE)) || []; } catch (_) { cart = []; }
  const save = () => { try { localStorage.setItem(STORE, JSON.stringify(cart)); } catch (_) {} };
  const keyOf = it => `${it.id}|${it.size}|${it.opt}`;
  const sizeLabel = s => (s === 'kilo' ? '1 kg' : '½ kg');
  const lineInfo = it => {
    if (it.id === 'mix') return { nombre: 'Mix ½ kg', img: 'img/bolsas-variedad.webp', unit: null };
    const p = byId(it.id); if (!p) return null;
    const unit = it.size === 'kilo' ? p.precio_kilo : p.precio_medio;
    return { nombre: p.nombre, img: p.img, unit: unit == null ? null : unit };
  };

  function addItem(it) {
    const k = keyOf(it);
    const found = cart.find(c => keyOf(c) === k);
    if (found) found.qty++; else cart.push({ ...it, qty: 1 });
    save(); renderCart(true);
  }

  function renderCart(bump) {
    cart = cart.filter(c => c.qty > 0 && lineInfo(c));
    const count = cart.reduce((a, c) => a + c.qty, 0);
    $$('[data-cart-count]').forEach(el => el.textContent = count);
    $('.cart-fab').classList.toggle('is-visible', count > 0);
    window.SaborFX?.fab(count > 0, bump);
    $('#cartEmpty').hidden = count > 0;
    $('#orderForm').hidden = count === 0;
    $('#cartTotalRow').hidden = count === 0;
    $('#cartNote').hidden = count === 0;
    $('#cartList').innerHTML = cart.map((c, i) => {
      const info = lineInfo(c);
      const sub = info.unit != null ? money(info.unit * c.qty) : 'a confirmar';
      const meta = c.id === 'mix' ? esc(c.opt) : sizeLabel(c.size) + (c.opt ? ' · ' + esc(c.opt) : '');
      return `<li class="cart-item">
        <img src="${esc(imgSrc(info.img))}" alt="">
        <div><b>${esc(info.nombre)}</b><small>${meta}</small>
          <div class="qty"><button type="button" data-q="-1" data-i="${i}" aria-label="Quitar uno">−</button><span>${c.qty}</span><button type="button" data-q="1" data-i="${i}" aria-label="Agregar uno">+</button></div>
        </div>
        <span class="ci-price">${sub}</span>
      </li>`;
    }).join('');
    const total = cart.reduce((a, c) => a + (lineInfo(c).unit || 0) * c.qty, 0);
    const pending = cart.some(c => lineInfo(c).unit == null);
    $('#cartTotal').textContent = money(total);
    $('#cartNote').textContent = pending ? '+ productos y envío a confirmar' : '+ envío a coordinar';
  }
  $('#cartList').addEventListener('click', e => {
    const b = e.target.closest('[data-q]'); if (!b) return;
    cart[+b.dataset.i].qty += +b.dataset.q; save(); renderCart();
  });

  // ---------- panel del pedido ----------
  const drawer = $('#drawer'), overlay = $('#overlay');
  let lastFocus = null;
  function openCart() {
    lastFocus = document.activeElement;
    overlay.hidden = false; drawer.classList.add('is-open'); drawer.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    window.SaborFX?.drawer(true);
    setTimeout(() => $('#closeCart').focus(), 50);
  }
  function closeCart() {
    drawer.setAttribute('aria-hidden', 'true'); document.body.style.overflow = '';
    const done = () => { drawer.classList.remove('is-open'); overlay.hidden = true; lastFocus?.focus?.(); };
    window.SaborFX ? window.SaborFX.drawer(false, done) : done();
  }
  $$('[data-open-cart]').forEach(b => b.addEventListener('click', openCart));
  $('#closeCart').addEventListener('click', closeCart);
  overlay.addEventListener('click', closeCart);
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && drawer.classList.contains('is-open')) closeCart(); });
  drawer.addEventListener('click', e => { if (e.target.closest('[data-close-cart]')) closeCart(); });

  // ---------- enviar por WhatsApp ----------
  $('#orderForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const nombre = String(f.get('nombre') || '').trim();
    const dir = String(f.get('direccion') || '').trim();
    const err = $('#formError');
    if (!nombre || !dir) { err.textContent = 'Completá tu nombre y tu barrio o dirección.'; err.hidden = false; return; }
    err.hidden = true;
    const lines = cart.map(c => {
      const info = lineInfo(c);
      const price = info.unit != null ? money(info.unit * c.qty) : 'precio a confirmar';
      const size = c.id === 'mix' ? '' : ` (${sizeLabel(c.size)})`;
      return `• ${c.qty} × ${info.nombre}${size}${c.opt ? ' — ' + c.opt : ''}: ${price}`;
    });
    const total = cart.reduce((a, c) => a + (lineInfo(c).unit || 0) * c.qty, 0);
    const pending = cart.some(c => lineInfo(c).unit == null);
    const notas = String(f.get('notas') || '').trim();
    const msg = [
      '¡Hola! Quiero hacer un pedido 🧀🧉', '',
      ...lines, '',
      `Total productos: ${money(total)}${pending ? ' + lo que hay que confirmar' : ''} (envío a coordinar)`, '',
      `Nombre: ${nombre}`,
      `Dirección / barrio: ${dir}`,
      `Entrega: ${f.get('entrega')}`,
      `Pago: ${f.get('pago')}`,
      notas ? `Notas: ${notas}` : ''
    ].filter((l, i, a) => !(l === '' && a[i - 1] === '')).join('\n').trim();
    window.open(waBase() + '?text=' + encodeURIComponent(msg), '_blank', 'noopener');
  });

  // ---------- toast ----------
  let tt;
  function toast(text) {
    const el = $('#toast'); el.textContent = text;
    window.SaborFX ? window.SaborFX.toast(el) : (el.style.opacity = 1);
    clearTimeout(tt); tt = setTimeout(() => window.SaborFX ? window.SaborFX.toast(el, true) : (el.style.opacity = 0), 2200);
  }

  // ---------- nav ----------
  const nav = $('#nav');
  addEventListener('scroll', () => nav.classList.toggle('is-scrolled', scrollY > 10), { passive: true });

  // ---------- primer render + datos frescos de la base ----------
  function renderAll() { applySettings(); renderGrid(); renderCart(); }
  renderAll();

  if (window.SB && SB.configured) {
    const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), 8000));
    Promise.race([Promise.all([
      SB.select('settings', 'select=*&id=eq.1'),
      SB.select('products', 'select=*&order=orden.asc')
    ]), timeout]).then(([s, p]) => {
      if (s && s[0]) S = s[0];
      if (Array.isArray(p)) P = p;
      try { localStorage.setItem(CACHE, JSON.stringify({ settings: S, products: P, at: Date.now() })); } catch (_) {}
      renderAll();
      window.SaborFX?.cardsReady?.();
    }).catch(err => console.warn('Usando datos guardados:', err.message));
  }

  window.SaborUI = { openCart, closeCart, toast };
})();
