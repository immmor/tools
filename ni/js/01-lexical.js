/* 01-lexical.js — 词法层：Unicode 转义标识符、同形字、字面量变形、计算属性、零宽隐写 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  /* 数字字面量的多种等价写法，全部通过 Function 动态求值 */
  function numericVariants(n) {
    var r = U.rand(n * 31 + 7);
    var a = 0x1000 + ((r() * 0xffff) | 0);
    var b = a ^ n;
    return [
      '((0x' + a.toString(16) + ' ^ 0x' + b.toString(16) + '))',
      '(0x' + n.toString(16) + ' | 0)',
      '(parseInt("' + n.toString(36) + '", 36))',
      '(void 0, (' + n + '))',
      '(!![] ? (' + n + ') : 0)',
      '(+[] + ' + n + ')',
      '([][[]] ? 0 : (' + n + '))',
      '((function(){var q=' + n + ';return q;})())',
      '(Number("0x' + n.toString(16) + '"))',
      '((0,eval)("' + n + '"))'
    ];
  }

  function escapedKey(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      out += '\\u' + ('0000' + s.charCodeAt(i).toString(16)).slice(-4);
    }
    return out;
  }

  OBF.register({
    id: 'lexical',
    title: '01 · 词法混淆',
    tags: ['Unicode 转义标识符', '同形字', '数字变形', '计算属性', '零宽隐写', '逗号/void 表达式', 'radix', 'sourceURL 伪造'],
    run: function () {
      var i, ok;

      /* Unicode 转义写成的标识符：源码里看不到真实变量名 */
      var uni = '\\u0061\\u0062\\u0063';
      var uniSrc = 'var ' + uni + '=0x41;return ' + uni + ';';
      var v1 = U.jsEval(uniSrc);
      OBF.check('Unicode 转义标识符', v1 === 0x41, '\\u0061\\u0062\\u0063 = 0x41');

      /* 西里尔同形字：视觉上与拉丁字母一致，实际是不同码点 */
      var homo = '\u0430\u0435\u043e\u0440\u0441';
      var v2 = U.jsEval('var _' + homo + '=0x2a;return _' + homo + ';');
      OBF.check('同形字标识符', v2 === 0x2a, 'Cyrillic а/е/о/р/с 伪装为 a/e/o/p/c');

      /* 全部数字变体必须求值为同一个值 */
      var variants = numericVariants(0x2f3c);
      var allOk = true, bad = '';
      for (i = 0; i < variants.length; i++) {
        try { ok = U.jsVal(variants[i]) === 0x2f3c; }
        catch (e) { ok = false; }
        if (!ok) { allOk = false; bad = variants[i]; break; }
      }
      OBF.check('数字字面量 ' + variants.length + ' 种等价变形', allOk, allOk ? '异或 / 36 进制 / 逗号 / eval 间接调用' : '失败: ' + bad);

      /* 属性名完全由 \uXXXX 拼接，静态 grep 找不到 key */
      var key = escapedKey('secret');
      var v3 = U.jsEval('var o={};o["' + key + '"]=0x5a;return o["' + key + '"];');
      OBF.check('计算属性名 + \\uXXXX', v3 === 0x5a, 'o["\\u0073\\u0065…"]');

      /* \xXX 十六进制字符串 + String.raw 标签 + 数组 join 反 grep */
      var plain = 'LEXICAL';
      var codes = [];
      for (i = 0; i < plain.length; i++) codes.push(plain.charCodeAt(i));
      var xSrc = "'" + codes.map(function (c) { return '\\x' + ('0' + c.toString(16)).slice(-2); }).join('') + "'";
      var v4 = U.jsEval('return ' + xSrc + ';');
      var v5 = ['\u004f', '\u0042', '\u0046'].join('') + U.jsEval('return String.raw`USCATE`;');
      OBF.check('\\xXX 转义串', v4 === plain, xSrc);
      OBF.check('String.raw 标签 + 碎片拼接', v5 === 'OBFUSCATE', '规避字符串字面量检索');

      /* 零宽字符藏进函数注释，再从 Function.prototype.toString 里读回来 */
      var hidden = U.stegoHide('STEGO-9F3C');
      var carrier = U.jsEval('return function carrier(){/*' + hidden + '*/\nreturn 0x2a;};');
      var revealed = U.stegoReveal(carrier.toString());
      OBF.check('零宽字符隐写（藏在注释里）', revealed === 'STEGO-9F3C', '载荷 ' + hidden.length + ' 个不可见码元');
      OBF.lexical = { stegoKey: revealed, carrier: carrier, xSrc: xSrc, variants: variants };

      /* 逗号运算符 / void / 短路链 / 垃圾注释 / fake sourceURL */
      var seq = U.jsVal('(void 0, (0, function(){return 2;})()) + (+!![]) + (true && 5 || 9) - 3');
      OBF.check('逗号 + void + 短路链', seq === 5, '2 + 1 + 5 - 3 = 5');

      var junk = '/*@__PURE__*/ /*\u200b*/ ;\n//# sourceMappingURL=/dev/null\n//# sourceURL=vendor/react.min.js\n';
      var v6 = U.jsEval(junk + 'return (function(){ /* bogus */ return 0x1f; })();');
      OBF.check('垃圾注释 + sourceURL 伪造', v6 === 0x1f, '堆栈与 SourceMap 指向假文件');

      /* radix / encodeURIComponent / escape 三类字符串变形 */
      var radix = U.jsVal('parseInt("' + (0xbeef).toString(36) + '",36)') === 0xbeef;
      var uri = decodeURIComponent(encodeURIComponent('radix/\u221a')) === 'radix/\u221a';
      OBF.check('radix / URI 编码变形', radix && uri, '36 进制 + percent-encode');

      return '标识符、字面量、隐写、注释伪装共 ' + variants.length + ' 类变换';
    }
  });
})(window);
