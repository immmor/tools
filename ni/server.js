#!/usr/bin/env node
'use strict';
/* server.js — 零依赖 Node 原生 HTTP 登录网关，把 ni/ 的混淆链搬到服务端
   运行: node server.js            自检: node server.js --self-test
   环境变量: PORT / P_TOKEN_MASTER(64位hex) / LOGIN_USER / LOGIN_PASS / P_TOKEN_TTL(秒)
   演示账号: admin / ni-2026     不设 P_TOKEN_MASTER 则每次启动随机，重启后旧 token 失效 */
const http = require('node:http');
const crypto = require('node:crypto');
const os = require('node:os');
const vmx = require('node:vm');

const PORT = Number(process.env.PORT || 8787);
const TTL = Number(process.env.P_TOKEN_TTL || 300) * 1000;
const MASTER_ENV = process.env.P_TOKEN_MASTER;
const MASTER = MASTER_ENV && /^[0-9a-fA-F]{64}$/.test(MASTER_ENV)
  ? Buffer.from(MASTER_ENV, 'hex')
  : crypto.randomBytes(32);
const DEMO_USER = ['\x61', '\x64', '\x6d', '\x69', '\x6e'].join('');
const DEMO_PASS = ['\x6e', '\x69', '\x2d', '\x32', '\x30', '\x32', '\x36'].join('');
const LOGIN_USER = process.env.LOGIN_USER || DEMO_USER;
const LOGIN_PASS = process.env.LOGIN_PASS || DEMO_PASS;

