/* =========================================================
   Sabor del Chipá — animaciones con anime.js v4
   La estrella: "Del freezer al horno" sincronizada al scroll.
   ========================================================= */
(function () {
  'use strict';
  if (!window.anime) { document.documentElement.classList.remove('js'); return; }
  const { animate, createTimeline, onScroll, stagger, svg, utils } = window.anime;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return `rgb(${A.map((v, i) => Math.round(lerp(v, B[i], t))).join(',')})`; };
  const easeInOut = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;

  /* ---------------------------------------------------------
     1. EL CHIPÁ: forma orgánica generada (cruda → inflada)
     --------------------------------------------------------- */
  const CX = 300, CY = 360, N = 40;
  function rand(seed) { return () => (seed = (seed * 16807) % 2147483647) / 2147483647; }
  const rnd = rand(7);
  const noiseA = Array.from({ length: N }, () => rnd());
  function shape(R, bumps, flat, lift) {
    return Array.from({ length: N }, (_, i) => {
      const a = (i / N) * Math.PI * 2;
      const n = 1 + bumps * (Math.sin(a * 3 + 1.3) * .5 + Math.sin(a * 5 + .4) * .3 + (noiseA[i] - .5) * .5);
      const r = R * n;
      const sy = Math.sin(a) > 0 ? flat : 1;           // base más plana
      return [CX + Math.cos(a) * r, CY - lift + Math.sin(a) * r * sy];
    });
  }
  const RAW = shape(104, .035, .78, 0);
  const BAKED = shape(128, .07, .70, 10);
  function pathFrom(pts) {
    let d = '';
    for (let i = 0; i < pts.length; i++) {
      const p0 = pts[(i - 1 + N) % N], p1 = pts[i], p2 = pts[(i + 1) % N], p3 = pts[(i + 2) % N];
      if (i === 0) d += `M${p1[0].toFixed(1)} ${p1[1].toFixed(1)}`;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += `C${c1[0].toFixed(1)} ${c1[1].toFixed(1)} ${c2[0].toFixed(1)} ${c2[1].toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`;
    }
    return d + 'Z';
  }

  // manchitas de queso
  const spotsG = $('#spots');
  if (spotsG) {
    const r2 = rand(42); let html = '';
    for (let i = 0; i < 26; i++) {
      const a = r2() * Math.PI * 2, d = Math.sqrt(r2()) * 112;
      const x = CX + Math.cos(a) * d, y = CY - 18 + Math.sin(a) * d * .78;
      const rx = 4 + r2() * 7, ry = rx * (.55 + r2() * .35), rot = r2() * 180;
      html += `<ellipse class="spot" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}" transform="rotate(${rot.toFixed(0)} ${x.toFixed(1)} ${y.toFixed(1)})"/>`;
    }
    // envolvemos cada mancha en <g> para que anime.js controle la escala sin pisar el rotate del atributo
    spotsG.innerHTML = html.replace(/<ellipse class="spot"/g, '<g class="spot"><ellipse').replace(/\/>/g, '/></g>');
  }
  // chispas de calor que suben dentro del horno
  const embersG = $('#embers');
  if (embersG) {
    const r3 = rand(99); let html = '';
    for (let i = 0; i < 16; i++) {
      const x = 90 + r3() * 420, y = 470 + r3() * 40, r = 1.6 + r3() * 2.4;
      html += `<circle class="ember" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${r3() > .5 ? '#FFB45A' : '#FF7A22'}"/>`;
    }
    embersG.innerHTML = html;
  }
  // los copos tienen transform como atributo: los envolvemos para poder animarlos
  $$('#snow .flake').forEach(f => {
    const w = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    w.setAttribute('transform', f.getAttribute('transform')); f.removeAttribute('transform');
    f.parentNode.insertBefore(w, f); w.appendChild(f);
  });

  /* ---------------------------------------------------------
     2. Render del estado (lo llama la línea de tiempo)
     --------------------------------------------------------- */
  const el = {
    body: $('#chipaBody'), crust: $('#chipaCrust'), clip: $('#bodyClipPath'),
    s0: $('#dStop0'), s1: $('#dStop1'), s2: $('#dStop2'),
    tex: $('#chipaTex'), rim: $('#chipaRim'), frost: $('#frost'), snow: $('#snow'), bgOven: $('#bgOven'), glow: $('#ovenGlow'),
    rods: $('#rods'), rodPaths: $$('#rods .rod'), rackLine: $('#rackLine'), rackBars: $('#rackBars'),
    embers: $('#embers'), sun: $('#sunWrap'), frame: $('#ovenFrame'), shine: $('#glassShine'), shadow: $('#chipaShadow'), steamG: $('#steamGroup'),
    spots: $$('#spots ellipse'), temp: $('#tempVal'), minus: $('#tempMinus'), thermo: $('#thermoFill'), time: $('#timeVal'), ring: $('#timeRing'),
    progress: $('#ovenProgress'), steps: $$('.step'), sticky: $('.oven-sticky'), hint: $('.scroll-hint')
  };
  const st = { frost: 1, oven: 0, glow: 0, heat: 0, puff: 0, temp: -18, time: 0, steam: 0 };
  let lastStep = -1;

  function render(progress) {
    if (!el.body) return;
    const pts = RAW.map((p, i) => [lerp(p[0], BAKED[i][0], st.puff), lerp(p[1], BAKED[i][1], st.puff)]);
    const d = pathFrom(pts);
    el.body.setAttribute('d', d); el.crust.setAttribute('d', d); el.clip.setAttribute('d', d);

    const h = easeInOut(clamp(st.heat));
    el.s0.setAttribute('stop-color', mix('#FBF4E2', '#FBD891', h));
    el.s1.setAttribute('stop-color', mix('#EFE3C6', '#E7A955', h));
    el.s2.setAttribute('stop-color', mix('#D8C6A0', '#B8692A', h));
    el.crust.setAttribute('opacity', (Math.pow(h, 1.4) * .9).toFixed(3));
    el.tex.setAttribute('opacity', (.14 + h * .26).toFixed(3));
    el.rim.setAttribute('opacity', (st.glow * .85).toFixed(3));
    const spotFill = mix('#F4E4B4', '#B4561A', h);
    el.spots.forEach(s => s.setAttribute('fill', spotFill));

    el.frost.setAttribute('opacity', st.frost.toFixed(3));
    el.snow.setAttribute('opacity', st.frost.toFixed(3));
    el.bgOven.setAttribute('opacity', st.oven.toFixed(3));
    el.glow.setAttribute('opacity', st.glow.toFixed(3));
    el.rods.setAttribute('opacity', st.oven.toFixed(3));
    const rodC = mix('#4A2512', '#FF7A22', clamp(st.glow * 1.2));
    el.rodPaths.forEach(r => { r.style.stroke = rodC; r.setAttribute('filter', st.glow > .3 ? 'url(#fRodGlow)' : ''); });
    const rackC = mix('#E9F2F7', '#3B2416', st.oven);
    el.rackLine.setAttribute('stroke', rackC); el.rackBars.setAttribute('stroke', rackC);
    el.frame.setAttribute('stroke-opacity', (st.oven * .55).toFixed(3));
    el.shine.setAttribute('opacity', (st.oven * .05).toFixed(3));
    el.shadow.setAttribute('rx', lerp(104, 132, st.puff).toFixed(1));
    el.shadow.setAttribute('opacity', lerp(.16, .5, st.oven).toFixed(3));
    el.steamG.setAttribute('opacity', st.steam.toFixed(3));
    el.embers.setAttribute('opacity', clamp(st.glow * 1.1).toFixed(3));
    el.sun.setAttribute('opacity', (st.steam * .72).toFixed(3));

    const t = Math.round(st.temp);
    el.temp.textContent = Math.abs(t); el.minus.style.display = t < 0 ? '' : 'none';
    el.thermo.style.width = (4 + clamp((st.temp + 18) / 218) * 96).toFixed(1) + '%';
    el.time.textContent = Math.round(st.time);
    el.ring.style.strokeDashoffset = (113.1 * (1 - clamp(st.time / 20))).toFixed(2);
    el.sticky.style.setProperty('background-color', mix('#FBF6EC', '#F6E7CF', st.oven));

    if (progress != null) {
      el.progress.style.width = (progress * 100).toFixed(2) + '%';
      const step = progress < .16 ? 0 : progress < .36 ? 1 : progress < .86 ? 2 : 3;
      if (step !== lastStep) {
        el.steps.forEach((s, i) => { s.classList.toggle('is-active', i === step); s.classList.toggle('is-done', i < step); });
        if (lastStep !== -1 && !reduce) animate(el.steps[step], { scale: [.96, 1], duration: 500, ease: 'outBack(2)' });
        lastStep = step;
      }
      if (el.hint) el.hint.style.opacity = String(clamp(1 - progress * 8));
    }
  }

  /* ---------------------------------------------------------
     3. Línea de tiempo sincronizada al scroll
     --------------------------------------------------------- */
  if (reduce) {
    Object.assign(st, { frost: 0, oven: 1, glow: .75, heat: 1, puff: 1, temp: 200, time: 20, steam: 1 });
    render(1);
  } else if ($('#horno')) {
    render(0);
    const steam = svg.createDrawable('.steam');
    const tl = createTimeline({
      defaults: { ease: 'linear' },
      autoplay: onScroll({ target: '#horno', enter: 'top top', leave: 'bottom bottom', sync: .18 }),
      onUpdate: self => render(self.progress)
    });
    tl
      // 1) sale del freezer: se va la escarcha y caen los copos
      .add(st, { frost: 0, duration: 220, ease: 'inOutSine' }, 70)
      .add('#snow .flake', { y: 60, opacity: 0, duration: 220, delay: stagger(12), ease: 'inQuad' }, 70)
      .add('#chipa', { y: [{ to: -34, duration: 120, ease: 'outQuad' }, { to: 0, duration: 140, ease: 'outBounce' }], rotate: [{ to: -4, duration: 120 }, { to: 0, duration: 140 }] }, 110)
      // 2) se prende el horno
      .add(st, { oven: 1, duration: 200, ease: 'inOutSine' }, 120)
      .add(st, { temp: 200, duration: 260, ease: 'outQuad' }, 120)
      .add(st, { glow: .8, duration: 240, ease: 'inQuad' }, 200)
      // 3) se hornea: se infla, se dora y aparecen las manchitas de queso
      .add(st, { heat: 1, duration: 540, ease: 'inOutSine' }, 340)
      .add(st, { puff: 1, duration: 420, ease: 'outCubic' }, 340)
      .add('#chipa', { scaleY: [{ to: 1.06, duration: 220, ease: 'outQuad' }, { to: 1, duration: 200, ease: 'inOutSine' }], scaleX: [{ to: .97, duration: 220 }, { to: 1, duration: 200 }] }, 360)
      .add(st, { time: 20, duration: 540 }, 340)
      .add('.spot', { scale: [{ from: .5, to: 1.35, duration: 120, ease: 'outQuad' }, { to: 1, duration: 140, ease: 'inOutSine' }], delay: stagger(9, { from: 'center' }) }, 430)
      // 4) ¡listo! sale el vapor
      .add(st, { steam: 1, duration: 120 }, 860)
      .add(steam, { draw: ['0 0', '0 1'], duration: 140, delay: stagger(20), ease: 'outQuad' }, 860)
      .add('#chipa', { scale: [{ to: 1.05, duration: 60, ease: 'outQuad' }, { to: 1, duration: 80, ease: 'outBack(3)' }] }, 880)
      .add(st, { glow: .95, duration: 120 }, 880)
      .add('#sunRays', { scale: [.55, 1], duration: 140, ease: 'outBack(2)' }, 860);

    // loops ambientales (no dependen del scroll)
    animate('.steam', { x: [-5, 5], duration: 1600, alternate: true, loop: true, ease: 'inOutSine', delay: stagger(260) });
    animate('#snow .flake', { rotate: '1turn', duration: 14000, loop: true, ease: 'linear' });
    animate('#sunRays', { rotate: '1turn', duration: 40000, loop: true, ease: 'linear' });
    animate('.ember', {
      y: () => utils.random(-320, -180), x: () => utils.random(-30, 30),
      opacity: [{ to: 1, duration: 300 }, { to: 0, duration: 1500 }],
      scale: [1, .3], duration: () => utils.random(1600, 2600), delay: () => utils.random(0, 2000),
      loop: true, ease: 'outSine'
    });
    // el horno sigue el mouse con una leve inclinación 3D
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      const vis = $('.oven-visual');
      vis.parentElement.style.perspective = '1400px';
      addEventListener('pointermove', e => {
        if (scrollY > $('#horno').offsetHeight) return;
        const rx = (e.clientY / innerHeight - .5) * -6, ry = (e.clientX / innerWidth - .5) * 8;
        animate(vis, { rotateX: rx, rotateY: ry, duration: 900, ease: 'outQuad' });
      }, { passive: true });
    }
  }

  /* ---------------------------------------------------------
     4. Intro al cargar
     --------------------------------------------------------- */
  if (!reduce) {
    animate('.hero-title .word', { y: ['110%', '0%'], opacity: [0, 1], duration: 1100, delay: stagger(70, { start: 150 }), ease: 'outExpo' });
    animate('[data-intro]', { y: [18, 0], opacity: [0, 1], duration: 900, delay: stagger(120, { start: 450 }), ease: 'outExpo' });
    animate('.steps .step', { x: [-16, 0], opacity: { from: 0 }, duration: 800, delay: stagger(70, { start: 650 }), ease: 'outExpo',
      onComplete: () => $$('.steps .step').forEach(s => s.style.opacity = '') });
    animate('.oven-visual', { scale: [.88, 1], opacity: [0, 1], duration: 1300, delay: 200, ease: 'outElastic(1, .7)' });
    animate('#chipaInner', { y: [-120, 0], duration: 1100, delay: 600, ease: 'outBounce' });
    animate('.hud-temp', { x: [-30, 0], opacity: [0, 1], duration: 900, delay: 900, ease: 'outExpo' });
    animate('.hud-time', { x: [30, 0], opacity: [0, 1], duration: 900, delay: 1000, ease: 'outExpo' });
    animate('.nav', { y: ['-100%', '0%'], duration: 900, ease: 'outExpo' });
  }

  /* ---------------------------------------------------------
     5. Marquee
     --------------------------------------------------------- */
  if (!reduce) {
    animate('.marquee-track', { x: ['0%', '-50%'], duration: 40000, ease: 'linear', loop: true });
    animate('.m-sol', { rotate: '1turn', duration: 9000, loop: true, ease: 'linear' });
    if (!$('#aviso').hidden) animate('#aviso', { y: ['-100%', '0%'], opacity: [0, 1], duration: 700, delay: 600, ease: 'outExpo' });
  }

  /* ---------------------------------------------------------
     5b. Mate y chipá: el termo ceba, sube la espuma y el vapor
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
     6. Revelados al entrar en pantalla
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

  // tilt suave en las tarjetas (solo con mouse)
  if (!reduce && matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.addEventListener('pointermove', e => {
      const c = e.target.closest?.('.card'); if (!c) return;
      const r = c.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - .5) * -6, ry = ((e.clientX - r.left) / r.width - .5) * 6;
      animate(c, { rotateX: rx, rotateY: ry, duration: 400, ease: 'outQuad' });
    });
    document.addEventListener('pointerout', e => {
      const c = e.target.closest?.('.card'); if (c && !c.contains(e.relatedTarget)) animate(c, { rotateX: 0, rotateY: 0, duration: 700, ease: 'outElastic(1, .5)' });
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
    animate('.puff', { opacity: [{ to: .9, duration: 120 }, { to: 0, duration: 680 }], scale: [.4, 2.2], x: [0, -46], y: [0, -16], duration: 800, loop: true, delay: stagger(260), ease: 'outQuad' });
    animate('.cloud', { x: [0, 30], duration: 6000, alternate: true, loop: true, ease: 'inOutSine', delay: stagger(1200) });
  });

  /* ---------------------------------------------------------
     7. FX del pedido (los usa app.js)
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
    cardsReady: cardsIn
  };
  // si el carrito ya tenía cosas al cargar
  if ($('[data-cart-count]')?.textContent !== '0') window.SaborFX.fab(true);
})();
