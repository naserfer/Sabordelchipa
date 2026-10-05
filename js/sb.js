/* =========================================================
   Mini cliente de Supabase (sin librerías)
   REST (PostgREST) + Auth + Storage, con fetch.
   ========================================================= */
(function () {
  'use strict';
  const C = window.SABOR_CONFIG || {};
  const base = (C.supabaseUrl || '').trim().replace(/\/+$/, '');
  const key = (C.supabaseKey || '').trim();
  const bucket = C.bucket || 'fotos';
  const SESSION_KEY = 'sabor-admin-session';
  const configured = /^https:\/\/.+/.test(base) && key.length > 20;

  let session = null;
  try { session = JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch (_) { session = null; }
  const saveSession = s => { session = s; try { s ? localStorage.setItem(SESSION_KEY, JSON.stringify(s)) : localStorage.removeItem(SESSION_KEY); } catch (_) {} };

  function headers(extra = {}, useUser = true) {
    const h = { apikey: key, ...extra };
    if (useUser && session && session.access_token) h.Authorization = 'Bearer ' + session.access_token;
    else if (key.startsWith('eyJ')) h.Authorization = 'Bearer ' + key; // clave "anon" vieja
    return h;
  }

  const MSG = {
    'Invalid login credentials': 'Mail o contraseña incorrectos.',
    'Email not confirmed': 'Falta confirmar el mail de esta cuenta (en Supabase marcá "Auto Confirm User").',
    'new row violates row-level security policy': 'Esta cuenta no tiene permiso para modificar datos.',
    'Failed to fetch': 'No hay conexión con la base de datos. Revisá internet o la configuración.'
  };
  const tr = m => { for (const k in MSG) if (String(m).includes(k)) return MSG[k]; return m; };

  async function parse(res) {
    const text = await res.text();
    let data = null; try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
    if (!res.ok) {
      const m = (data && (data.message || data.msg || data.error_description || data.error)) || res.statusText || ('Error ' + res.status);
      const e = new Error(tr(m)); e.status = res.status; e.raw = data; throw e;
    }
    return data;
  }

  async function authCall(path, body, useUser = false, method = 'POST') {
    const res = await fetch(base + '/auth/v1' + path, { method, headers: headers({ 'Content-Type': 'application/json' }, useUser), body: body ? JSON.stringify(body) : undefined });
    return parse(res);
  }
  function storeTokens(d) {
    if (!d || !d.access_token) throw new Error('Respuesta de inicio de sesión inválida.');
    saveSession({
      access_token: d.access_token, refresh_token: d.refresh_token,
      expires_at: d.expires_at || Math.floor(Date.now() / 1000) + (d.expires_in || 3600),
      email: (d.user && d.user.email) || (session && session.email) || ''
    });
    return session;
  }

  let refreshing = null;
  async function refresh() {
    if (!session || !session.refresh_token) return false;
    if (!refreshing) refreshing = authCall('/token?grant_type=refresh_token', { refresh_token: session.refresh_token })
      .then(d => { storeTokens(d); return true; })
      .catch(() => { saveSession(null); return false; })
      .finally(() => { refreshing = null; });
    return refreshing;
  }
  async function ensureFresh() {
    if (session && session.expires_at && session.expires_at - Date.now() / 1000 < 90) await refresh();
  }

  async function rest(path, opts = {}, retry = true) {
    if (!configured) throw new Error('La base de datos no está configurada (js/config.js).');
    await ensureFresh();
    const res = await fetch(base + '/rest/v1/' + path, { ...opts, headers: headers(opts.headers || {}) });
    if (res.status === 401 && retry && session) { if (await refresh()) return rest(path, opts, false); }
    return parse(res);
  }
  const json = { 'Content-Type': 'application/json', Prefer: 'return=representation' };

  window.SB = {
    configured, bucket,
    get session() { return session; },
    select: (table, query = 'select=*') => rest(`${table}?${query}`),
    insert: (table, row) => rest(table, { method: 'POST', headers: json, body: JSON.stringify(row) }),
    update: (table, match, patch) => rest(`${table}?${match}`, { method: 'PATCH', headers: json, body: JSON.stringify(patch) }),
    remove: (table, match) => rest(`${table}?${match}`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } }),
    // extra: opciones de fetch, por ejemplo { keepalive: true } para que termine aunque se cierre la página
    rpc: (fn, args = {}, extra = {}) => rest(`rpc/${fn}`, { ...extra, method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) }),

    async signIn(email, password) {
      if (!configured) throw new Error('La base de datos no está configurada (js/config.js).');
      const d = await authCall('/token?grant_type=password', { email, password });
      return storeTokens(d);
    },
    async signOut() {
      try { if (session) await authCall('/logout', null, true); } catch (_) {}
      saveSession(null);
    },
    async setPassword(password) {
      await ensureFresh();
      return authCall('/user', { password }, true, 'PUT');
    },
    async upload(path, blob, contentType) {
      await ensureFresh();
      const res = await fetch(`${base}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`, {
        method: 'POST',
        headers: headers({ 'Content-Type': contentType || blob.type || 'image/jpeg', 'cache-control': 'max-age=31536000', 'x-upsert': 'false' }),
        body: blob
      });
      await parse(res);
      return this.publicUrl(path);
    },
    publicUrl: path => `${base}/storage/v1/object/public/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`
  };
})();
