/* 11-api.js — API 网关：12 环混淆链直接作为 p_token 的签发与校验核心 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  var TTL = 5 * 60 * 1000;
  var SESSIONS = Object.create(null);
  var REVOKED = Object.create(null);
  var ROUTES = {
    'GET /api/profile': 'profile:read',
    'GET /api/vault/data': 'data:read',
    'POST /api/vault/transfer': 'data:write'
  };

  /* 演示账号：源码里不存在完整的用户名 / 口令常量 */
  var USER = '\x61\x64\x6d\x69\x6e';
  var PASS = '\x6e\x69\x2d\x32\x30\x32\x36';
  var ERR = {
    401: ['\x70', '\x5f', '\x74', '\x6f', '\x6b', '\x65', '\x6e', ' ',
          '\u65e0\u6548', '\u6216', '\u5df2', '\u8fc7', '\u671f'].join(''),
    403: ['\x73', '\x63', '\x6f', '\x70', '\x65', ' ', '\u4e0d', '\u8db3'].join(''),
    404: ['\x6e', '\x6f', '\x74', ' ', '\x66', '\x6f', '\x75', '\x6e', '\x64'].join('')
  };

  var SALT = null, EXPECTED = null, guardedVerify = null, KM = null;
  var bound = false, uiToken = null, LAST_PROBE = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* 常数时间比较，避免按字节猜测签名 */
  function constantEq(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
    var d = 0;
    for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return d === 0;
  }

  /* HMAC-SHA256；无 crypto.subtle 时降级为带密钥的双向 FNV */
  async function mac(key, text) {
    var sub = root.crypto && root.crypto.subtle;
    if (!sub) {
      var k = U.hex(key);
      return U.fnv(k + '|' + text) + U.fnv(text + '|' + k + '|' + k);
    }
    var k2 = await sub.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    var sig = await sub.sign('HMAC', k2, U.utf8(text));
    return U.hex(new Uint8Array(sig));
  }

  /* 复用 10-chain.js 的 12 环 context，不重复实现密钥链 */
  async function keyMaterial() {
    var ctx = await OBF.chain.context();
    if (KM) return KM;
    /* ponytail: PBKDF2 每请求重算会拖慢界面；环境在单次页面会话内不变，故缓存派生密钥 */
    if (!SALT) SALT = [ctx.stegoKey, ctx.vmToken, ctx.esoToken, OBF.wasm.hidden, ctx.k1].join('|');
    var macKey = await OBF.crypto.derive('p_token/mac/v1', SALT);
    var sealKey = await OBF.crypto.derive('p_token/seal/v1', SALT + '|' + ctx.fp);
    KM = {
      ctx: ctx, macKey: macKey, sealKey: sealKey,
      chainId: U.fnv(ctx.baseToken).slice(0, 8),
      fp: ctx.fp, vmToken: ctx.vmToken, esoToken: ctx.esoToken
    };
    return KM;
  }

  async function init() {
    if (EXPECTED) return;
    await keyMaterial();
    EXPECTED = await OBF.crypto.digest(USER + ':' + PASS + ':' + SALT);
    guardedVerify = OBF.antidebug.selfDefend(verify, U.fnv(verify.toString()));
  }

  async function checkCredential(user, pass) {
    await init();
    var got = await OBF.crypto.digest(String(user) + ':' + String(pass) + ':' + SALT);
    return constantEq(String(got), String(EXPECTED));
  }

  /* p_token = p1.<header 含全层指纹>.<AES-CBC→AES-GCM 密文>.<HMAC> */
  async function issue(user, scope, override) {
    await init();
    var km = await keyMaterial();
    var ld = U.fnv(await OBF.binding.digest()).slice(0, 8);
    var now = Date.now();
    var header = { alg: 'OBF12-HMAC-SHA256', typ: 'p_token', v: 1, cid: km.chainId, ld: ld };
    var body = {
      sub: user, scope: scope, iat: now, exp: now + TTL,
      jti: U.hex(U.randomBytes(12)), fp: km.fp,
      vm: km.vmToken, eso: km.esoToken, wsm: OBF.wasm.hidden
    };
    if (override) Object.assign(body, override);
    var sealed = await OBF.binding.codec.seal(km.sealKey, U.utf8(JSON.stringify(body)));
    var a = U.b64(U.utf8(JSON.stringify(header)));
    var b = U.b64(sealed);
    var sig = await mac(km.macKey, a + '.' + b);
    SESSIONS[body.jti] = body;
    return 'p1.' + a + '.' + b + '.' + U.b64(U.utf8(sig));
  }

  /* 校验器：乱序 switch 分发 + 不透明谓词 + 恒真分支，没有直白的 if 链 */
  async function verify(token) {
    var km = await keyMaterial();
    var ld = U.fnv(await OBF.binding.digest()).slice(0, 8);
    var parts = String(token || '').split('.');
    var S = [0x37, 0x36, 0x35, 0x34, 0x33], EXIT = 0x31;
    var state = S[0], code = 0, body = null, guard = 0, h = null, expect = '', got = '';
    while (guard++ < 32) {
      switch (state ^ 0x37) {
        case 0:
          if (parts.length !== 4 || parts[0] !== 'p1') code = 401;
          state = code ? EXIT : S[1];
          break;
        case 1:
          try { h = JSON.parse(U.fromUtf8(U.unb64(parts[1]))); }
          catch (e) { h = null; }
          if (!h || h.cid !== km.chainId || h.ld !== ld || h.typ !== 'p_token' || h.v !== 1) code = 401;
          if (!OBF.controlflow.opaqueTrue(guard)) code = 401;
          state = code ? EXIT : S[2];
          break;
        case 2:
          expect = await mac(km.macKey, parts[1] + '.' + parts[2]);
          try { got = U.fromUtf8(U.unb64(parts[3])); }
          catch (e) { got = ''; }
          if (!constantEq(expect, got)) code = 401;
          state = code ? EXIT : S[3];
          break;
        case 3:
          try {
            var plain = await OBF.binding.codec.unseal(km.sealKey, U.unb64(parts[2]));
            body = JSON.parse(U.fromUtf8(plain));
          } catch (e) { body = null; code = 401; }
          if (body && !OBF.controlflow.opaqueTrue(guard)) code = 401;
          state = code ? EXIT : S[4];
          break;
        case 4:
          LAST_PROBE = OBF.binding.probe();
          if (!body || body.fp !== km.fp) code = 401;
          else if (Date.now() > body.exp || body.iat > Date.now()) code = 401;
          else if (!SESSIONS[body.jti] || REVOKED[body.jti]) code = 401;
          else if (Date.now() > SESSIONS[body.jti].exp) code = 401;
          else if (body.vm !== km.vmToken || body.eso !== km.esoToken || body.wsm !== OBF.wasm.hidden) code = 401;
          else if (!OBF.binding.gate(LAST_PROBE)) code = 401;
          state = EXIT;
          break;
        default:
          return { ok: code === 0, code: code || 200, body: body };
      }
    }
    return { ok: false, code: 401, body: null };
  }

  function payloadFor(path, body) {
    if (path === '/api/profile') {
      return { sub: body.sub, role: 'administrator', chain: 'OBF12', scopes: body.scope };
    }
    if (path === '/api/vault/data') {
      return { records: 3, items: ['\u96f6\u5bbd\u9690\u5199\u5bc6\u94a5', 'wasm \u6570\u636e\u6bb5\u5e38\u91cf', 'VM \u5b57\u8282\u7801'],
               seal: U.fnv(body.jti) };
    }
    return { transferred: true, note: '\u4ec5 data:write \u53ef\u89c1' };
  }

  async function login(body) {
    var ok = await checkCredential(body.user, body.pass);
    if (!ok) return { status: 401, body: { error: '\u51ed\u636e\u65e0\u6548' } };
    var scope = ['profile:read', 'data:read'];
    var p_token = await issue(body.user, scope);
    return {
      status: 200,
      body: { p_token: p_token, token_type: 'Bearer', expires_in: TTL / 1000, scope: scope }
    };
  }

  async function request(method, path, opts) {
    await init();
    opts = opts || {};
    if (method === 'POST' && path === '/api/login') return login(opts.body || {});
    var m = /^Bearer\s+(.+)$/i.exec((opts.headers && opts.headers.authorization) || '');
    var v = await guardedVerify(m ? m[1] : '');
    if (!v.ok) return { status: v.code, body: { error: ERR[v.code] || ERR[401] } };
    var body = v.body;
    if (method === 'POST' && path === '/api/logout') {
      REVOKED[body.jti] = true;
      return { status: 200, body: { revoked: body.jti } };
    }
    var need = ROUTES[method + ' ' + path];
    if (!need) return { status: 404, body: { error: ERR[404] } };
    if (body.scope.indexOf(need) < 0) {
      return { status: 403, body: { error: ERR[403], required: need } };
    }
    return { status: 200, body: payloadFor(path, body) };
  }

  async function decoy() {
    await init();
    var km = await keyMaterial();
    var h = U.b64(U.utf8(JSON.stringify({
      alg: 'OBF12-HMAC-SHA256', typ: 'p_token', v: 1, cid: km.chainId, ld: 'deadbeef'
    })));
    var b = U.b64(U.utf8(JSON.stringify({
      sub: USER, scope: ['data:write'], iat: Date.now(), exp: Date.now() + TTL,
      jti: 'deadbeef', fp: km.fp
    })));
    return 'p1.' + h + '.' + b + '.' + U.b64(U.utf8(Array(65).join('0')));
  }

  /* 仅供自检使用的内部入口，不从 OBF.api 暴露 */
  async function inspectToken(token) {
    await init();
    var v = await guardedVerify(token);
    return v.body;
  }
  function expireSession(jti, at) { if (SESSIONS[jti]) SESSIONS[jti].exp = at; }

  var apiImpl = { request: request, login: login, decoy: decoy };

  /* Proxy 拦截：外部无法替换校验函数，也读不到真实的 name */
  OBF.api = new Proxy({}, {
    get: function (t, k) { return k === 'verify' ? guardedVerify : apiImpl[k]; },
    set: function (t, k, v) {
      if (k === 'verify') return true;
      apiImpl[k] = v;
      return true;
    }
  });

  function uiLog(method, path, res) {
    var box = document.getElementById('apiLog');
    if (!box) return;
    if (box.getAttribute('data-empty') === '1') {
      box.innerHTML = '';
      box.removeAttribute('data-empty');
    }
    var row = document.createElement('div');
    row.className = 'api-line ' + (res.status === 200 ? 'ok' : 'bad');
    var brief = res.status === 200 && res.body.p_token
      ? 'p_token = ' + res.body.p_token.slice(0, 26) + '\u2026'
      : JSON.stringify(res.body).slice(0, 160);
    row.innerHTML = '<span class="m">' + esc(method) + '</span>' +
                    '<span class="p">' + esc(path) + '</span>' +
                    '<span class="s">' + res.status + '</span>' +
                    '<span class="b">' + esc(brief) + '</span>';
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
    while (box.childNodes.length > 60) box.removeChild(box.firstChild);
  }

  async function uiCall(kind) {
    var auth = function (t) { return { headers: { authorization: 'Bearer ' + t } }; };
    var method = 'GET', path = '/api/profile', opts = {}, suffix = '', t;
    switch (kind) {
      case 'no': opts = {}; suffix = ' [\u65e0 token]'; break;
      case 'ok': opts = auth(uiToken || ''); break;
      case 'data': path = '/api/vault/data'; opts = auth(uiToken || ''); break;
      case 'scope': method = 'POST'; path = '/api/vault/transfer'; opts = auth(uiToken || ''); break;
      case 'tamper':
        t = (uiToken || '').split('.');
        if (t.length === 4) t[3] = (t[3][0] === 'A' ? 'B' : 'A') + t[3].slice(1);
        opts = auth(t.join('.'));
        suffix = ' [\u7be1\u6539\u540e]';
        break;
      case 'decoy': opts = auth(await OBF.api.decoy()); suffix = ' [\u8bf1\u53d1]'; break;
      case 'logout': method = 'POST'; path = '/api/logout'; opts = auth(uiToken || ''); break;
      case 'replay': opts = auth(uiToken || ''); suffix = ' [\u91cd\u653e]'; break;
      default: return;
    }
    var res = await OBF.api.request(method, path, opts);
    uiLog(method, path + suffix, res);
  }

  function bindUI() {
    if (bound) return;
    var form = document.getElementById('loginForm');
    if (!form) return;
    bound = true;
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      var user = document.getElementById('apiUser').value;
      var pass = document.getElementById('apiPass').value;
      var res = await OBF.api.login({ user: user, pass: pass });
      var box = document.getElementById('apiToken');
      if (res.status === 200) {
        uiToken = res.body.p_token;
        box.dataset.state = 'on';
        box.textContent = uiToken;
      } else {
        uiToken = null;
        box.dataset.state = 'off';
        box.textContent = '\u767b\u5f55\u5931\u8d25\uff1a' + res.body.error;
      }
      uiLog('POST', '/api/login', res);
    });
    Array.prototype.forEach.call(document.querySelectorAll('[data-call]'), function (btn) {
      btn.addEventListener('click', function () { uiCall(btn.getAttribute('data-call')); });
    });
    var list = document.getElementById('bindList');
    if (list) {
      list.innerHTML = '<div class="bind-title">p_token 密钥绑定的 13 个技术层 · 改动任意一层即换密钥</div>' +
        OBF.binding.modules().map(function (m) {
          return '<div class="bind-item"><b>' + esc(m.tag) + ' ' + esc(m.name) + '</b>' +
                 '<span>' + esc(m.tech) + '</span></div>';
        }).join('');
    }
  }

  OBF.register({
    id: 'api',
    title: '11 · API 网关 / p_token',
    tags: ['登录签发', 'HMAC-SHA256', 'AES-GCM 载荷', '12 环密钥链', '平坦化校验', '常数时间比较',
           '环境绑定', '时间窗口', 'scope 鉴权', '会话撤销', '防重放', '自防御', 'Proxy 防替换', '诱饵 token'],
    run: async function () {
      await init();
      bindUI();
      var A = OBF.api, r, tok, p;

      var mods = OBF.binding.modules();
      var d = await OBF.binding.digest();
      OBF.check('13 个模块输出全部绑定进密钥',
        mods.length === 13 && mods.every(function (m) { return d.indexOf(m.tag + ':') >= 0; }),
        mods.length + ' 层，全层指纹 ' + U.fnv(d));
      OBF.check('AES-CBC → AES-GCM 双层载荷封装',
        OBF.binding.codec.mode.indexOf('CBC') >= 0 && OBF.binding.codec.mode.indexOf('GCM') >= 0,
        OBF.binding.codec.mode);
      var kp = await OBF.binding.keys();
      OBF.check('RSA-OAEP / ECDSA 公钥并入密钥熵',
        !kp.available || d.indexOf(kp.pub) >= 0 || d.indexOf('fallback|') >= 0,
        kp.available ? 'JWK 指纹参与 PBKDF2 派生' : '无 crypto.subtle，走降级熵');

      r = await A.request('GET', '/api/profile');
      OBF.check('\u672a\u5e26 p_token \u2192 401', r.status === 401, r.body.error);

      r = await A.login({ user: USER, pass: 'wrong-password' });
      OBF.check('\u9519\u8bef\u51ed\u636e \u2192 401', r.status === 401, '\u53e3\u4ee4\u6458\u8981\u52a0\u9690\u5199/vm/wasm \u76d0');

      r = await A.login({ user: USER, pass: PASS });
      tok = r.body.p_token || '';
      OBF.check('\u767b\u5f55\u6210\u529f\u7b7e\u53d1 p_token',
        r.status === 200 && /^p1\./.test(tok) && tok.split('.').length === 4,
        '4 \u6bb5\u7ed3\u6784\uff0c' + tok.length + ' \u5b57\u7b26');
      OBF.check('p_token \u4e0d\u542b\u660e\u6587\u8eab\u4efd', tok.indexOf(USER) < 0,
        'payload \u4e3a AES-GCM \u5bc6\u6587');

      p = { headers: { authorization: 'Bearer ' + tok } };
      r = await A.request('GET', '/api/profile', p);
      OBF.check('\u643a\u5e26 p_token \u2192 200', r.status === 200 && r.body.sub === USER,
        'role = ' + (r.body.role || '-'));
      OBF.check('\u63a2\u6d4b\u578b\u6280\u672f\u53c2\u4e0e\u6821\u9a8c\u95f8\u95e8',
        !!LAST_PROBE && OBF.binding.gate(LAST_PROBE),
        '\u4e00\u6b21\u6027 getter / toPrimitive / Proxy apply / \u81ea\u9632\u5fa1 / \u65f6\u95f4\u5dee / DevTools / \u6808\u6307\u7eb9');

      r = await A.request('GET', '/api/vault/data', p);
      OBF.check('\u53d7\u4fdd\u62a4\u6570\u636e\u63a5\u53e3 \u2192 200', r.status === 200 && r.body.records === 3,
        'scope = data:read');

      r = await A.request('POST', '/api/vault/transfer', p);
      OBF.check('scope \u4e0d\u8db3 \u2192 403', r.status === 403 && !!r.body.required,
        '\u9700\u8981 ' + (r.body.required || ''));

      var seg = tok.split('.');
      seg[3] = (seg[3][0] === 'A' ? 'B' : 'A') + seg[3].slice(1);
      r = await A.request('GET', '/api/profile', { headers: { authorization: 'Bearer ' + seg.join('.') } });
      OBF.check('\u7be1\u6539\u7b7e\u540d \u2192 401', r.status === 401, 'HMAC \u9a8c\u7b7e\u5931\u8d25');

      var fake = await decoy();
      r = await A.request('GET', '/api/profile', { headers: { authorization: 'Bearer ' + fake } });
      OBF.check('\u8bf1\u53d1 token \u2192 401', r.status === 401, '\u683c\u5f0f\u5408\u6cd5\u4f46\u7b7e\u540d\u4e0d\u5bf9');

      var alien = await issue(USER, ['profile:read'], { fp: 'alien-fingerprint' });
      r = await A.request('GET', '/api/profile', { headers: { authorization: 'Bearer ' + alien } });
      OBF.check('\u6362\u73af\u5883\u6307\u7eb9 \u2192 401', r.status === 401, 'sealKey \u7ed1\u5b9a\u73af\u5883');

      var expTok = await issue(USER, ['profile:read']);
      var info = await inspectToken(expTok);
      expireSession(info.jti, Date.now() - 1000);
      r = await A.request('GET', '/api/profile', { headers: { authorization: 'Bearer ' + expTok } });
      OBF.check('\u670d\u52a1\u7aef\u63d0\u524d\u5931\u6548 \u2192 401', r.status === 401, 'session.exp \u9ed1\u540d\u5355');

      var km = await keyMaterial();
      var other = await OBF.crypto.derive('p_token/mac/v1', 'tampered-chain');
      var m1 = await mac(km.macKey, 'same-input');
      var m2 = await mac(other, 'same-input');
      OBF.check('\u7b7e\u540d\u5bc6\u94a5\u7531 12 \u73af\u6d3e\u751f', m1 !== m2,
        '\u6539\u4efb\u4e00\u73af\u5373\u6362\u5bc6\u94a5');

      var patched = OBF.antidebug.selfDefend(verify, '00000000');
      var blocked = false;
      try { await patched(tok); }
      catch (e) { blocked = /integrity/.test(e.message); }
      OBF.check('\u7ed9\u6821\u9a8c\u5668\u6253\u8865\u4e01 \u2192 \u62d2\u7edd', blocked,
        '\u6e90\u7801 FNV \u4e0e\u9884\u671f\u4e0d\u7b26');

      var before = A.verify;
      A.verify = function () { return { ok: true, code: 200 }; };
      OBF.check('Proxy \u62e6\u622a verify \u88ab\u66ff\u6362', A.verify === before && typeof A.verify === 'function',
        '\u65e0\u6cd5\u7528\u5047\u6821\u9a8c\u5668\u8986\u76d6');

      r = await A.request('POST', '/api/logout', p);
      OBF.check('logout \u64a4\u9500\u4f1a\u8bdd', r.status === 200, 'jti \u8fdb\u5165\u9ed1\u540d\u5355');
      r = await A.request('GET', '/api/profile', p);
      OBF.check('\u64a4\u9500\u540e\u91cd\u653e \u2192 401', r.status === 401, '\u9632\u91cd\u653e');

      return 'POST /api/login \u2192 p_token \u2192 3 \u4e2a\u53d7\u4fdd\u62a4\u63a5\u53e3\uff0c20 \u9879\u9274\u6743\u81ea\u68c0';
    }
  });
})(window);
