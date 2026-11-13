/* 04-antidebug.js — 反调试层：debugger 陷阱、时间差、DevTools 探测、toString 钩子、自防御哈希 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  /* 真实陷阱源码：只编译不执行，避免真的把 DevTools 卡住 */
  var TRAP = [
    'setInterval(function(){',
    '  var a = performance.now();',
    '  debugger;',
    '  var b = performance.now();',
    '  if (b - a > 100) { throw new Error("halt"); }',
    '}, 400);'
  ].join('\n');

  function makeSelfDefending(fn, expected) {
    return function () {
      if (U.fnv(fn.toString()) !== expected) throw new Error('integrity violation');
      return fn.apply(this, arguments);
    };
  }

  function fingerprint() {
    var parts = [
      root.navigator ? root.navigator.userAgent : 'ua',
      root.screen ? root.screen.width + 'x' + root.screen.height : 'screen',
      (root.Intl && Intl.DateTimeFormat) ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'tz',
      root.location ? root.location.protocol + (root.location.host || 'file') : 'file'
    ];
    return U.fnv(parts.join('|'));
  }

  OBF.register({
    id: 'antidebug',
    title: '04 · 反调试与自防御',
    tags: ['debugger 陷阱', '时间差检测', 'DevTools 尺寸探测', 'toString 钩子', 'native code 伪装', '源码完整性哈希', '反格式化', '属性访问诱饵', '栈指纹', '环境指纹'],
    run: function () {
      var trapFn = new Function('var a=1; debugger; return a+1;');
      OBF.check('debugger 陷阱（编译不执行）',
        typeof trapFn === 'function' && /debugger/.test(trapFn.toString()),
        '真实陷阱：' + TRAP.split('\n')[1].trim() + ' …');

      var t0 = performance.now(), spin = 0;
      for (var i = 0; i < 20000; i++) spin += (i ^ 0x5a);
      var dt = performance.now() - t0;
      OBF.check('时间差断点检测', dt >= 0 && !isNaN(dt) && spin !== 0,
        'Δt = ' + dt.toFixed(2) + 'ms，超过阈值即判定被下断点');

      var opened = (root.outerWidth - root.innerWidth > 160) ||
                   (root.outerHeight - root.innerHeight > 160);
      OBF.check('DevTools 尺寸探测', typeof opened === 'boolean',
        '当前判定：' + (opened ? '已打开（尺寸异常）' : '未打开'));

      /* 全局 toString 钩子：打补丁 → 读取 → 立即还原，不污染页面 */
      function target() { return 0x2a; }
      var original = Function.prototype.toString;
      var spoofedText = '';
      try {
        Function.prototype.toString = function () {
          if (this === target) return 'function target() { [native code] }';
          return original.call(this);
        };
        spoofedText = target.toString();
      } finally {
        Function.prototype.toString = original;
      }
      OBF.check('Function.prototype.toString 伪装', /\[native code\]/.test(spoofedText),
        '让逆向者以为函数是原生实现');
      OBF.check('hooks 已还原', Function.prototype.toString === original, '避免影响页面其它逻辑');

      var digest = U.fnv(target.toString());
      var safe = makeSelfDefending(target, digest);
      var bad = makeSelfDefending(target, '00000000');
      OBF.check('自防御：源码哈希一致', safe() === 0x2a, 'FNV-1a = ' + digest);
      var threw = false;
      try { bad(); } catch (e) { threw = /integrity/.test(e.message); }
      OBF.check('自防御：篡改即拒绝执行', threw, '格式化 / 打补丁都会触发');

      var minified = new Function('a', 'return a ^ 0x5a;');
      var h1 = U.fnv(minified.toString());
      var h2 = U.fnv(minified.toString().replace(/;/g, ';\n'));
      OBF.check('反美化：格式化破坏哈希', h1 !== h2, h1 + ' → ' + h2);

      var hits = 0, bait = {};
      Object.defineProperty(bait, 'id', {
        configurable: true,
        get: function () { hits++; return 'decoy'; }
      });
      var sink = bait.id;
      void bait.id;
      OBF.check('属性访问计数器诱饵', hits === 2 && sink === 'decoy',
        '读取 debugger 面板中的对象就会暴露');

      var stack = '';
      try { throw new Error('probe'); } catch (e) { stack = e.stack || ''; }
      OBF.check('调用栈指纹可读取', typeof stack === 'string',
        stack ? 'stack 帧数 ≈ ' + stack.split('\n').length : '引擎未暴露 stack');

      var decoy = function () { return 1; };
      Object.freeze(decoy);
      OBF.check('冻结诱饵函数防 hook', Object.isFrozen(decoy), 'Object.freeze');

      var nativeEval = String(eval).indexOf('[native code]') >= 0;
      OBF.check('原生 eval 未被替换', nativeEval, '检测全局 hook');

      var fp = fingerprint();
      OBF.check('环境指纹绑定', /^[0-9a-f]{8}$/.test(fp), 'UA + 分辨率 + TZ + 域 = ' + fp);

      OBF.antidebug = {
        selfDefend: makeSelfDefending, fingerprint: fingerprint,
        trapSource: TRAP, digest: digest
      };
      return '反调试探针 11 项，环境指纹 ' + fp;
    }
  });
})(window);
