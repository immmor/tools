(function () {
  'use strict';
  const API_HOST = 'api.funbua.uk';

  const rotl = (x, n) => ((x << n) | (x >>> (32 - n))) >>> 0;

  function mix(str, seed) {
    let a = (seed ^ 0x9e3779b9) >>> 0;
    let b = (seed ^ 0x85ebca6b) >>> 0;
    let c = (seed ^ 0xc2b2ae35) >>> 0;
    let d = (seed ^ 0x27d4eb2f) >>> 0;
    for (let i = 0; i < str.length; i++) {
      const ch = str.charCodeAt(i);
      a = (rotl((a ^ ch) >>> 0, 7) + Math.imul(a, 0x01000193)) >>> 0;
      b = (rotl((b ^ a) >>> 0, 11) + Math.imul(b, 0x85ebca77)) >>> 0;
      c = (rotl((c ^ b) >>> 0, 13) + Math.imul(c, 0xc2b2ae3d)) >>> 0;
      d = (rotl((d ^ c) >>> 0, 17) + Math.imul(d, 0x27d4eb2f)) >>> 0;
    }
    return [a, b, c, d];
  }

  function diffuse(state, times) {
    let [a, b, c, d] = state;
    for (let r = 0; r < times; r++) {
      a = rotl((a ^ b) >>> 0, 5) >>> 0;
      b = rotl((b + c) >>> 0, 9) >>> 0;
      c = rotl((c ^ d) >>> 0, 13) >>> 0;
      d = rotl((d + a) >>> 0, 17) >>> 0;
      a = (a ^ Math.imul(b, 0x9e3779b1)) >>> 0;
      b = (b ^ Math.imul(c, 0x85ebca77)) >>> 0;
      c = (c ^ Math.imul(d, 0xc2b2ae3d)) >>> 0;
      d = (d ^ Math.imul(a, 0x27d4eb2f)) >>> 0;
    }
    return [a, b, c, d];
  }

  const toHex = (state) => state.map((n) => n.toString(16).padStart(8, '0')).join('');

  function collectFingerprint() {
    const p = [];
    p.push(navigator.userAgent || '', navigator.language || '');
    p.push((navigator.languages || []).join(','));
    p.push(navigator.platform || '', String(navigator.hardwareConcurrency || ''));
    p.push(String(navigator.deviceMemory || ''), String(navigator.maxTouchPoints || ''));
    p.push(String(screen.width), String(screen.height), String(screen.colorDepth), String(screen.pixelDepth));
    p.push(String(window.devicePixelRatio || 1));
    p.push(Intl.DateTimeFormat().resolvedOptions().timeZone || '', String(new Date().getTimezoneOffset()));
    try {
      const cv = document.createElement('canvas');
      cv.width = 280; cv.height = 70;
      const ctx = cv.getContext('2d');
      ctx.textBaseline = 'top';
      ctx.font = '16px Arial';
      ctx.fillStyle = '#0ff';
      ctx.fillRect(0, 0, 140, 35);
      ctx.fillStyle = '#f0f';
      ctx.fillText('phantom-sign-v1', 3, 15);
      ctx.fillStyle = 'rgba(0,255,136,0.6)';
      ctx.fillText('phantom-sign-v1', 5, 35);
      p.push(cv.toDataURL());
    } catch (e) { p.push('na'); }
    try {
      const cv = document.createElement('canvas');
      const gl = cv.getContext('webgl') || cv.getContext('experimental-webgl');
      if (gl) {
        const ext = gl.getExtension('WEBGL_debug_renderer_info');
        p.push(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
        p.push(gl.getParameter(gl.VERSION));
      } else { p.push('na', 'na'); }
    } catch (e) { p.push('na', 'na'); }
    return p.join('\u0001');
  }

  let cachedFingerprint = null;
  const fingerprint = () => cachedFingerprint || (cachedFingerprint = collectFingerprint());

  function randomHex(bytes) {
    const a = new Uint8Array(bytes);
    if (globalThis.crypto && crypto.getRandomValues) crypto.getRandomValues(a);
    else for (let i = 0; i < bytes; i++) a[i] = Math.floor(Math.random() * 256);
    return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  function sign(method, url, body) {
    const ts = Date.now();
    const nc = randomHex(12);
    let target;
    try { target = new URL(url, location.href).pathname + new URL(url, location.href).search; }
    catch (e) { target = url; }
    let bodyStr = '';
    if (body != null) {
      if (typeof body === 'string') bodyStr = body;
      else { try { bodyStr = JSON.stringify(body); } catch (e) { bodyStr = String(body); } }
    }
    const fp = toHex(diffuse(mix(fingerprint(), 0x1234567), 4));
    const raw = [method.toUpperCase(), target, bodyStr, String(ts), nc, fp].join('\u0001');
    let state = diffuse(mix(raw, (ts ^ 0x5a5a5a5a) >>> 0), 12);
    const fpState = mix(fp, 0x1234567);
    state = diffuse([
      state[0] ^ fpState[1], state[1] ^ fpState[3],
      state[2] ^ fpState[0], state[3] ^ fpState[2]
    ], 8);
    return { ts, nc, sig: toHex(state), fp };
  }

  const nativeFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    let url = typeof input === 'string' ? input : (input && input.url);
    let host = '';
    try { host = new URL(url, location.href).hostname; } catch (e) {}
    if (host !== API_HOST) return nativeFetch(input, init);

    const nextInit = Object.assign({}, init || {});
    const req = typeof input !== 'string' ? input : null;
    const method = (nextInit.method || (req && req.method) || 'GET').toUpperCase();
    const { ts, nc, sig, fp } = sign(method, url, nextInit.body);

    const headers = new Headers(nextInit.headers || (req && req.headers) || {});
    headers.set('X-Phantom-Ts', String(ts));
    headers.set('X-Phantom-Nonce', nc);
    headers.set('X-Phantom-Sign', sig);
    headers.set('X-Phantom-Fp', fp);

    const u = new URL(url, location.href);
    u.searchParams.set('_ts', String(ts));
    u.searchParams.set('_nc', nc);
    u.searchParams.set('_sig', sig);
    const nextInput = typeof input === 'string' ? u.toString() : new Request(u.toString(), input);

    return nativeFetch(nextInput, Object.assign({}, nextInit, { headers }));
  };
})();
