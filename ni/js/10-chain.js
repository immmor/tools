/* 10-chain.js — 全链路：所有层密钥互相派生，跳过任意一层都无法解出，附自防御 / 时间锁 / 诱饵 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  /* 明文也拆成碎片，避免直接 grep */
  var SECRET = ['\x4e\x49', '::', '\x32\x30\x32\x36', '::', 'ANTI', '-', 'REVERSE', '::', 'UNLOCKED'].join('');

  function today() { return new Date().toISOString().slice(0, 10); }

  /* 密钥链：隐写 → 环境指纹 → wasm → VM → 极简字符集 → PBKDF2 → 多态壳
     每一环都消费上一环的输出，单独拿到密文没有任何意义 */
  async function context(day) {
    /* 全部 13 个模块的确定性输出压成指纹，任何一层被改动都会换掉整条密钥链 */
    var layerDigest = await OBF.binding.digest();
    var stegoKey = U.stegoReveal(OBF.lexical.carrier.toString());
    var fp = OBF.antidebug.fingerprint();
    var fpNum = parseInt(fp, 16) >>> 0;
    var wasmSeed = OBF.wasm.call(fpNum & 0xff) | 0;
    var vmKey = wasmSeed & 0xff;
    var vmSeed = (fpNum ^ wasmSeed) >>> 0;
    var vmToken = OBF.vm.run(OBF.vm.build(vmKey, vmSeed));
    var esoBlob = OBF.esoteric.jsfuck('esoteric 2026');
    var esoToken = OBF.esoteric.decode(esoBlob);
    var d = day || today();
    var baseToken = [stegoKey, vmToken, esoToken, OBF.wasm.hidden, fp, d, U.fnv(layerDigest)].join('|');
    var k1 = U.fnv(baseToken);
    var derived = await OBF.crypto.derive(baseToken, fp + '|' + d);
    var mask = OBF.loader.polymorphic(vmSeed)(vmKey) & 0xff;
    var raw = U.utf8(k1), mix = new Uint8Array(raw.length), i;
    for (i = 0; i < raw.length; i++) mix[i] = raw[i] ^ mask;
    return {
      stegoKey: stegoKey, fp: fp, wasmSeed: wasmSeed,
      vmKey: vmKey, vmSeed: vmSeed, vmToken: vmToken, esoToken: esoToken,
      day: d, baseToken: baseToken, layerDigest: layerDigest,
      k1: k1, derived: derived, mask: mask, mix: mix
    };
  }

  /* 打包：RC4 → XOR(mix) → AES-GCM → Base64，另附三份诱饵密文 */
  async function pack(secret) {
    var ctx = await context();
    var p1 = U.rc4(ctx.derived, U.utf8(secret));
    var p2 = U.xor(p1, ctx.mix);
    var sealed = await OBF.crypto.codec.seal(ctx.derived, p2);
    var decoys = [], i;
    for (i = 0; i < 3; i++) {
      var fakeKey = await OBF.crypto.derive('decoy-' + i, ctx.fp);
      var fake = await OBF.crypto.codec.seal(fakeKey, U.utf8('NI::2026::DECOY-' + i));
      decoys.push(U.b64(fake));
    }
    return {
      id: U.fnv(ctx.baseToken).slice(0, 8),
      day: ctx.day,
      payload: U.b64(sealed),
      check: await OBF.crypto.digest(secret),
      decoys: decoys,
      meta: { layers: 12, wasmSeed: ctx.wasmSeed, vmKey: ctx.vmKey, fp: ctx.fp.slice(0, 4) + '…' }
    };
  }

  /* 解包：时间锁 → 逐层重算密钥 → 链指纹 → 认证解密 → 摘要校验 */
  async function unlock(bundle) {
    if (bundle.day !== today()) throw new Error('time-lock: 密钥已过期');
    var ctx = await context(bundle.day);
    if (U.fnv(ctx.baseToken).slice(0, 8) !== bundle.id) throw new Error('layer-mismatch: 环境或中间层不一致');
    var sealed = U.unb64(bundle.payload);
    var p2;
    try { p2 = await OBF.crypto.codec.unseal(ctx.derived, sealed); }
    catch (e) { throw new Error('auth-failed: 密文被篡改或密钥错误'); }
    var p1 = U.xor(p2, ctx.mix);
    var secret = U.fromUtf8(U.rc4(ctx.derived, p1));
    var digest = await OBF.crypto.digest(secret);
    if (digest !== bundle.check) throw new Error('checksum-mismatch: 摘要不匹配');
    return secret;
  }

  OBF.register({
    id: 'chain',
    title: '10 · 全链路解锁（抗逆向）',
    tags: ['密钥逐层派生', '隐写密钥', 'wasm 黑盒种子', 'VM opcode 多态', '极简字符集', 'PBKDF2', 'RC4+XOR+AES-GCM', '时间锁', '环境绑定', '完整性摘要', '自防御包装', '诱饵密文', '反补丁'],
    run: async function () {
      var bundle = await pack(SECRET);
      var guarded = OBF.antidebug.selfDefend(unlock, U.fnv(unlock.toString()));
      var opened = await guarded(bundle);

      OBF.check('12 层密钥链完整解锁', opened === SECRET,
        '隐写→指纹→wasm→VM→JSFuck→PBKDF2→多态→RC4→XOR→AES-GCM→摘要');
      OBF.check('密文与诱饵均不含明文',
        bundle.payload.indexOf(SECRET) < 0 && bundle.decoys.every(function (d) { return d.indexOf(SECRET) < 0; }),
        bundle.decoys.length + ' 份诱饵密文');

      var flipped = U.b64(U.unb64(bundle.payload).map(function (b) { return b ^ 1; }));
      var t1 = false;
      try { await guarded(Object.assign({}, bundle, { payload: flipped })); }
      catch (e) { t1 = /auth-failed|checksum|layer-mismatch/.test(e.message); }
      OBF.check('篡改密文 → 认证拒绝', t1, 'AES-GCM tag 或摘要校验失败');

      var t2 = false;
      try { await guarded(Object.assign({}, bundle, { day: '1970-01-01' })); }
      catch (e) { t2 = /time-lock/.test(e.message); }
      OBF.check('时间锁（换日即失效）', t2, '盐绑定 UTC 日期');

      var t3 = false;
      try { await guarded(Object.assign({}, bundle, { id: 'deadbeef' })); }
      catch (e) { t3 = /layer-mismatch/.test(e.message); }
      OBF.check('环境 / 中间层指纹绑定', t3, '换机器或跳过一层即拒绝');

      var ctx = await context();
      var weakKey = await OBF.crypto.derive('skipped-layers', ctx.fp);
      var weak = '<auth-failed>';
      try {
        var w = await OBF.crypto.codec.unseal(weakKey, U.unb64(bundle.payload));
        weak = U.fromUtf8(U.rc4(weakKey, U.xor(w, ctx.mix)));
      } catch (e) { /* 保持 auth-failed */ }
      OBF.check('跳过隐写 / VM / 极简层必然失败', weak !== SECRET,
        '只拿到密文 + 口令无法绕过自举链');

      var patched = OBF.antidebug.selfDefend(unlock, '00000000');
      var t4 = false;
      try { await patched(bundle); }
      catch (e) { t4 = /integrity/.test(e.message); }
      OBF.check('给 unlock 打补丁 → 自防御拒绝', t4, '源码 FNV 与预期不符');

      OBF.chain = {
        pack: pack, unlock: unlock, guarded: guarded, context: context,
        bundle: bundle, unlocked: opened, secret: SECRET,
        pipeline: ['零宽隐写', '环境指纹', 'wasm 黑盒', 'VM 虚拟化', '极简字符集',
                   'PBKDF2', '多态壳', 'RC4', 'XOR mix', 'AES-GCM', '摘要校验', '自防御']
      };
      return '解锁结果：' + opened;
    }
  });
})(window);
