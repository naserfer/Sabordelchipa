/* =========================================================
   Contador de visitas (anónimo)
   - Guarda en el navegador un id al azar (no es un dato personal):
     sirve para saber cuántas personas distintas entran.
   - Una "visita" dura hasta 30 minutos sin actividad.
   - No guarda IP, nombre ni nada que identifique a la persona.
   - No cuenta a bots ni al dueño (el panel marca su navegador).
   Uso: SaborTrack.evento('carrito' | 'pedido' | 'whatsapp')
   ========================================================= */
(function () {
  'use strict';
  const VID = 'sabor-vid', SES = 'sabor-ses', NO = 'sabor-no-contar';
  const SESION_MS = 30 * 60 * 1000;
  const ua = navigator.userAgent || '';
  const mem = {};
  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (_) { return mem[k] || null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (_) { mem[k] = v; } }
  };
  const bot = navigator.webdriver || /bot|crawl|spider|slurp|facebookexternalhit|whatsapp\/|preview|lighthouse|headless|pingdom|uptime/i.test(ua);
  const off = () => !window.SB || !SB.configured || bot || store.get(NO) === '1';

  const rid = () => {
    try { if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, '').slice(0, 24); } catch (_) {}
    return (Math.random().toString(36).slice(2) + Date.now().toString(36) + Math.random().toString(36).slice(2)).slice(0, 24);
  };

  function fuente() {
    const q = new URLSearchParams(location.search);
    const utm = (q.get('utm_source') || q.get('fuente') || '').toLowerCase().replace(/[^a-z0-9._-]/g, '');
    if (utm) return utm.slice(0, 40);
    if (/Instagram/i.test(ua)) return 'instagram';
    if (/FBAN|FBAV|FB_IAB/i.test(ua)) return 'facebook';
    if (/TikTok|musical_ly|BytedanceWebview/i.test(ua)) return 'tiktok';
    let h = '';
    try { h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : ''; } catch (_) {}
    if (!h || h === location.hostname.replace(/^www\./, '')) return 'directo';
    if (/(^|\.)google\./.test(h)) return 'google';
    if (/instagram/.test(h)) return 'instagram';
    if (/facebook|(^|\.)fb\.(com|me)$/.test(h)) return 'facebook';
    if (/whatsapp|(^|\.)wa\.me$/.test(h)) return 'whatsapp';
    if (/(^|\.)t\.co$|twitter|(^|\.)x\.com$/.test(h)) return 'x';
    if (/tiktok/.test(h)) return 'tiktok';
    if (/(^|\.)bing\./.test(h)) return 'bing';
    return h.slice(0, 40);
  }
  function dispositivo() {
    if (/iPad|Tablet/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua)) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'tablet';
    if (/Mobi|iPhone|iPod|Android/i.test(ua)) return 'movil';
    return 'compu';
  }

  function visitante() {
    let v = store.get(VID);
    if (!v || !/^[A-Za-z0-9_-]{8,40}$/.test(v)) { v = rid(); store.set(VID, v); }
    return v;
  }
  // la sesión se renueva con cada evento; la fuente es la de la primera página de la sesión
  function sesion() {
    let s = null; try { s = JSON.parse(store.get(SES) || 'null'); } catch (_) { s = null; }
    const now = Date.now();
    if (!s || !s.id || now - (s.t || 0) > SESION_MS) s = { id: rid(), f: fuente() };
    s.t = now; store.set(SES, JSON.stringify(s));
    return s;
  }

  const enviados = {};
  function evento(tipo) {
    if (off()) return;
    if (tipo !== 'visita' && tipo !== 'pedido' && enviados[tipo]) return;   // carrito y whatsapp: una vez por página
    enviados[tipo] = true;
    const s = sesion();
    SB.rpc('registrar_evento', {
      p_evento: tipo, p_visitante: visitante(), p_sesion: s.id,
      p_ruta: location.pathname || '/', p_fuente: s.f || 'directo', p_dispositivo: dispositivo()
    }, { keepalive: true }).catch(() => {});
  }

  // la visita se cuenta cuando la página se ve de verdad (no si se abrió en segundo plano y nunca se miró)
  function contarVisita() {
    if (document.visibilityState === 'visible') { setTimeout(() => evento('visita'), 600); return; }
    const onVis = () => { if (document.visibilityState === 'visible') { document.removeEventListener('visibilitychange', onVis); evento('visita'); } };
    document.addEventListener('visibilitychange', onVis);
  }
  if (!/^\/admin/.test(location.pathname)) contarVisita();

  // consultas por WhatsApp (botones de la web que no son el pedido)
  document.addEventListener('click', e => {
    if (e.target.closest && e.target.closest('a[data-wa-link], a[data-wa-bulk]')) evento('whatsapp');
  }, true);

  window.SaborTrack = { evento, visitante };
})();
