/* =========================================================
   Sabor del Chipá — animaciones con anime.js v4
   Arriba de todo: el video del horno (crudos → dorados) con el
   reloj, la barra y los pasos sincronizados al video.
   ========================================================= */
(function () {
  'use strict';
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

  /* ---------------------------------------------------------
     1. HERO: video del horno
        Se repite en bucle, sin sonido, mientras se ve: los chipás se
        doran, se quedan un momento listos y vuelve a empezar.
        El reloj va de 0 a 20 min al ritmo del video y los pasos
        se marcan solos. Fuera de pantalla se pausa.
        Con movimiento reducido o ahorro de datos no arranca solo:
        se ve el chipá ya dorado y un botón para mirarlo una vez.
        No depende de anime.js (si no carga, el video igual anda).
     --------------------------------------------------------- */
  (function ovenHero() {
    const win = $('#ovenWindow'), video = $('#ovenVideo');
    if (!win || !video) return;
    const btn = $('#ovenPlay');
    const timeEl = $('#timeVal'), bar = $('#ovenProgress'), steps = $$('#horno .step');
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    const looping = !reduce && !saveData;
    const HOLD = 1800, FADE = 350;   // cuánto se queda en el chipá dorado y cuánto dura el fundido
    let lastStep = -1, lastMin = -1, lastP = -1, raf = 0, started = false, visible = false, holdT = 0;

    function setStep(i) {
      if (i === lastStep) return;
      steps.forEach((s, k) => { s.classList.toggle('is-active', k === i); s.classList.toggle('is-done', k < i); });
      lastStep = i;
    }
    function render(p) {
      p = clamp(p);
      const min = Math.round(p * 20);
      if (min !== lastMin) { lastMin = min; timeEl.textContent = min; }
      if (Math.abs(p - lastP) > .002 || p === 0 || p === 1) {
        lastP = p;
        bar.style.width = (p * 100).toFixed(1) + '%';
        win.style.setProperty('--p', p.toFixed(3));
      }
      // 1 del freezer · 2 horno a 200 °C · 3 se dora · 4 ¡listo!
      setStep(p >= .985 ? 3 : p > .26 ? 2 : p > .1 ? 1 : 0);
    }
    const progress = () => (video.duration ? video.currentTime / video.duration : 0);
    function tick() {
      render(progress());
      if (!video.paused && !video.ended) raf = requestAnimationFrame(tick);
    }
    function play() {
      started = true;
      const pr = video.play();
      // si el navegador no deja arrancar solo (p. ej. iPhone en modo ahorro), queda el botón
      if (pr && pr.catch) pr.catch(() => { btn.hidden = false; });
    }
    // vuelta a empezar: fundido corto a oscuro y de nuevo los chipás crudos
    function restart() {
      clearTimeout(holdT);
      if (!visible) return;   // se retoma cuando la ventana vuelva a verse
      win.classList.add('is-fading');
      holdT = setTimeout(() => {
        video.currentTime = 0; render(0);
        win.classList.remove('is-fading');
        play();
      }, FADE);
    }

    video.addEventListener('play', () => {
      btn.hidden = true; win.classList.remove('is-done');
      cancelAnimationFrame(raf); raf = requestAnimationFrame(tick);
    });
    video.addEventListener('ended', () => {
      cancelAnimationFrame(raf); render(1);
      win.classList.add('is-done');
      if (looping) holdT = setTimeout(restart, HOLD);
      else btn.hidden = false;   // movimiento reducido: queda en el chipá dorado
    });
    btn.addEventListener('click', () => {
      if (video.ended || video.currentTime > 0) video.currentTime = 0;
      play();
    });
    // si el video no carga, mostramos la foto del chipá dorado
    const lastSource = $$('source', video).pop();
    if (lastSource) lastSource.addEventListener('error', () => { video.poster = video.dataset.posterEnd; render(1); btn.hidden = true; });

    if (!looping) {
      video.poster = video.dataset.posterEnd;
      render(1);
      btn.hidden = false;
      return;
    }
    render(0);
    video.preload = 'auto';
    if (!('IntersectionObserver' in window)) { visible = true; video.loop = true; play(); return; }
    // arranca cuando la ventana del horno se ve (medio segundo después, para que se lea el título)
    // y se pausa cuando sale de la pantalla
    new IntersectionObserver(entries => {
      visible = entries[entries.length - 1].isIntersecting;
      if (!visible) {
        clearTimeout(holdT); win.classList.remove('is-fading');
        if (!video.paused) video.pause();
        return;
      }
      if (!started) { setTimeout(() => { if (visible && !started) play(); }, 500); return; }
      if (video.ended) restart();
      else if (video.paused && btn.hidden) play();
    }, { threshold: .25 }).observe(win);
  })();

  if (!window.anime) { document.documentElement.classList.remove('js'); return; }
  const { animate, createTimeline, stagger, svg, utils } = window.anime;

  /* ---------------------------------------------------------
     2. Intro al cargar
     --------------------------------------------------------- */
  if (!reduce) {
    animate('.hero-title .word', { y: ['110%', '0%'], opacity: [0, 1], duration: 1100, delay: stagger(70, { start: 150 }), ease: 'outExpo' });
    animate('[data-intro]', { y: [18, 0], opacity: [0, 1], duration: 900, delay: stagger(120, { start: 450 }), ease: 'outExpo' });
    animate('.steps .step', { x: [-16, 0], opacity: { from: 0 }, duration: 800, delay: stagger(70, { start: 650 }), ease: 'outExpo',
      onComplete: () => $$('.steps .step').forEach(s => { s.style.opacity = ''; s.style.transform = ''; }) });
    animate('.oven-window', { y: [26, 0], opacity: [0, 1], duration: 1100, delay: 200, ease: 'outExpo' });
    animate('.nav', { y: ['-100%', '0%'], duration: 900, ease: 'outExpo' });
  }


  /* ---------------------------------------------------------
     2a. "Hacé tu pedido": al tocarlo, un cartelito explica qué hacer
         al llegar a las variedades.
     --------------------------------------------------------- */
  const orderBtn = $('[data-order-cta]');
  if (orderBtn) orderBtn.addEventListener('click', () => {
    const toastEl = $('#toast');
    if (!toastEl || !window.SaborFX) return;
    setTimeout(() => {
      const msg = 'Elegí tus chipás y tocá «Sumar al pedido»';
      toastEl.textContent = msg;
      window.SaborFX.toast(toastEl);
      setTimeout(() => { if (toastEl.textContent === msg) window.SaborFX.toast(toastEl, true); }, 4000);
    }, 700);
  });

  /* ---------------------------------------------------------
     3. Marquee
     --------------------------------------------------------- */
  if (!reduce) {
    animate('.marquee-track', { x: ['0%', '-50%'], duration: 40000, ease: 'linear', loop: true });
    animate('.m-sol', { rotate: '1turn', duration: 9000, loop: true, ease: 'linear' });
    if (!$('#aviso').hidden) animate('#aviso', { y: ['-100%', '0%'], opacity: [0, 1], duration: 700, delay: 600, ease: 'outExpo' });
  }

  /* ---------------------------------------------------------
     3a. "Escribinos": cuando le pasás el mouse, no te suelta por 4 segundos.
         El botón sigue al cursor con una correa elástica (se estira, pero no se
         va más lejos que LEASH), muestra un globito con cuenta regresiva y
         suelta con un rebote. Solo con mouse y sin movimiento reducido.
     --------------------------------------------------------- */
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const HOLD = 4000, LEASH = 190, COOLDOWN = 2500;
    const LINES = ['¡Ey, no te vayas! 🧉', 'Escribinos, dale 😄'];
    $$('[data-magnet]').forEach(btn => {
      const bubble = document.createElement('span');
      bubble.className = 'magnet-bubble'; bubble.setAttribute('aria-hidden', 'true');
      bubble.innerHTML = '<span class="mb-text"></span><i class="mb-bar"></i>';
      btn.appendChild(bubble);
      const text = $('.mb-text', bubble), bar = $('.mb-bar', bubble), icon = $('svg', btn);
      let held = false, busy = false, t0 = 0, mx = 0, my = 0, raf = 0, timers = [], cooldownUntil = 0;

      // centro del botón "en reposo" (offsetLeft/Top no incluyen la traslación que le damos)
      const home = () => {
        const op = btn.offsetParent || document.body, r = op.getBoundingClientRect();
        return { x: r.left + btn.offsetLeft + btn.offsetWidth / 2, y: r.top + btn.offsetTop + btn.offsetHeight / 2 };
      };
      function follow() {
        raf = 0; if (!held) return;
        const h = home(); let dx = mx - h.x, dy = my - h.y;
        const d = Math.hypot(dx, dy) || 1, k = LEASH * (1 - Math.exp(-d / LEASH)) / d;
        dx *= k; dy *= k;
        animate(btn, { x: dx, y: dy, rotate: clamp(dx / 16, -1, 1) * 8, scale: 1.06, duration: 420, ease: 'outQuad' });
      }
      const queue = () => { if (!raf) raf = requestAnimationFrame(follow); };
      const onMove = e => { mx = e.clientX; my = e.clientY; queue(); };
      function heart() {
        const r = btn.getBoundingClientRect(), h = document.createElement('span');
        h.className = 'magnet-heart'; h.textContent = Math.random() < .7 ? '💚' : '🧀';
        const side = Math.random() < .5 ? -1 : 1; // salen por los costados, así no tapan el globito
        h.style.left = (r.left + r.width / 2 + side * r.width * .46) + 'px'; h.style.top = (r.top + r.height * .3) + 'px';
        document.body.appendChild(h);
        animate(h, { y: -50 - Math.random() * 30, x: side * utils.random(14, 40), opacity: [1, 0], scale: [.5, 1.15], rotate: side * utils.random(5, 30),
          duration: 1300, ease: 'outQuad', onComplete: () => h.remove() });
      }
      function grab(e) {
        if (held || busy || performance.now() < cooldownUntil) return;
        held = true; t0 = performance.now(); mx = e.clientX; my = e.clientY;
        btn.classList.add('is-held');
        document.addEventListener('pointermove', onMove, { passive: true });
        addEventListener('scroll', queue, { passive: true });
        animate(btn, { scale: [{ to: 1.16, duration: 150, ease: 'outQuad' }, { to: 1.06, duration: 600, ease: 'outElastic(1, .45)' }] });
        if (icon) animate(icon, { rotate: [0, -18, 16, -10, 6, 0], duration: 800, ease: 'inOutSine' });
        let i = 0; text.textContent = LINES[0]; bubble.classList.add('show');
        bar.style.transition = 'none'; bar.style.transform = 'scaleX(1)'; void bar.offsetWidth;
        bar.style.transition = `transform ${HOLD}ms linear`; bar.style.transform = 'scaleX(0)';
        timers = [
          setInterval(() => { text.textContent = LINES[++i % LINES.length]; }, HOLD / LINES.length),
          setInterval(heart, 850),
          setTimeout(() => release('Bueno… te suelto 🥲'), HOLD)
        ];
        heart();
        queue();
      }
      function release(msg) {
        if (!held) return;
        held = false; busy = true;
        timers.forEach(t => { clearInterval(t); clearTimeout(t); });
        document.removeEventListener('pointermove', onMove);
        removeEventListener('scroll', queue);
        text.textContent = msg; bar.style.transition = 'none'; bar.style.transform = 'scaleX(0)';
        animate(btn, { x: 0, y: 0, rotate: 0, scale: 1, duration: 1500, ease: 'outElastic(1, .35)' });
        setTimeout(() => bubble.classList.remove('show'), 1300);
        setTimeout(() => {
          btn.classList.remove('is-held'); btn.style.transform = '';
          busy = false; cooldownUntil = performance.now() + COOLDOWN;
        }, 1550);
      }
      btn.addEventListener('pointerenter', grab);
      btn.addEventListener('click', () => { if (held) setTimeout(() => release('¡Gracias! Te esperamos 💚'), 150); });
    });
  }

  /* ---------------------------------------------------------
     3b. Mate y chipá: el termo ceba, sube la espuma y el vapor
     --------------------------------------------------------- */
  onceVisible($('#mateSvg'), () => {
    if (reduce) return;
    const water = svg.createDrawable('#mateWater');
    utils.set(water, { draw: '0 0' });
    const mt = createTimeline({ loop: true, loopDelay: 1600 });
    mt.add('#termo', { rotate: -40, x: -8, y: -18, duration: 750, ease: 'inOutSine' })
      .add(water, { draw: ['0 0', '0 1'], duration: 380, ease: 'inQuad' })
      .add('#mateFoam', { opacity: [0, 1], scale: [.5, 1], duration: 500, ease: 'outQuad' }, '-=120')
      .add(water, { draw: ['0 1', '1 1'], duration: 320, ease: 'outQuad' }, '+=600')
      .add('#termo', { rotate: 0, x: 0, y: 0, duration: 750, ease: 'inOutSine' }, '-=200')
      .add('#mateFoam', { opacity: 0, duration: 700 }, '+=700');
    animate('.mate-steam', { y: [0, -16], opacity: [{ from: 0, to: .9, duration: 500 }, { to: 0, duration: 1500 }], duration: 2000, loop: true, delay: stagger(600), ease: 'outSine' });
    animate('.mate-sun', { rotate: '1turn', duration: 70000, loop: true, ease: 'linear' });
    animate('.mini', { y: [0, -4], duration: 1800, alternate: true, loop: true, ease: 'inOutSine' });
  }, '-5% 0px');

  /* ---------------------------------------------------------
     4. Revelados al entrar en pantalla
     --------------------------------------------------------- */
  function onceVisible(target, cb, margin = '-12% 0px') {
    if (!target) return;
    if (reduce) { cb(); return; }
    const io = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { io.disconnect(); cb(); } }), { rootMargin: margin });
    io.observe(target);
  }
  // bloques de texto por sección
  $$('section').forEach(sec => {
    const items = $$('.reveal', sec).filter(x => !x.closest('.anatomy-stage'));
    if (!items.length) return;
    onceVisible(sec, () => {
      if (reduce) { items.forEach(i => i.style.opacity = 1); return; }
      animate(items, { y: [28, 0], opacity: [0, 1], duration: 1000, delay: stagger(90), ease: 'outExpo' });
    });
  });
  // tarjetas del catálogo
  function cardsIn() {
    const cards = $$('#productGrid .card');
    if (reduce) return;
    cards.forEach(c => c.style.opacity = 0);
    onceVisible($('#productGrid'), () => animate(cards, { y: [60, 0], opacity: [0, 1], scale: [.96, 1], duration: 1100, delay: stagger(90), ease: 'outExpo' }), '-8% 0px');
  }
  cardsIn();

  // tilt suave en las tarjetas (solo con mouse).
  // Sobre los controles (variedad, ½ kg / 1 kg, botón) la tarjeta queda derecha: si está
  // inclinada en 3D cuando se abre un <select>, Chrome dibuja la lista desplegable corrida.
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    const level = (c, ms) => { c._flat = true; animate(c, { rotateX: 0, rotateY: 0, duration: ms, ease: 'outQuad' }); };
    const picking = c => { const a = document.activeElement; return !!a && a.tagName === 'SELECT' && c.contains(a); };
    document.addEventListener('pointerdown', e => {
      const c = e.target.closest?.('.card');
      if (c && e.target.closest('select')) { level(c, 0); c.style.transform = 'none'; }
    }, true);
    document.addEventListener('pointermove', e => {
      const c = e.target.closest?.('.card'); if (!c) return;
      if (e.target.closest('.card-foot') || picking(c)) { if (!c._flat) level(c, 160); return; }
      c._flat = false;
      const r = c.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -6, ry = ((e.clientX - r.left) / r.width - .5) * 6;
      animate(c, { rotateX: rx, rotateY: ry, duration: 400, ease: 'outQuad' });
    });
    document.addEventListener('pointerout', e => {
      const c = e.target.closest?.('.card');
      if (c && !c.contains(e.relatedTarget) && !c._flat && !picking(c)) animate(c, { rotateX: 0, rotateY: 0, duration: 700, ease: 'outElastic(1, .5)' });
    });
  }

  // anatomía: se dibujan las líneas y aparecen los puntos
  onceVisible($('.anatomy-stage'), () => {
    const lines = $$('.a-line'); const items = $$('.a-item');
    if (reduce) { items.forEach(i => i.style.opacity = 1); return; }
    const isGrid = getComputedStyle($('.anatomy-lines')).display === 'none';
    animate('.anatomy-photo', { scale: [.6, 1], opacity: [0, 1], duration: 1200, ease: 'outElastic(1, .6)' });
    if (!isGrid) animate(svg.createDrawable(lines), { draw: ['0 0', '0 1'], duration: 900, delay: stagger(110, { start: 300 }), ease: 'inOutQuad' });
    animate(items, { opacity: [0, 1], scale: [.85, 1], duration: 800, delay: stagger(110, { start: isGrid ? 200 : 700 }), ease: 'outBack(1.6)' });
    animate('.anatomy-photo img', { rotate: '1turn', duration: 90000, loop: true, ease: 'linear' });
  });
  $$('.a-item').forEach(i => { if (!reduce) i.style.opacity = 0; });

  // envíos: la moto cruza
  onceVisible($('.road'), () => {
    if (reduce) return;
    const road = $('.road'), rider = $('.rider');
    const run = () => {
      const w = road.clientWidth;
      animate(rider, { x: [-200, w + 20], duration: 4400, ease: 'inOutSine', onComplete: () => setTimeout(run, 900) });
    };
    run();
    animate('.moto-body', { y: [0, -3], duration: 220, alternate: true, loop: true, ease: 'inOutSine' });
    animate('.wheel', { rotate: '1turn', duration: 500, loop: true, ease: 'linear' });
    animate('.moto-scarf', { rotate: [-5, 7], scaleX: [1, 1.08], duration: 260, alternate: true, loop: true, ease: 'inOutSine' });
    animate('.puff', { opacity: [{ to: .9, duration: 120 }, { to: 0, duration: 680 }], scale: [.4, 2.2], x: [0, -46], y: [0, -16], duration: 800, loop: true, delay: stagger(260), ease: 'outQuad' });
    animate('.cloud', { x: [0, 30], duration: 6000, alternate: true, loop: true, ease: 'inOutSine', delay: stagger(1200) });
    const flagA = {
      b1: 'M324 16 C336 14 344 17 352 14 L350 21 C342 23 334 20 324 22 Z',
      w:  'M324 22 C336 20 344 23 350 21 L348 28 C340 30 332 27 324 28 Z',
      b2: 'M324 28 C336 26 344 29 348 28 L346 35 C338 36 330 33 324 34 Z'
    };
    const flagB = {
      b1: 'M324 16 C336 19 344 15 352 18 L350 24 C342 22 334 25 324 22 Z',
      w:  'M324 22 C336 25 344 21 350 24 L348 30 C340 28 332 31 324 28 Z',
      b2: 'M324 28 C336 31 344 27 348 31 L346 37 C338 34 330 36 324 34 Z'
    };
    animate('.flag-b1', { d: [flagA.b1, flagB.b1], duration: 780, alternate: true, loop: true, ease: 'inOutSine' });
    animate('.flag-w', { d: [flagA.w, flagB.w], duration: 780, alternate: true, loop: true, ease: 'inOutSine' });
    animate('.flag-b2', { d: [flagA.b2, flagB.b2], duration: 780, alternate: true, loop: true, ease: 'inOutSine' });
    animate('.flag-cloth', { rotate: [-6, 8], duration: 1100, alternate: true, loop: true, ease: 'inOutSine' });
  });

  /* ---------------------------------------------------------
     5. FX del pedido (los usa app.js)
     --------------------------------------------------------- */
  const fab = $('.cart-fab');
  let fabShown = false;
  window.SaborFX = {
    fly(fromEl, img) {
      if (reduce || !fromEl) return;
      const a = fromEl.getBoundingClientRect(), b = fab.getBoundingClientRect();
      const dot = document.createElement('div'); dot.className = 'fly';
      dot.style.left = (a.left + a.width / 2) + 'px'; dot.style.top = (a.top + a.height / 2) + 'px';
      document.body.appendChild(dot);
      const dx = (b.left + b.width / 2) - (a.left + a.width / 2), dy = (b.top + b.height / 2) - (a.top + a.height / 2);
      animate(dot, {
        x: { to: dx, ease: 'inOutSine' },
        y: [{ to: Math.min(-80, dy * .3) - 60, duration: 380, ease: 'outQuad' }, { to: dy, duration: 420, ease: 'inQuad' }],
        scale: [{ to: 1.3, duration: 300 }, { to: .45, duration: 500 }],
        rotate: '1turn',
        duration: 800,
        onComplete: () => { dot.remove(); window.SaborFX.bump(); }
      });
    },
    bump() {
      animate(fab, { scale: [{ to: 1.22, duration: 140, ease: 'outQuad' }, { to: 1, duration: 600, ease: 'outElastic(1, .4)' }] });
      animate('.cart-fab-count, .nav-count', { rotateX: ['90deg', '0deg'], duration: 500, ease: 'outBack(2)' });
    },
    fab(visible, bump) {
      if (reduce) { fab.style.opacity = visible ? 1 : 0; fab.style.transform = 'none'; return; }
      if (visible && !fabShown) { fabShown = true; animate(fab, { opacity: [0, 1], scale: [.6, 1], duration: 700, ease: 'outElastic(1, .6)' }); }
      else if (!visible && fabShown) { fabShown = false; animate(fab, { opacity: 0, scale: .6, duration: 300, ease: 'inQuad' }); }
      else if (visible && bump && reduce) this.bump();
    },
    drawer(open, done) {
      const d = $('#drawer'), o = $('#overlay');
      if (reduce) { d.style.transform = open ? 'translateX(0)' : 'translateX(105%)'; o.style.opacity = open ? 1 : 0; done && done(); return; }
      if (open) {
        animate(o, { opacity: [0, 1], duration: 300, ease: 'outQuad' });
        animate(d, { x: ['105%', '0%'], duration: 650, ease: 'outExpo' });
        animate($$('.cart-item, .order-form > *', d), { x: [30, 0], opacity: [0, 1], duration: 600, delay: stagger(40, { start: 150 }), ease: 'outExpo' });
      } else {
        animate(o, { opacity: 0, duration: 250, ease: 'inQuad' });
        animate(d, { x: '105%', duration: 380, ease: 'inQuad', onComplete: done });
      }
    },
    toast(t, hide) {
      if (reduce) { t.style.opacity = hide ? 0 : 1; return; }
      animate(t, hide ? { opacity: 0, y: 20, duration: 300, ease: 'inQuad' } : { opacity: [0, 1], y: [20, 0], duration: 500, ease: 'outBack(2)' });
    },
    cardsReady: cardsIn,
    // al cambiar de categoría: las tarjetas entran enseguida, sin esperar el scroll
    cardsSwap() {
      if (reduce) return;
      animate($$('#productGrid .card, #productGrid .grid-group'), { y: [24, 0], opacity: [0, 1], duration: 650, delay: stagger(45), ease: 'outExpo' });
    }
  };
  // si el carrito ya tenía cosas al cargar
  if ($('[data-cart-count]')?.textContent !== '0') window.SaborFX.fab(true);
})();