/* ---------- 00 核心工具 ---------- */
function fnv(s) {
  let h = 0x811c9dc5;
  for (const c of Buffer.from(String(s), 'utf8')) { h ^= c; h = Math.imul(h, 0x01000193); }
  return (h >>> 0).toString(16).padStart(8, '0');
}
const b64u = b => Buffer.from(b).toString('base64url');
const unb64u = s => Buffer.from(String(s), 'base64url');
function xor(a, b) {
  const o = Buffer.allocUnsafe(a.length);
  for (let i = 0; i < a.length; i++) o[i] = a[i] ^ b[i % b.length];
  return o;
}
function rc4(key, data) {
  const s = new Uint8Array(256);
  let j = 0, t;
  for (let i = 0; i < 256; i++) s[i] = i;
  for (let i = 0; i < 256; i++) { j = (j + s[i] + key[i % key.length]) & 255; t = s[i]; s[i] = s[j]; s[j] = t; }
  let a = 0;
  j = 0;
  const out = Buffer.allocUnsafe(data.length);
  for (let n = 0; n < data.length; n++) {
    a = (a + 1) & 255; j = (j + s[a]) & 255;
    t = s[a]; s[a] = s[j]; s[j] = t;
    out[n] = data[n] ^ s[(s[a] + s[j]) & 255];
  }
  return out;
}
function rand(seed) {
  let t = seed >>> 0;
  return function () {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
function constantEq(a, b) {
  const x = Buffer.from(String(a), 'utf8'), y = Buffer.from(String(b), 'utf8');
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const Z0 = '\u200b', Z1 = '\u200c';
function stegoHide(text) {
  let bits = '';
  for (const ch of text) bits += ch.charCodeAt(0).toString(2).padStart(16, '0');
  return [...bits].map(b => b === '1' ? Z1 : Z0).join('');
}
function stegoReveal(src) {
  let bits = '', out = '';
  for (const ch of String(src)) { if (ch === Z0) bits += '0'; else if (ch === Z1) bits += '1'; }
  for (let i = 0; i + 16 <= bits.length; i += 16) out += String.fromCharCode(parseInt(bits.substr(i, 16), 2));
  return out;
}

/* ---------- 01 词法 / 隐写 ---------- */
const CARRIER = new Function('return function carrier(){/*' + stegoHide('STEGO-9F3C') + '*/\nreturn 0x2a;};')();
const STEGO_KEY = stegoReveal(CARRIER.toString());
const NUM_VARIANTS = ['(0x2f3c|0)', '(parseInt("2f3c",16))', '(void 0,(0x2f3c))', '(+[]+0x2f3c)', '([][[]]?0:0x2f3c)'];
const LEX_SUM = NUM_VARIANTS.reduce((s, e) => s + new Function('return ' + e + ';')(), 0);
const LEX_WORD = new Function("return '\\x4c\\x45\\x58\\x49\\x43\\x41\\x4c';")();
const FORGED = new Function('return 1; //# sourceURL=vendor/angular.core.mjs')();

/* ---------- 02 字符串串表 + 轮转 IIFE ---------- */
const STR_KEY = Buffer.from('5a317b0e', 'hex');
const STR_TABLE = (function () {
  const plain = ['OBFUSCATE', 'string-array', 'rotation', 'decoder', 'XOR+RC4+BASE64', 'payload', 'SENTINEL', 'bootstrap'];
  const shift = 9, arr = plain.map(s => xor(Buffer.from(s), STR_KEY).toString('base64'));
  for (let i = 0; i < shift; i++) arr.push(arr.shift());
  return {
    raw: arr,
    get(i) {
      const n = arr.length, p = ((i - (shift % n)) % n + n) % n;
      return xor(Buffer.from(arr[p], 'base64'), STR_KEY).toString();
    }
  };
}());
const REFLECT_DECODER = ([] + [])[
  ['\u0063\u006f\u006e', '\u0073\u0074\u0072', '\u0075\u0063\u0074\u006f\u0072'].join('')
][['\u0066\u0072\u006f\u006d', '\u0043\u0068\u0061\u0072', '\u0043\u006f\u0064\u0065'].join('')];

/* ---------- 03 控制流：连续掩码的平坦化分发器 ---------- */
const opaqueTrue = n => (n * n + n + 1) % 2 === 1;
const opaqueFalse = n => (n * n + n) % 2 === 1;
const S = [0x37, 0x36, 0x35, 0x34, 0x33], EXIT = 0x31;
function fnvRef(s) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}
function flatFnv(text) {
  let acc = 0, i = 0, out = 0, state = S[0], guard = 0;
  while (guard++ < 100000) {
    switch (state ^ 0x37) {
      case 0:
        if (opaqueFalse(guard)) return -1;
        acc = 0x811c9dc5; i = 0; state = text.length ? S[1] : S[3]; break;
      case 1:
        acc = Math.imul(acc ^ text.charCodeAt(i), 0x01000193) >>> 0;
        i++; state = S[2]; break;
      case 2:
        state = opaqueTrue(i) ? (i < text.length ? S[1] : S[3]) : EXIT;
        if (state === EXIT) out = 0xdeadbeef;
        break;
      case 3: out = acc; state = EXIT; break;
      case 4: out = 0xbaadf00d; state = EXIT; break;
      default: return out >>> 0;
    }
  }
  return 0;
}
function throwGoto(n) {
  let acc = 0, step = 'a', guard = 0;
  while (guard++ < 32) {
    try {
      switch (step) {
        case 'a': acc += 3; throw { to: 'b' };
        case 'b': acc = Math.imul(acc, 5); throw { to: 'c' };
        case 'c': acc -= 1; throw { to: 'd' };
        case 'd': acc ^= 0x2f; throw { to: 'e' };
        case 'e': acc += n; throw { to: 'end' };
        default: return acc >>> 0;
      }
    } catch (e) {
      if (!e || typeof e.to !== 'string') throw e;
      step = e.to;
      if (step === 'end') return acc >>> 0;
    }
  }
  return -1;
}

/* ---------- 04 运行时完整性 / 闸门 ---------- */
function selfDefend(fn, expected) {
  return function () {
    if (fnv(fn.toString()) !== expected) throw new Error('integrity violation');
    return fn.apply(this, arguments);
  };
}
function probe() {
  const bait = {};
  let hits = 0;
  Object.defineProperty(bait, 'id', { configurable: true, get() { hits++; return 0x2a; } });
  const a = bait.id, b = bait.id;
  const token = {};
  token[Symbol.toPrimitive] = () => 0x2a;
  const px = new Proxy(() => 1, { apply: f => f() + 1 });
  return a === 0x2a && b === 0x2a && hits === 2 && +token === 0x2a && px() === 2;
}

/* ---------- 05 密码学：全原语各取一份确定性输出作为熵 ---------- */
const EC = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const RSA = crypto.generateKeyPairSync('rsa', { modulusLength: 2048, publicExponent: 0x10001 });
const OAEP = { padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: 'sha256' };
const CRYPTO_ENTROPY = (function () {
  const m = Buffer.from('binding');
  const ecPub = EC.publicKey.export({ type: 'spki', format: 'der' });
  const rsaPub = RSA.publicKey.export({ type: 'spki', format: 'der' });
  const sha = crypto.createHash('sha256').update(m).digest();
  const hmac = crypto.createHmac('sha256', MASTER).update(m).digest();
  const pbkdf2 = crypto.pbkdf2Sync('pw', 'salt', 1000, 16, 'sha256');
  const iv = Buffer.alloc(16);
  const c = crypto.createCipheriv('aes-256-cbc', MASTER, iv);
  const cbc = Buffer.concat([c.update(m), c.final()]);
  const sig = crypto.sign('sha256', m, EC.privateKey);
  const sigOk = crypto.verify('sha256', m, EC.publicKey, sig);
  const wrapped = crypto.publicEncrypt({ key: RSA.publicKey, ...OAEP }, sha);
  const opened = crypto.privateDecrypt({ key: RSA.privateKey, ...OAEP }, wrapped);
  return [sha.toString('hex'), hmac.toString('hex'), pbkdf2.toString('hex'),
          cbc.toString('hex'), String(sigOk), opened.toString('hex'),
          ecPub.toString('hex'), rsaPub.toString('hex')].join('|');
}());
function sealAll(key, data) {
  const iv1 = crypto.randomBytes(16);
  const c1 = crypto.createCipheriv('aes-256-cbc', key, iv1);
  const cbc = Buffer.concat([iv1, c1.update(data), c1.final()]);
  const iv2 = crypto.randomBytes(12);
  const c2 = crypto.createCipheriv('aes-256-gcm', key, iv2);
  return Buffer.concat([iv2, c2.update(cbc), c2.final(), c2.getAuthTag()]);
}
function unsealAll(key, blob) {
  const d2 = crypto.createDecipheriv('aes-256-gcm', key, blob.subarray(0, 12));
  d2.setAuthTag(blob.subarray(blob.length - 16));
  const cbc = Buffer.concat([d2.update(blob.subarray(12, blob.length - 16)), d2.final()]);
  const d1 = crypto.createDecipheriv('aes-256-cbc', key, cbc.subarray(0, 16));
  return Buffer.concat([d1.update(cbc.subarray(16)), d1.final()]);
}

/* ---------- 06 VM：opcode 多态 + 加密字节码 + FETCH/EXEC 平坦分发 ---------- */
const VM_OPS = ['NOP', 'IMM', 'LDM', 'XOR', 'SUB', 'INC', 'OUT', 'JZ', 'JMP', 'HALT'];
const VM_PLAIN = 'VIRTUALIZED';
function scramble(prog, seed) {
  const r = rand(seed >>> 0);
  return prog.map(ins => ins.map(v => (v ^ ((r() * 256) | 0)) >>> 0));
}
function vmBuild(key, seed) {
  const r = rand(seed >>> 0), pool = [];
  for (let i = 1; i <= 255; i++) pool.push(i);
  for (let j = pool.length - 1; j > 0; j--) {
    const k = (r() * (j + 1)) | 0;
    const t = pool[j]; pool[j] = pool[k]; pool[k] = t;
  }
  const map = {}, rev = Object.create(null);
  VM_OPS.forEach((m, i) => { map[m] = pool[i]; rev[pool[i]] = m; });
  const mem = [...VM_PLAIN].map(c => c.charCodeAt(0) ^ key);
  const src = [
    ['IMM', 0, key, 0], ['IMM', 1, 0, 0], ['IMM', 2, mem.length, 0],
    ['LDM', 3, 1, 0], ['XOR', 4, 3, 0, 0], ['OUT', 4, 0, 0], ['INC', 1, 0, 0],
    ['SUB', 5, 2, 1, 0], ['JZ', 5, 11, 0], ['JMP', 3, 0, 0],
    ['NOP', 0, 0, 0], ['HALT', 0, 0, 0]
  ];
  const streamSeed = (key ^ seed) >>> 0;
  return {
    blob: scramble(src.map(ins => [map[ins[0]], ins[1], ins[2], ins[3]]), streamSeed),
    mem, rev, streamSeed, len: src.length
  };
}
function vmExecute(program, mem, rev) {
  const reg = new Int32Array(16), out = [];
  const FETCH = 0x37, EXEC = 0x36;
  let pc = 0, state = FETCH, ins = null, m = null, next = 0;
  for (let guard = 0; guard < 100000; guard++) {
    switch (state ^ 0x37) {
      case 0:
        if (pc >= program.length) return out;
        ins = program[pc]; m = rev[ins[0]];
        state = EXEC;
        break;
      case 1:
        next = pc + 1;
        switch (m) {
          case 'IMM': reg[ins[1]] = ins[2]; break;
          case 'LDM': reg[ins[1]] = mem[reg[ins[2]]] | 0; break;
          case 'XOR': reg[ins[1]] = reg[ins[2]] ^ reg[ins[3]]; break;
          case 'SUB': reg[ins[1]] = (reg[ins[2]] - reg[ins[3]]) | 0; break;
          case 'INC': reg[ins[1]] = (reg[ins[1]] + 1) | 0; break;
          case 'OUT': out.push(reg[ins[1]]); break;
          case 'JZ': if (reg[ins[1]] === 0) next = ins[2]; break;
          case 'JMP': next = ins[1]; break;
          case 'HALT': return out;
          case 'NOP': break;
          default: break;
        }
        pc = next; state = FETCH;
        break;
      default: return out;
    }
  }
  return out;
}
const vmRun = b => String.fromCharCode.apply(null, vmExecute(scramble(b.blob, b.streamSeed), b.mem, b.rev));

/* ---------- 07 WASM 手写二进制（代码段 + 数据段常量走私） ---------- */
function u32(n) {
  const o = [];
  let b;
  do { b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; o.push(b); } while (n);
  return o;
}
const section = (id, p) => [id, ...u32(p.length), ...p];
const HIDDEN = 'WASM-BLACKBOX';
const HIDDEN_BYTES = xor(Buffer.from(HIDDEN), Buffer.from([0x5a]));
const WASM_BYTES = Buffer.from([
  0, 0x61, 0x73, 0x6d, 1, 0, 0, 0,
  ...section(1, [1, 0x60, 1, 0x7f, 1, 0x7f]),
  ...section(3, [1, 0]),
  ...section(5, [1, 0, 1]),
  ...section(7, [2, 1, 0x66, 0, 0, 1, 0x6d, 2, 0]),
  ...section(10, [1, 10, 0, 0x20, 0, 0x41, 0x35, 0x73, 0x41, 0x07, 0x6c, 0x0b]),
  ...section(11, [1, 0, 0x41, 0, 0x0b, ...u32(HIDDEN_BYTES.length), ...HIDDEN_BYTES])
]);
const WASM_EXPORTS = new WebAssembly.Instance(new WebAssembly.Module(WASM_BYTES), {}).exports;
const WASM_FN = WASM_EXPORTS.f;
const WASM_JS_REF = x => Math.imul(x ^ 0x35, 7) | 0;
const WASM_HIDDEN = xor(Buffer.from(new Uint8Array(WASM_EXPORTS.m.buffer, 0, HIDDEN_BYTES.length)), Buffer.from([0x5a])).toString();

/* ---------- 08 动态执行（Node 对应物：vm 沙箱 / Function / 间接 eval） ---------- */
const SANDBOX_OUT = vmx.runInNewContext('(function(x){return x ^ 0x5a;})(0x2f)', Object.create(null), { timeout: 100 });
const INDIRECT_EVAL = (0, eval)('1+1');
const WITH_OUT = new Function('o', 'with(o){return v;}')({ v: 0x2a });
const ASYNC_FN = Object.getPrototypeOf(async function () {}).constructor;

/* ---------- 09 极简字符集：JSFuck 自举 + JJEncode 风味别名表 ---------- */
const JSFUCK = (function () {
  const val = e => new Function('return ' + e + ';')();
  const digitExpr = n => n === 0 ? '(+[]+[])' : '(+(' + Array(n).fill('!![]').join('+') + ')+[])';
  function numExpr(n) {
    const ds = String(n).split('').map(c => digitExpr(+c));
    return ds.length === 1 ? '(+' + ds[0] + ')' : '(+(' + ds.join('+') + '))';
  }
  const bases = [];
  const map = Object.create(null);
  const add = e => bases.push([e, val(e)]);
  function refresh() {
    bases.forEach(function (b) {
      for (let i = 0; i < b[1].length; i++) if (!map[b[1][i]]) map[b[1][i]] = b[0] + '[' + numExpr(i) + ']';
    });
  }
  function strExpr(s) {
    return [...s].map(c => {
      if (!map[c]) throw new Error('charset missing: ' + c);
      return map[c];
    }).join('+');
  }
  add('(![]+[])'); add('(!![]+[])'); add('([][[]]+[])'); add('(+[![]]+[])'); add('({}+[])');
  refresh();
  const fk = strExpr('filter');
  add('([][' + fk + ']+[])');
  refresh();
  const ck = strExpr('constructor');
  add('([][' + ck + ']+[])');
  add('([][' + fk + '][' + ck + ']+[])');
  refresh();
  for (let d = 0; d <= 9; d++) if (!map[String(d)]) map[String(d)] = digitExpr(d);
  return { strExpr, bases, size: Object.keys(map).length };
}());
const jsfuckEncode = t => JSFUCK.strExpr(t);
const jsfuckDecode = e => new Function('return ' + e + ';')();
function aliasEncode(text) {
  let body = JSFUCK.strExpr(text);
  const aliases = JSFUCK.bases.map((b, i) => ({ name: '$' + i, expr: b[0] }))
    .sort((a, b) => b.expr.length - a.expr.length);
  aliases.forEach(a => { body = body.split(a.expr).join(a.name); });
  return '$=~[];' + aliases.map(a => 'var ' + a.name + '=' + a.expr + ';').join('') + 'return ' + body + ';';
}

/* ---------- 10 全层指纹 + 12 环密钥链 ---------- */
const LAYERS = [
  '00 核心工具', '01 词法混淆', '02 字符串加密', '03 控制流', '04 运行时完整性',
  '05 密码学', '06 VM 虚拟化', '07 WASM 黑盒', '08 动态执行', '09 极简字符集',
  '10 密钥链', '11 API 网关', '12 全层绑定'
];
let CACHED_DIGEST = null;
function layerDigest() {
  if (CACHED_DIGEST) return CACHED_DIGEST;
  const p = [];
  const add = (tag, v) => p.push(tag + ':' + String(v));
  add('00', fnv('hex|b64u|xor|rc4|fnv|rand|stego') + fnv(MASTER.toString('hex')));
  add('01', LEX_SUM + LEX_WORD + STEGO_KEY + FORGED + NUM_VARIANTS.join(''));
  add('02', STR_TABLE.raw.join('') + STR_TABLE.get(2) + STR_KEY.toString('hex') +
            REFLECT_DECODER.apply(null, [...LEX_WORD].map(c => c.charCodeAt(0))));
  add('03', flatFnv(p.join('')) + '/' + throwGoto(0x1f) + '/' + opaqueTrue(7) + '/' + opaqueFalse(7));
  add('04', fnv(verify.toString()) + fnv(guardedVerify.toString()) + String(probe()) + os.hostname());
  add('05', CRYPTO_ENTROPY);
  add('06', VM_PLAIN + VM_OPS.join('') + vmRun(vmBuild(0x5a, 1)));
  add('07', WASM_BYTES.toString('hex') + WASM_HIDDEN + WASM_FN(0x2a));
  add('08', SANDBOX_OUT + '/' + INDIRECT_EVAL + '/' + WITH_OUT + '/' + String(ASYNC_FN).slice(0, 64));
  add('09', jsfuckEncode('obfuscate 2026') + aliasEncode('obfuscate 2026') + JSFUCK.size);
  add('10', fnv(MASTER.toString('hex') + STEGO_KEY) + LAYERS.length);
  add('11', Object.keys(ROUTES).length + ROUTES['GET /api/profile']);
  add('12', fnv(sealAll.toString() + unsealAll.toString()));
  CACHED_DIGEST = p.join('|');
  return CACHED_DIGEST;
}
let CTX = null;
function context() {
  if (CTX) return CTX;
  /* ponytail: 环境在单进程内不变，缓存派生密钥；上线换 Redis/KMS 时在此替换 */
  const ld = fnv(layerDigest());
  const fp = fnv([os.hostname(), os.platform(), os.arch(), process.version,
                  MASTER.toString('hex').slice(0, 8)].join('|'));
  const fpNum = parseInt(fp, 16) >>> 0;
  const wasmSeed = WASM_FN(fpNum & 0xff) | 0;
  const vmKey = wasmSeed & 0xff;
  const vmSeed = (fpNum ^ wasmSeed) >>> 0;
  const vmToken = vmRun(vmBuild(vmKey, vmSeed));
  const esoToken = jsfuckDecode(jsfuckEncode('obfuscate 2026'));
  const chain = [STEGO_KEY, vmToken, esoToken, WASM_HIDDEN, fp, ld].join('|');
  CTX = {
    fp, ld, vmToken, esoToken, chainId: fnv(chain),
    macKey: crypto.pbkdf2Sync(chain, Buffer.from('p_token/mac/v1'), 10000, 32, 'sha256'),
    sealKey: crypto.pbkdf2Sync(chain, Buffer.from('p_token/seal/v1|' + fp), 10000, 32, 'sha256')
  };
  return CTX;
}

/* ---------- 11 p_token 签发 / 平坦化校验 ---------- */
const SESSIONS = new Map();
const REVOKED = new Set();
function issue(sub, scope) {
  const c = context(), now = Date.now();
  const header = b64u(Buffer.from(JSON.stringify({
    alg: 'OBF12-HMAC-SHA256', typ: 'p_token', v: 1, cid: c.chainId, ld: c.ld
  })));
  const body = {
    sub, scope, iat: now, exp: now + TTL, jti: crypto.randomBytes(12).toString('hex'),
    fp: c.fp, vm: c.vmToken, eso: c.esoToken, wsm: WASM_HIDDEN
  };
  const ct = b64u(sealAll(c.sealKey, Buffer.from(JSON.stringify(body))));
  const sig = b64u(crypto.createHmac('sha256', c.macKey).update(header + '.' + ct).digest());
  SESSIONS.set(body.jti, body);
  return 'p1.' + header + '.' + ct + '.' + sig;
}
function verify(token) {
  const c = context(), parts = String(token || '').split('.');
  let state = S[0], code = 0, body = null, h = null, guard = 0;
  while (guard++ < 32) {
    switch (state ^ 0x37) {
      case 0:
        if (parts.length !== 4 || parts[0] !== 'p1') code = 401;
        state = code ? EXIT : S[1];
        break;
      case 1:
        try { h = JSON.parse(unb64u(parts[1]).toString('utf8')); } catch (e) { h = null; }
        if (!h || h.cid !== c.chainId || h.ld !== c.ld || h.typ !== 'p_token' || h.v !== 1) code = 401;
        if (!opaqueTrue(guard)) code = 401;
        state = code ? EXIT : S[2];
        break;
      case 2: {
        const expect = crypto.createHmac('sha256', c.macKey).update(parts[1] + '.' + parts[2]).digest('hex');
        let got = '';
        try { got = unb64u(parts[3]).toString('hex'); } catch (e) { got = ''; }
        if (!constantEq(expect, got)) code = 401;
        state = code ? EXIT : S[3];
        break;
      }
      case 3:
        try { body = JSON.parse(unsealAll(c.sealKey, unb64u(parts[2])).toString('utf8')); }
        catch (e) { body = null; code = 401; }
        if (body && !opaqueTrue(guard)) code = 401;
        state = code ? EXIT : S[4];
        break;
      case 4:
        if (!body || body.fp !== c.fp) code = 401;
        else if (Date.now() > body.exp || body.iat > Date.now()) code = 401;
        else if (!SESSIONS.has(body.jti) || REVOKED.has(body.jti)) code = 401;
        else if (Date.now() > SESSIONS.get(body.jti).exp) code = 401;
        else if (body.vm !== c.vmToken || body.eso !== c.esoToken || body.wsm !== WASM_HIDDEN) code = 401;
        else if (!probe()) code = 401;
        state = EXIT;
        break;
      default:
        return { ok: code === 0, code: code || 200, body };
    }
  }
  return { ok: false, code: 401, body: null };
}
const guardedVerify = selfDefend(verify, fnv(verify.toString()));

/* ---------- 凭据 / 限流 / 路由 ---------- */
const CRED_SALT = crypto.createHash('sha256').update(MASTER).update(STEGO_KEY).digest();
const EXPECT_HASH = crypto.pbkdf2Sync(LOGIN_PASS, CRED_SALT, 10000, 32, 'sha256');
function checkCred(user, pass) {
  const got = crypto.pbkdf2Sync(String(pass), CRED_SALT, 10000, 32, 'sha256');
  return user === LOGIN_USER && constantEq(got.toString('hex'), EXPECT_HASH.toString('hex'));
}
const ATTEMPTS = new Map();
function rateLimited(ip) {
  const now = Date.now(), e = ATTEMPTS.get(ip);
  if (!e || now > e.reset) { ATTEMPTS.set(ip, { n: 1, reset: now + 60000 }); return false; }
  e.n++;
  return e.n > 8;
}
const ROUTES = {
  'GET /api/profile': 'profile:read',
  'GET /api/vault/data': 'data:read',
  'POST /api/vault/transfer': 'data:write'
};
function payloadFor(path, b) {
  if (path === '/api/profile') return { sub: b.sub, role: 'administrator', scopes: b.scope, chain: 'OBF12-node' };
  if (path === '/api/vault/data') {
    return { records: 3, items: ['零宽隐写密钥', 'wasm 数据段常量', 'VM 字节码'], seal: fnv(b.jti) };
  }
  return { transferred: true, note: '仅 data:write 可见' };
}
function login(body) {
  body = body || {};
  if (!checkCred(body.user, body.pass)) return { status: 401, body: { error: 'invalid credentials' } };
  const scope = ['profile:read', 'data:read'];
  return {
    status: 200,
    body: { p_token: issue(body.user, scope), token_type: 'Bearer', expires_in: TTL / 1000, scope }
  };
}
function authorize(token, method, path) {
  let v;
  try { v = guardedVerify(token); }
  catch (e) { return { status: 500, body: { error: 'integrity violation' } }; }
  if (!v.ok) return { status: v.code, body: { error: 'p_token invalid or expired' } };
  const b = v.body, key = method + ' ' + path;
  if (key === 'POST /api/logout') { REVOKED.add(b.jti); return { status: 200, body: { revoked: b.jti } }; }
  const need = ROUTES[key];
  if (!need) return { status: 404, body: { error: 'not found' } };
  if (!b.scope.includes(need)) return { status: 403, body: { error: 'scope insufficient', required: need } };
  return { status: 200, body: payloadFor(path, b) };
}
const API = new Proxy({ issue, verify: null, authorize, login }, {
  get(t, k) { return k === 'verify' ? guardedVerify : t[k]; },
  set(t, k, v) { if (k === 'verify') return true; t[k] = v; return true; }
});

/* ---------- HTTP ---------- */
const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store'
};
function send(res, status, obj) {
  const payload = Buffer.from(JSON.stringify(obj));
  res.writeHead(status, {
    ...HEADERS,
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': payload.length
  });
  res.end(payload);
}
function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', c => {
      size += c.length;
      if (size > 65536) { reject(new Error('body too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}); }
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}
const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, HEADERS); return res.end(); }
    const path = new URL(req.url, 'http://localhost').pathname;
    if (req.method === 'GET' && path === '/api/health') {
      return send(res, 200, { ok: true, layers: LAYERS.length, master: MASTER_ENV ? 'env' : 'ephemeral' });
    }
    if (req.method === 'POST' && path === '/api/login') {
      if (rateLimited(req.socket.remoteAddress || '?')) return send(res, 429, { error: 'too many attempts' });
      const r = login(await readBody(req));
      return send(res, r.status, r.body);
    }
    const m = /^Bearer\s+(.+)$/i.exec(req.headers.authorization || '');
    const r = authorize(m ? m[1] : '', req.method, path);
    return send(res, r.status, r.body);
  } catch (e) {
    return send(res, 500, { error: 'internal error' });
  }
});

