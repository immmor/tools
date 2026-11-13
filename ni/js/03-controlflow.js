/* 03-controlflow.js — 控制流层：平坦化调度器、不透明谓词、异常跳转、生成器状态机、死代码 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  /* 对任意整数恒成立 / 恒不成立，静态分析极难证明 */
  function opaqueTrue(n) { return (n * n + n + 1) % 2 === 1; }
  function opaqueFalse(n) { return (n * n + n) % 2 === 1; }

  function fnvRef(s) {
    var h = 0x811c9dc5;
    for (var i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0;
    return h >>> 0;
  }

  /* switch 分发器：pc 异或混淆 + 乱序 case + 不可达死块 */
  function flattened(text) {
    var acc = 0, i = 0, out = 0, pc = 0x2a;
    for (var guard = 0; guard < 100000; guard++) {
      switch (pc ^ 0x2a) {
        case 0:
          if (opaqueFalse(guard)) { return -1; }
          acc = 0x811c9dc5;
          i = 0;
          pc = text.length ? 0x2b : 0x2d;
          break;
        case 1:
          acc = Math.imul(acc ^ text.charCodeAt(i), 0x01000193) >>> 0;
          i++;
          pc = 0x2c;
          break;
        case 2:
          if (opaqueTrue(i)) { pc = i < text.length ? 0x2b : 0x2d; }
          else { out = 0xdeadbeef; pc = 0x2f; }
          break;
        case 3:
          out = acc;
          pc = 0x2f;
          break;
        case 4:
          out = 0xbaadf00d;
          pc = 0x2f;
          break;
        default:
          return out >>> 0;
      }
    }
    return 0;
  }

  /* throw/catch 充当 goto，没有常规的 if/for 跳转形态 */
  function throwGoto(n) {
    var acc = 0, step = 'a', spins = 0;
    try {
      while (spins++ < 32) {
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
    } catch (fatal) { return -1; }
    return -1;
  }

  function* stateMachine(s) {
    var acc = 0;
    for (var i = 0; i < s.length; i++) {
      acc = (acc + s.charCodeAt(i) * (i + 1)) >>> 0;
      yield acc;
    }
    return acc;
  }

  OBF.register({
    id: 'controlflow',
    title: '03 · 控制流混淆',
    tags: ['控制流平坦化', 'switch 分发器', 'PC 异或编码', '不透明谓词', '死代码注入', 'throw/catch goto', '生成器状态机', '短路链'],
    run: function () {
      var n, sample = 'flattened-control-flow';

      var allT = true, allF = true;
      for (n = 0; n < 500; n++) {
        if (!opaqueTrue(n)) allT = false;
        if (opaqueFalse(n)) allF = false;
      }
      OBF.check('不透明谓词 500 次采样', allT && allF, '(n²+n+1)%2===1 恒真 / (n²+n)%2===1 恒假');

      OBF.check('控制流平坦化等价性', flattened(sample) === fnvRef(sample),
        'FNV-1a = ' + fnvRef(sample).toString(16));
      OBF.check('平坦化对空串仍等价', flattened('') === fnvRef(''), 'init 块直接跳到 finish');

      var ref = 33 + 0x1f;
      OBF.check('throw/catch 异常跳转', throwGoto(0x1f) === ref,
        '5 个基本块全部靠 throw {to} 串联');

      var gen = stateMachine(sample), last = 0, direct = 0, i = 0;
      for (var step = gen.next(); !step.done; step = gen.next()) {
        last = step.value;
        direct = (direct + sample.charCodeAt(i) * (i + 1)) >>> 0;
        i++;
      }
      OBF.check('生成器状态机', last === direct && step.value === direct, i + ' 个 yield 状态');

      var count = 0;
      for (var k = 0; (opaqueFalse(k) ? true : k < 1); k++) count++;
      OBF.check('虚假循环边界', count === 1, '谓词永远为假，实际只跑一次');

      var deadSrc = [
        'return function(x){',
        '  var junk1 = function(){ return 0xdead; };',
        '  var junk2 = (function(){ var q=0; for(var i=0;i<4;i++) q+=i; return q; })();',
        '  if (((x*x+x)%2) === 1) { return 0xbaad; }',
        '  if (x === void 0) { return 0xf00d; }',
        '  return (x ^ 0x5a) + 1;',
        '}'
      ].join('\n');
      var deadFn = U.jsEval(deadSrc);
      OBF.check('死代码 + 不可达分支',
        deadFn(7) === ((7 ^ 0x5a) + 1) && deadFn.toString().indexOf('0xdead') > 0,
        '注入 2 个未调用函数 + 2 个永假分支');

      var chain = U.jsVal('((!![] && 1) || 2) + ((+[] && 3) || 4)');
      OBF.check('短路与逗号链', chain === 5, 'true&&1 / 0&&3||4');

      OBF.controlflow = {
        flatten: flattened, fnvRef: fnvRef, throwGoto: throwGoto,
        opaqueTrue: opaqueTrue, opaqueFalse: opaqueFalse
      };
      return 'switch 分发器 5 块 + 异常跳转 5 块 + 生成器状态机';
    }
  });
})(window);
