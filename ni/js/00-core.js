/* 00-core.js — 共享基础设施：命名空间、字节编解码、流密码、隐写、自检登记 */
(function (root) {
  'use strict';

  var OBF = root.OBF = root.OBF || {};
  OBF.layers = [];
  OBF.checks = [];
  OBF.logs = [];

  OBF.register = function (layer) { OBF.layers.push(layer); };

  OBF.log = function (kind, text) {
    var line = { kind: kind, text: text, at: Date.now() };
    OBF.logs.push(line);
    if (typeof OBF.onLog === 'function') OBF.onLog(line);
  };

  OBF.check = function (name, ok, detail) {
    var pass = !!ok;
    OBF.checks.push({ name: name, ok: pass, detail: detail || '' });
    OBF.log(pass ? 'PASS' : 'FAIL', name + (detail ? '  →  ' + detail : ''));
    return pass;
  };

  OBF.skip = function (name, reason) {
    OBF.checks.push({ name: name, ok: null, detail: reason });
    OBF.log('SKIP', name + '  →  ' + reason);
  };

  var te = new TextEncoder();
  var td = new TextDecoder();

  function utf8(s) { return te.encode(s); }
  function fromUtf8(b) { return td.decode(new Uint8Array(b)); }

  function hex(bytes) {
    var out = '';
    for (var i = 0; i < bytes.length; i++) out += ('0' + bytes[i].toString(16)).slice(-2);
    return out;
  }

  function unhex(h) {
    var out = new Uint8Array(h.length >> 1);
    for (var i = 0; i < out.length; i++) out[i] = parseInt(h.substr(i * 2, 2), 16);
    return out;
  }

  function b64(bytes) {
    var s = '';
    for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
    return root.btoa(s);
  }

  function unb64(s) {
    var raw = root.atob(s), out = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
    return out;
  }

  function xor(a, b) {
    var out = new Uint8Array(a.length);
    for (var i = 0; i < a.length; i++) out[i] = a[i] ^ b[i % b.length];
    return out;
  }

  function rc4(key, data) {
    var s = new Uint8Array(256), i, j = 0, t;
    for (i = 0; i < 256; i++) s[i] = i;
    for (i = 0; i < 256; i++) {
      j = (j + s[i] + key[i % key.length]) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
    }
    i = j = 0;
    var out = new Uint8Array(data.length);
    for (var n = 0; n < data.length; n++) {
      i = (i + 1) & 255;
      j = (j + s[i]) & 255;
      t = s[i]; s[i] = s[j]; s[j] = t;
      out[n] = data[n] ^ s[(s[i] + s[j]) & 255];
    }
    return out;
  }

  function rand(seed) {
    var t = seed >>> 0;
    return function () {
      t = (t + 0x6d2b79f5) >>> 0;
      var r = t;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function fnv(str) {
    var h = 0x811c9dc5;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
    return ('00000000' + (h >>> 0).toString(16)).slice(-8);
  }

  function randomBytes(n) {
    var out = new Uint8Array(n);
    if (root.crypto && root.crypto.getRandomValues) {
      root.crypto.getRandomValues(out);
    } else {
      var r = rand((Date.now() ^ 0x9e3779b9) >>> 0);
      for (var i = 0; i < n; i++) out[i] = (r() * 256) | 0;
    }
    return out;
  }

  /* 零宽字符隐写：0→U+200B 1→U+200C，按 UTF-16 码元编码 */
  var Z0 = '\u200b', Z1 = '\u200c';

  function stegoHide(text) {
    var bits = '', i, c;
    for (i = 0; i < text.length; i++) {
      c = text.charCodeAt(i).toString(2);
      while (c.length < 16) c = '0' + c;
      bits += c;
    }
    var out = '';
    for (i = 0; i < bits.length; i++) out += bits[i] === '1' ? Z1 : Z0;
    return out;
  }

  function stegoReveal(source) {
    var bits = '', i;
    for (i = 0; i < source.length; i++) {
      if (source[i] === Z0) bits += '0';
      else if (source[i] === Z1) bits += '1';
    }
    var out = '';
    for (i = 0; i + 16 <= bits.length; i += 16) {
      out += String.fromCharCode(parseInt(bits.substr(i, 16), 2));
    }
    return out;
  }

  function jsEval(src) { return root.Function(src)(); }
  function jsVal(expr) { return root.Function('return ' + expr + ';')(); }

  OBF.util = {
    utf8: utf8, fromUtf8: fromUtf8,
    hex: hex, unhex: unhex, b64: b64, unb64: unb64,
    xor: xor, rc4: rc4, rand: rand, fnv: fnv,
    randomBytes: randomBytes,
    stegoHide: stegoHide, stegoReveal: stegoReveal,
    jsEval: jsEval, jsVal: jsVal
  };
})(window);