/* ---------- 唯一的可运行自检 ---------- */
function selfTest() {
  const checks = [];
  const t = (name, ok, detail) => checks.push({ name, ok: !!ok, detail: detail || '' });
  const c = context();

  t('WASM 手写二进制合法', WebAssembly.validate(WASM_BYTES), WASM_BYTES.length + 'B');
  t('WASM 导出函数等价 JS', WASM_FN(0x2a) === WASM_JS_REF(0x2a), 'f(0x2a)=' + WASM_FN(0x2a));
  t('WASM 数据段常量走私', WASM_HIDDEN === HIDDEN, WASM_HIDDEN);
  t('VM 加密字节码解出明文', vmRun(vmBuild(0x5a, 1)) === VM_PLAIN, VM_PLAIN);
  t('VM opcode 多态', JSON.stringify(vmBuild(0x5a, 1).rev) !== JSON.stringify(vmBuild(0x5a, 2).rev), '换 seed 即换映射');
  t('控制流平坦化等价', flatFnv('flattened-control-flow') === fnvRef('flattened-control-flow'), '连续掩码');
  t('不透明谓词', opaqueTrue(123) && !opaqueFalse(123), '(n²+n+1)%2 / (n²+n)%2');
  t('异常跳转 goto', throwGoto(0x1f) === 33 + 0x1f, '5 个基本块');
  t('JSFuck 8 字符集解码', jsfuckDecode(jsfuckEncode('obfuscate 2026')) === 'obfuscate 2026', JSFUCK.size + ' 项字符表');
  t('JJEncode 风味别名表', new Function(aliasEncode('obfuscate 2026'))() === 'obfuscate 2026', '$=~[] 引导');
  t('vm 沙箱 / with / 间接 eval', SANDBOX_OUT === (0x2f ^ 0x5a) && WITH_OUT === 0x2a && INDIRECT_EVAL === 2, 'Node 动态执行通道');
  t('AES-CBC → AES-GCM 双层往返',
    unsealAll(c.sealKey, sealAll(c.sealKey, Buffer.from('hello'))).toString() === 'hello', 'IV+CBC→IV+GCM+tag');
  const broken = Buffer.from(sealAll(c.sealKey, Buffer.from('x')));
  broken[broken.length - 1] ^= 1;
  let rejected = false;
  try { unsealAll(c.sealKey, broken); } catch (e) { rejected = true; }
  t('GCM 认证标签拒绝篡改', rejected, 'auth tag');
  const d = layerDigest();
  t('13 层输出全部绑定进密钥', LAYERS.length === 13 && LAYERS.every((_, i) => d.indexOf(String(i).padStart(2, '0') + ':') >= 0),
    '全层指纹 ' + fnv(d));
  t('常数时间比较', constantEq('abcd', 'abcd') && !constantEq('abcd', 'abce') && !constantEq('a', 'aa'), 'timingSafeEqual');

  t('错误凭据 → 401', login({ user: LOGIN_USER, pass: 'wrong' }).status === 401, 'PBKDF2 + timingSafeEqual');
  const r = login({ user: LOGIN_USER, pass: LOGIN_PASS });
  const tok = r.body.p_token || '';
  t('登录签发 p_token', r.status === 200 && /^p1\./.test(tok) && tok.split('.').length === 4, tok.length + ' 字符');
  t('p_token 不含明文身份', tok.indexOf(LOGIN_USER) < 0, '载荷为双层密文');
  t('未带 p_token → 401', authorize('', 'GET', '/api/profile').status === 401, '拒绝匿名访问');
  t('携带 p_token → 200', authorize(tok, 'GET', '/api/profile').status === 200, 'Bearer 鉴权');
  t('受保护数据接口 → 200', authorize(tok, 'GET', '/api/vault/data').status === 200, 'data:read');
  t('scope 不足 → 403', authorize(tok, 'POST', '/api/vault/transfer').status === 403, '缺 data:write');
  const seg = tok.split('.');
  const badSig = (seg[3][0] === 'A' ? 'B' : 'A') + seg[3].slice(1);
  t('篡改签名 → 401', authorize('p1.' + seg[1] + '.' + seg[2] + '.' + badSig, 'GET', '/api/profile').status === 401, 'HMAC 失效');
  const h2 = b64u(JSON.stringify({ alg: 'OBF12-HMAC-SHA256', typ: 'p_token', v: 1, cid: c.chainId, ld: 'deadbeef' }));
  const sig2 = b64u(crypto.createHmac('sha256', c.macKey).update(h2 + '.' + seg[2]).digest());
  t('换全层指纹 → 401', authorize('p1.' + h2 + '.' + seg[2] + '.' + sig2, 'GET', '/api/profile').status === 401, '签名有效但 ld 不匹配');
  t('logout 撤销 → 重放 401',
    authorize(tok, 'POST', '/api/logout').status === 200 && authorize(tok, 'GET', '/api/profile').status === 401, 'jti 黑名单');
  const bad = selfDefend(verify, '00000000');
  let threw = false;
  try { bad(tok); } catch (e) { threw = /integrity/.test(e.message); }
  t('源码完整性自防御', threw, '改 verify 源码即拒绝执行');
  const before = API.verify;
  API.verify = () => ({ ok: true });
  t('Proxy 防替换校验器', API.verify === before, '外部无法覆盖 verify');
  let limited = false;
  for (let i = 0; i < 10; i++) limited = rateLimited('selftest-ip');
  t('登录限流', limited === true, '8 次/分钟/IP');

  checks.forEach(c2 => console.log((c2.ok ? 'PASS' : 'FAIL') + '  ' + c2.name + (c2.detail ? '  →  ' + c2.detail : '')));
  const fail = checks.filter(c2 => !c2.ok).length;
  console.log('\n' + checks.length + ' 项，' + (checks.length - fail) + ' PASS / ' + fail + ' FAIL');
  process.exitCode = fail ? 1 : 0;
}

/* ---------- 启动 ---------- */
if (process.argv.includes('--self-test')) {
  selfTest();
} else {
  server.listen(PORT, '127.0.0.1', () => {
    console.log('Node HTTP 网关: http://127.0.0.1:' + PORT);
    console.log('主密钥: ' + (MASTER_ENV ? 'P_TOKEN_MASTER (env)' : '每次启动随机，重启后旧 token 失效'));
    console.log('演示账号: ' + DEMO_USER + ' / ' + DEMO_PASS);
    console.log('技术层: ' + LAYERS.length + '，全层指纹 ' + fnv(layerDigest()));
    console.log('自检: node server.js --self-test');
  });
}

module.exports = { login, authorize, issue, verify: guardedVerify, layerDigest };
