/* 02-strings.js — 字符串层：字符串数组轮转 IIFE、XOR、RC4、Base64、分包解码器 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  var KEY = U.utf8('\x5a\x31\x7b\x0e');

  /* 经典 obfuscator.io 结构：加密串表 + 轮转 IIFE + 索引偏移解码器 */
  var TABLE = (function () {
    var plain = [
      'OBFUSCATE', 'string-array', 'rotation', 'decoder',
      'XOR+RC4+BASE64', 'payload', 'SENTINEL', 'bootstrap'
    ];
    var shift = 0x9;
    var arr = plain.map(function (s) { return U.b64(U.xor(U.utf8(s), KEY)); });
    (function (a, n) { while (n--) a.push(a.shift()); })(arr, shift);
    return {
      raw: arr,
      shift: shift,
      get: function (i) {
        var n = arr.length;
        var p = ((i - (shift % n)) % n + n) % n;
        return U.fromUtf8(U.xor(U.unb64(arr[p]), KEY));
      }
    };
  }());

  /* 解码器本身也拆成碎片，靠 Array.prototype 反射拼回来 */
  var DECODER = (function () {
    var parts = ['\u0063\u006f\u006e', '\u0073\u0074\u0072', '\u0075\u0063\u0074\u006f\u0072'].join('');
    var from = ['\u0066\u0072\u006f\u006d', '\u0043\u0068\u0061\u0072', '\u0043\u006f\u0064\u0065'].join('');
    return ([] + [])[parts][from];
  }());

  function encodeChars(s) {
    var codes = [];
    for (var i = 0; i < s.length; i++) codes.push(s.charCodeAt(i));
    return codes;
  }

  OBF.register({
    id: 'strings',
    title: '02 · 字符串加密',
    tags: ['字符串数组轮转 IIFE', '解码器反射', 'XOR 多字节密钥', 'RC4', 'Base64', 'HEX', 'charCode', '反 grep 拼接', '哨兵驱动'],
    run: function () {
      var s = 'STRINGS-LAYER-\u221a-2026';
      var bytes = U.utf8(s), i;

      OBF.check('字符串数组 + 轮转 IIFE', TABLE.get(0) === 'OBFUSCATE' && TABLE.get(7) === 'bootstrap',
        TABLE.raw.length + ' 条密文，左旋 ' + TABLE.shift + ' 位后按偏移取');

      /* 哨兵驱动：不停旋转直到解出标记，模拟 obfuscator 的自校准解码器 */
      var rotated = TABLE.raw.slice();
      var guard = rotated.length + 1, found = false;
      while (guard--) {
        var head = U.fromUtf8(U.xor(U.unb64(rotated[0]), KEY));
        if (head === 'SENTINEL') { found = true; break; }
        rotated.push(rotated.shift());
      }
      OBF.check('哨兵驱动的自校准旋转', found, '旋转到 SENTINEL 出现才停止');

      var v1 = U.fromUtf8(U.xor(U.xor(bytes, KEY), KEY));
      OBF.check('XOR 4 字节滚动密钥', v1 === s, 'key = ' + U.hex(KEY));

      var k2 = U.utf8('rc4-ke\u00b7stream');
      var v2 = U.fromUtf8(U.rc4(k2, U.rc4(k2, bytes)));
      OBF.check('RC4 流密码往返', v2 === s, 'KSA + PRGA，密钥 ' + k2.length + ' 字节');

      OBF.check('Base64 / HEX / radix 编码链',
        U.fromUtf8(U.unb64(U.b64(U.unhex(U.hex(bytes))))) === s,
        'bytes → hex → base64 → bytes');

      var chars = DECODER.apply(null, encodeChars(s));
      OBF.check('反射式 charCode 解码器', chars === s,
        '([]+"")["constructor"]["fromCharCode"]，名称由 \\uXXXX 碎片拼接');

      var fragmented = ['\x4f', '\u0042', 'F', '\x55', '\u0053', 'C', '\x41', '\u0054', 'E'].join('');
      OBF.check('碎片拼接反 grep', fragmented === 'OBFUSCATE', '无完整明文常量');

      /* 自解码字符串：整段表达式只有 []()+!{} 之外的碎片，运行时才还原 */
      var selfSrc = 'return [' + encodeChars('SELF-DECODE').map(function (c) {
        return '(0x' + c.toString(16) + ')';
      }).join(',') + '].map(function(c){return String.fromCharCode(c);}).join("");';
      OBF.check('自解码字符串', U.jsEval(selfSrc) === 'SELF-DECODE', '常量表运行时组装');

      var split = s.split('').reverse().join('');
      OBF.check('split/reverse/join 变形', split.split('').reverse().join('') === s, '顺序变换 + 隐式数组转换');

      OBF.strings = { table: TABLE, rc4Key: k2, encodeChars: encodeChars, text: s };
      return '串表 ' + TABLE.raw.length + ' 项，XOR / RC4 / Base64 / charCode 四重编码';
    }
  });
})(window);
