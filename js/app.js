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
  const CACHE = 'sabor-datos-v2'; // v2: categorías y fotos extra
  const imgSrc = v => {
    if (!v) return 'img/logo-200.png';
    if (/^(https?:|data:|blob:)/.test(v)) return v;
    return (window.__INLINE_IMG && window.__INLINE_IMG[v]) || v;
  };
  // foto principal + fotos extra, sin repetidas
  const photosOf = p => [...new Set([p.img, ...(Array.isArray(p.fotos) ? p.fotos : [])].filter(Boolean))];
  // categorías de la carta (el orden de acá es el orden en la web)
  const CATS = [
    { id: 'clasicos', nombre: 'Clásicos', sub: 'Siempre disponibles. La base de todas las variedades.' },
    { id: 'formas', nombre: 'Formas especiales', sub: 'La misma masa de siempre, en galletita, bolita o grisín.' },
    { id: 'especiales', nombre: 'Especiales', sub: 'Rellenos, para sánguche, gourmet y veganos.' }
  ];
  const catOf = p => (CATS.some(c => c.id === p.categoria) ? p.categoria : 'especiales');
  const BULK_KG = 3;

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
    $$('[data-wa-link]').forEach(a => a.href = waBase() + '?text=' + encodeURIComponent('¡Hola! Quiero hacer una consulta sobre el chipá.'));
    $$('[data-wa-bulk]').forEach(a => a.href = waBase() + '?text=' + encodeURIComponent(`¡Hola! Quiero consultar el precio por más de ${BULK_KG} kilos de chipá.`));
    $$('[data-ig-link]').forEach(a => { a.href = S.instagram || '#'; a.hidden = !S.instagram; });
    const ig = (String(S.instagram || '').match(/instagram\.com\/([^/?#]+)/i) || [])[1];
    if (ig) $$('[data-ig-handle]').forEach(el => el.textContent = '@' + ig);
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
  function mediaHtml(p, tags) {
    const fotos = photosOf(p);
    const tagsHtml = `<div class="card-tags">${tags.map(tagHtml).join('')}</div>`;
    if (!fotos.length) return `<div class="card-media card-media-ph"><svg class="ph-sol" aria-hidden="true"><use href="#sol"/></svg><span class="ph-name">${esc(p.nombre)}</span><small>Foto próximamente</small>${tagsHtml}</div>`;
    const many = fotos.length > 1;
    const imgs = fotos.map((f, i) => `<img src="${esc(imgSrc(f))}" alt="${esc(p.nombre)}${many ? ` (foto ${i + 1} de ${fotos.length})` : ''}" loading="lazy" decoding="async">`).join('');
    if (!many) return `<div class="card-media">${imgs}${tagsHtml}</div>`;
    return `<div class="card-media has-gallery">
          <div class="card-track" tabindex="0" role="region" aria-label="Fotos de ${esc(p.nombre)}. Deslizá para ver más.">${imgs}</div>
          <button class="g-nav g-prev" type="button" data-g="-1" aria-label="Foto anterior"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <button class="g-nav g-next" type="button" data-g="1" aria-label="Foto siguiente"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
          <div class="card-dots" aria-hidden="true">${fotos.map((_, i) => `<i${i ? '' : ' class="on"'}></i>`).join('')}</div>${tagsHtml}</div>`;
  }

  let filtro = 'todos';
  function groupsNow() {
    const list = sorted();
    return CATS.map(c => ({ ...c, items: list.filter(p => catOf(p) === c.id) })).filter(g => g.items.length);
  }
  function renderFilters(groups) {
    const bar = $('#catFilters'); if (!bar) return;
    bar.hidden = groups.length < 2;
    const total = groups.reduce((a, g) => a + g.items.length, 0);
    const chip = (id, nombre, n) => `<button type="button" data-cat="${id}" aria-pressed="${filtro === id}">${esc(nombre)} <small>${n}</small></button>`;
    bar.innerHTML = chip('todos', 'Todas', total) + groups.map(g => chip(g.id, g.nombre, g.items.length)).join('');
  }
  function cardHtml(p, wide) {
      const off = p.disponible === false;
      const tags = [...(p.tags || [])]; if (p.a_pedido && !tags.some(t => /pedido/i.test(t))) tags.push('A pedido');
      const firstOn = p.precio_medio != null || p.precio_kilo == null;
      return `
      <article class="card${off ? ' is-unavailable' : ''}${wide ? ' card-wide' : ''}" data-id="${esc(p.id)}">
        ${mediaHtml(p, tags)}
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
  }
  function renderGrid() {
    const groups = groupsNow();
    if (filtro !== 'todos' && !groups.some(g => g.id === filtro)) filtro = 'todos';
    renderFilters(groups);
    const show = filtro === 'todos' ? groups : groups.filter(g => g.id === filtro);
    const withHeads = groups.length > 1;
    $('#productGrid').innerHTML = show.map(g =>
      (withHeads ? `<header class="grid-group"><h3 class="h3">${esc(g.nombre)}</h3><p>${esc(g.sub)}</p></header>` : '') +
      g.items.map(p => cardHtml(p, g.items.length === 1)).join('')).join('') || '<p class="section-sub">Pronto vas a ver acá nuestras variedades.</p>';
    renderMix();
    renderReels();
  }

  // filtros por categoría
  $('#catFilters')?.addEventListener('click', e => {
    const b = e.target.closest('[data-cat]'); if (!b || b.dataset.cat === filtro) return;
    filtro = b.dataset.cat;
    renderGrid();
    window.SaborFX?.cardsSwap?.();
    const top = $('#productGrid').getBoundingClientRect().top;
    const offset = $('#nav').offsetHeight + $('#catFilters').offsetHeight + 24;
    if (top < offset || top > innerHeight * .6) scrollTo({ top: scrollY + top - offset, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  });

  // galería de fotos en cada tarjeta: puntitos + flechas
  let galleryRaf = 0;
  $('#productGrid').addEventListener('scroll', e => {
    const t = e.target; if (!t.classList || !t.classList.contains('card-track')) return;
    cancelAnimationFrame(galleryRaf);
    galleryRaf = requestAnimationFrame(() => {
      const i = Math.round(t.scrollLeft / Math.max(1, t.clientWidth));
      $$('.card-dots i', t.parentElement).forEach((d, k) => d.classList.toggle('on', k === i));
    });
  }, true);
  // si una foto no carga (por ejemplo, la borraron del bucket), no queda el ícono de imagen rota
  $('#productGrid').addEventListener('error', e => {
    const img = e.target; if (img.tagName !== 'IMG') return;
    const media = img.closest('.card-media'); if (!media) return;
    const track = img.closest('.card-track');
    if (track && track.children.length > 1) {
      $$('.card-dots i', media)[[...track.children].indexOf(img)]?.remove();
      img.remove();
      if (track.children.length === 1) $$('.g-nav, .card-dots', media).forEach(x => x.remove());
      return;
    }
    const nombre = $('.card-body .h3', media.closest('.card'))?.textContent || '';
    (track || img).remove();
    media.classList.add('card-media-ph');
    media.insertAdjacentHTML('afterbegin', `<svg class="ph-sol" aria-hidden="true"><use href="#sol"/></svg><span class="ph-name">${esc(nombre)}</span><small>Foto próximamente</small>`);
  }, true);
  function slide(track, dir) {
    const n = track.children.length, w = track.clientWidth;
    const i = Math.round(track.scrollLeft / Math.max(1, w));
    const next = (i + dir + n) % n;
    track.scrollTo({ left: next * w, behavior: 'smooth' });
  }
  function renderMix() {
    const opts = sorted().filter(p => p.en_mix && p.disponible !== false);
    $('#mix').hidden = opts.length < 2;
    $('#mixOptions').innerHTML = opts.map(p => `<label><input type="checkbox" value="${esc(p.nombre)}"><span>${esc(p.nombre.replace(/^Chipá\s+/i, '').replace(/\s+de chipá$/i, ''))}</span></label>`).join('');
  }

  $('#productGrid').addEventListener('keydown', e => {
    if (!e.target.classList.contains('card-track') || !/^Arrow(Left|Right)$/.test(e.key)) return;
    e.preventDefault(); slide(e.target, e.key === 'ArrowRight' ? 1 : -1);
  });
  $('#productGrid').addEventListener('click', e => {
    const g = e.target.closest('[data-g]');
    if (g) { slide($('.card-track', g.parentElement), +g.dataset.g); return; }
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

  // ---------- videos: botón con el precio actual y reproducción automática ----------
  function renderReels() {
    $$('[data-reel]').forEach(r => {
      const p = byId(r.dataset.product), btn = $('[data-reel-add]', r);
      const ok = !!p && p.disponible !== false && p.precio_medio != null;
      btn.hidden = !ok;
      if (ok) btn.innerHTML = `Sumar ½ kg <span>${money(p.precio_medio)}</span>`;
    });
  }
  const reels = $('#reels');
  if (reels) {
    const vids = $$('[data-reel] video', reels);
    const reelOf = v => v.closest('[data-reel]');
    const playReel = v => { const pr = v.play(); if (pr && pr.catch) pr.catch(() => reelOf(v).classList.remove('is-playing')); };
    vids.forEach(v => {
      v.addEventListener('play', () => reelOf(v).classList.add('is-playing'));
      v.addEventListener('pause', () => reelOf(v).classList.remove('is-playing'));
    });
    reels.addEventListener('click', e => {
      const add = e.target.closest('[data-reel-add]');
      if (add) {
        const r = add.closest('[data-reel]'), p = byId(r.dataset.product); if (!p) return;
        const opts = p.opciones || [];
        const opt = opts.includes(r.dataset.opt) ? r.dataset.opt : (opts[0] || '');
        addItem({ id: p.id, size: 'medio', opt });
        window.SaborFX?.fly(add);
        toast(`Sumaste ${p.nombre} ½ kg${opt ? ' · ' + opt.charAt(0).toLowerCase() + opt.slice(1) : ''} 🙌`);
        return;
      }
      const media = e.target.closest('.reel-media'); if (!media) return;
      const v = $('video', media);
      if (v.paused) { delete v.dataset.userPaused; playReel(v); } else { v.dataset.userPaused = '1'; v.pause(); }
    });
    reels.addEventListener('keydown', e => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('reel-media')) { e.preventDefault(); e.target.click(); }
    });
    // se reproducen solos (sin sonido) cuando se ven, salvo con movimiento reducido o ahorro de datos
    const quiet = matchMedia('(prefers-reduced-motion: reduce)').matches || (navigator.connection && navigator.connection.saveData);
    if (!quiet && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(es => es.forEach(en => {
        const v = en.target;
        if (en.isIntersecting && en.intersectionRatio >= .6) { if (v.paused && !v.dataset.userPaused) playReel(v); }
        else { delete v.dataset.userPaused; if (!v.paused) v.pause(); }
      }), { threshold: [0, .6] });
      vids.forEach(v => io.observe(v));
    }
  }

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
    return { nombre: p.nombre, img: photosOf(p)[0] || '', unit: unit == null ? null : unit };
  };
  const kgOf = list => list.reduce((a, c) => a + (c.size === 'kilo' ? 1 : .5) * c.qty, 0);
  const kgText = kg => kg.toLocaleString('es-AR', { maximumFractionDigits: 1 }) + ' kg';

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
    const kg = kgOf(cart);
    $('#cartTotal').textContent = money(total);
    $('#cartKg').textContent = count ? '· ' + kgText(kg) : '';
    $('#cartNote').textContent = pending ? '+ productos y envío a confirmar' : '+ envío a coordinar';
    const bulk = $('#cartBulk');
    bulk.hidden = !(kg > BULK_KG);
    bulk.textContent = `Llevás más de ${BULK_KG} kilos: te pasamos un precio especial por WhatsApp.`;
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
    // Mensaje prolijo para WhatsApp: sin emojis (algunos WhatsApp Web los rompen) y con *negritas*
    const pedidoN = Date.now().toString(36).slice(-4).toUpperCase();
    const items = cart.map(c => {
      const info = lineInfo(c);
      const precio = info.unit != null ? money(info.unit * c.qty) : 'a confirmar';
      const opt = c.opt ? c.opt.charAt(0).toLowerCase() + c.opt.slice(1) : '';
      const detalle = c.id === 'mix' ? c.opt : [sizeLabel(c.size), opt].filter(Boolean).join(', ');
      return `• ${c.qty} × ${info.nombre}${detalle ? ` (${detalle})` : ''} — ${precio}`;
    });
    const total = cart.reduce((a, c) => a + (lineInfo(c).unit || 0) * c.qty, 0);
    const pending = cart.some(c => lineInfo(c).unit == null);
    const kg = kgOf(cart);
    const notas = String(f.get('notas') || '').trim();
    const msg = [
      '¡Hola! Quiero hacer un pedido a *Sabor del Chipá*.',
      `Pedido N.º ${pedidoN}`,
      '',
      '*Productos*',
      ...items,
      '',
      `*Total: ${money(total)}*${pending ? ' + lo que queda a confirmar' : ''} (${kgText(kg)})`,
      ...(kg > BULK_KG ? [`Son más de ${BULK_KG} kilos: ¿me pasás el precio por cantidad?`] : []),
      'El envío lo coordinamos por acá.',
      '',
      '*Datos de entrega*',
      `Nombre: ${nombre}`,
      `Dirección: ${dir}`,
      `Día: ${f.get('entrega')}`,
      `Pago: ${f.get('pago')}`,
      ...(notas ? [`Notas: ${notas}`] : []),
      '',
      '¡Gracias!'
    ].join('\n');
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
