/* 12-binding.js — 把全部模块的确定性输出压进 p_token 密钥；探测型技术作为校验闸门 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  var MODULES = [
    { tag: '00', name: '核心工具', tech: 'hex / base64 / XOR / RC4 / FNV / CSPRNG / 零宽隐写' },
    { tag: '01', name: '词法混淆', tech: 'Unicode 转义 / 同形字 / 数字变形 / \\xXX / 计算属性 / sourceURL' },
    { tag: '02', name: '字符串加密', tech: '串表轮转 IIFE / 反射解码器 / RC4 / 分包拼接' },
    { tag: '03', name: '控制流', tech: '平坦化 FNV / throw-catch goto / 不透明谓词' },
    { tag: '04', name: '反调试', tech: '环境指纹 / 源码哈希 / debugger 陷阱摘要' },
    { tag: '05', name: 'WebCrypto', tech: 'SHA / HMAC / PBKDF2 / AES-CBC / AES-GCM / RSA-OAEP / ECDSA' },
    { tag: '06', name: 'VM 虚拟化', tech: '指令集 / opcode 多态 / 加密字节码' },
    { tag: '07', name: 'WASM 黑盒', tech: '手写二进制 / 代码段 / 数据段常量' },
    { tag: '08', name: '动态加载', tech: '间接 eval / with 劫持 / sourceURL / 隐写载荷 / 多态壳 / 反调试闸门' },
    { tag: '09', name: '极简字符集', tech: 'JSFuck 自举 / JJEncode / AAEncode' },
    { tag: '10', name: '全链路', tech: '12 环密钥链 / 时间锁 / 自防御' },
    { tag: '11', name: 'API 网关', tech: 'HMAC 签名 / scope / 撤销 / Proxy 防替换' },
    { tag: '12', name: '全层绑定', tech: 'CBC→GCM 双层封装 / 熵汇总 / 闸门' }
  ];

  var CACHED = null, KEYS = null;

  /* 一次性生成并缓存 ECDSA / RSA 密钥对，导出公钥参与密钥派生（签名随机性不进熵） */
  async function keys() {
    if (KEYS) return KEYS;
    var sub = root.crypto && root.crypto.subtle;
    if (!sub) { KEYS = { available: false }; return KEYS; }
    try {
      var ec = await sub.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
      var rsa = await sub.generateKey({
        name: 'RSA-OAEP', modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256'
      }, true, ['encrypt', 'decrypt']);
      var ecJwk = await sub.exportKey('jwk', ec.publicKey);
      var rsaJwk = await sub.exportKey('jwk', rsa.publicKey);
      KEYS = {
        available: true, sub: sub, ec: ec, rsa: rsa,
        pub: JSON.stringify(ecJwk) + '|' + JSON.stringify(rsaJwk)
      };
    } catch (e) {
      KEYS = { available: false };
    }
    return KEYS;
  }

  /* 05 层全部原语各取一份确定性输出作为熵 */
  async function cryptoEntropy() {
    try {
      return await cryptoEntropyInner();
    } catch (e) {
      return U.fnv('fallback|' + OBF.crypto.codec.mode);
    }
  }

  async function cryptoEntropyInner() {
    var k = await keys();
    if (!k.available) return U.fnv('fallback|' + OBF.crypto.codec.mode);
    var sub = k.sub, msg = U.utf8('binding'), iv = new Uint8Array(16);
    var kb = new Uint8Array(await sub.digest('SHA-256', U.utf8('OBF12')));
    var cbc = await sub.importKey('raw', kb, { name: 'AES-CBC' }, false, ['encrypt']);
    var ct = new Uint8Array(await sub.encrypt({ name: 'AES-CBC', iv: iv }, cbc, msg));
    var hk = await sub.importKey('raw', kb, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    var mac = new Uint8Array(await sub.sign('HMAC', hk, msg));
    var pb = await sub.importKey('raw', U.utf8('pw'), { name: 'PBKDF2' }, false, ['deriveBits']);
    var bits = new Uint8Array(await sub.deriveBits({
      name: 'PBKDF2', salt: U.utf8('s'), iterations: 1000, hash: 'SHA-256'
    }, pb, 128));
    var sig = new Uint8Array(await sub.sign({ name: 'ECDSA', hash: 'SHA-256' }, k.ec.privateKey, msg));
    var sigOk = await sub.verify({ name: 'ECDSA', hash: 'SHA-256' }, k.ec.publicKey, sig, msg);
    var wrapped = new Uint8Array(await sub.encrypt({ name: 'RSA-OAEP' }, k.rsa.publicKey, kb));
    var opened = new Uint8Array(await sub.decrypt({ name: 'RSA-OAEP' }, k.rsa.privateKey, wrapped));
    return [U.hex(ct), U.hex(mac), U.hex(bits), String(sigOk), U.hex(opened), k.pub].join('|');
  }

  /* 每个模块至少贡献一项输出；结果缓存，保证签发与多次校验完全一致 */
  async function digest() {
    if (CACHED) return CACHED;
    var p = [];
    function add(tag, v) { p.push(tag + ':' + String(v)); }

    add('00', U.hex(U.xor(U.utf8('core'), U.utf8('\x5a'))) + U.b64(U.utf8('core')));
    add('01', U.jsVal(OBF.lexical.variants[0]) + U.jsVal(OBF.lexical.xSrc) + OBF.lexical.stegoKey);
    add('01b', U.fnv(OBF.lexical.variants.join('')));
    add('02', OBF.strings.table.raw.join('') + U.hex(OBF.strings.rc4Key));
    add('02b', OBF.strings.encodeChars(OBF.strings.table.get(2)).join(','));
    add('03', OBF.controlflow.flatten(p.join('')));
    add('03b', OBF.controlflow.throwGoto(0x1f) + '/' +
               OBF.controlflow.opaqueTrue(7) + '/' + OBF.controlflow.opaqueFalse(7));
    add('04', OBF.antidebug.fingerprint() + OBF.antidebug.digest + U.fnv(OBF.antidebug.trapSource));
    add('05', await cryptoEntropy());
    add('06', OBF.vm.plain + OBF.vm.mnemonics.join('') + U.fnv(String(OBF.vm.build(0x5a, 1).blob.length)));
    add('07', U.hex(OBF.wasm.bytes) + OBF.wasm.hidden);
    add('08', U.jsVal('(0, eval)("1+1")') + '/' +
              (new Function('o', 'with(o){return v;}'))({ v: 0x2a }) + '/' +
              OBF.loader.stegoPayload + '/' +
              (new Function('return 1; //# sourceURL=vendor/binding.js'))());
    add('09', OBF.esoteric.jsfuck('obfuscate 2026'));
    add('09b', OBF.esoteric.jjencode('obfuscate 2026'));
    add('09c', OBF.esoteric.aaencode('obfuscate 2026'));
    add('10', OBF.layers.map(function (l) { return l.id; }).join(',') + '/' + OBF.layers.length);
    add('11', OBF.layers.filter(function (l) { return l.id === 'api'; }).length);
    add('12', U.fnv(OBF.binding.codec.mode));

    CACHED = p.join('|');
    return CACHED;
  }

  /* AES-CBC（固定长度 IV 前缀）→ AES-GCM 双层；无 subtle 时 CBC 层直通、GCM 层走 RC4 降级 */
  async function cbcSeal(key, data) {
    var sub = root.crypto && root.crypto.subtle;
    if (!sub) return data;
    var iv = U.randomBytes(16);
    var kb = new Uint8Array(await sub.digest('SHA-256', key));
    var k = await sub.importKey('raw', kb, { name: 'AES-CBC' }, false, ['encrypt']);
    var ct = new Uint8Array(await sub.encrypt({ name: 'AES-CBC', iv: iv }, k, data));
    var out = new Uint8Array(16 + ct.length);
    out.set(iv, 0);
    out.set(ct, 16);
    return out;
  }

  async function cbcUnseal(key, blob) {
    var sub = root.crypto && root.crypto.subtle;
    if (!sub) return blob;
    var kb = new Uint8Array(await sub.digest('SHA-256', key));
    var k = await sub.importKey('raw', kb, { name: 'AES-CBC' }, false, ['decrypt']);
    return new Uint8Array(await sub.decrypt({ name: 'AES-CBC', iv: blob.slice(0, 16) }, k, blob.slice(16)));
  }

  var codec = {
    mode: 'AES-CBC → AES-GCM (降级 RC4)',
    seal: async function (key, data) {
      return OBF.crypto.codec.seal(key, await cbcSeal(key, data));
    },
    unseal: async function (key, blob) {
      return cbcUnseal(key, await OBF.crypto.codec.unseal(key, blob));
    }
  };

  /* 探测型 / 一次性技术不进密钥（会让 token 跨环境失效），只作为校验闸门 */
  function probe() {
    var t0 = performance.now(), spin = 0, i;
    for (i = 0; i < 2000; i++) spin += (i ^ 0x5a);
    var dt = performance.now() - t0;
    var bait = {}, hits = 0;
    Object.defineProperty(bait, 'id', {
      configurable: true, get: function () { hits++; return 0x2a; }
    });
    var a = bait.id, b = bait.id;
    var token = {};
    token[Symbol.toPrimitive] = function () { return 0x2a; };
    var px = new Proxy(function () { return 1; }, { apply: function (t) { return t() + 1; } });
    return {
      timingMs: dt, spin: spin,
      devtools: (root.outerWidth - root.innerWidth > 160) || (root.outerHeight - root.innerHeight > 160),
      stack: !!(new Error().stack),
      nativeEval: String(eval).indexOf('[native code]') >= 0,
      onceGetter: a === 0x2a && b === 0x2a && hits === 2,
      toPrimitive: +token === 0x2a,
      proxyApply: px() === 2,
      selfDefend: typeof OBF.antidebug.selfDefend === 'function'
    };
  }

  OBF.binding = {
    modules: function () { return MODULES.slice(); },
    digest: digest, codec: codec, probe: probe,
    keys: keys,
    gate: function (p) { return p.onceGetter && p.toPrimitive && p.proxyApply && p.selfDefend; }
  };
})(window);
