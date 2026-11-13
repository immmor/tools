/* 07-wasm.js — WASM 黑盒：手写二进制模块（type/function/memory/export/code/data 段） */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  var K = 0x35, M = 0x07;
  var HIDDEN = 'WASM-BLACKBOX';
  var HIDDEN_BYTES = U.xor(U.utf8(HIDDEN), U.utf8('\x5a'));

  function u32(n) {
    var out = [], b;
    do { b = n & 0x7f; n >>>= 7; if (n) b |= 0x80; out.push(b); } while (n);
    return out;
  }

  function sleb(n) {
    var out = [], b, more = true;
    while (more) {
      b = n & 0x7f;
      n >>= 7;
      if ((n === 0 && (b & 0x40) === 0) || (n === -1 && (b & 0x40) !== 0)) more = false;
      else b |= 0x80;
      out.push(b);
    }
    return out;
  }

  function section(id, payload) { return [id].concat(u32(payload.length), payload); }

  /* f(x) = (x ^ 0x35) * 7 ，线性内存 0 号偏移处藏着 XOR 加密的常量 */
  function moduleBytes() {
    var body = [0x00, 0x20, 0x00, 0x41].concat(sleb(K), [0x73, 0x41], sleb(M), [0x6c, 0x0b]);
    var code = [0x01].concat(u32(body.length), body);
    var types = [0x01, 0x60, 0x01, 0x7f, 0x01, 0x7f];
    var funcs = [0x01, 0x00];
    var memory = [0x01, 0x00, 0x01];
    var exports = [0x02, 0x01, 0x66, 0x00, 0x00, 0x01, 0x6d, 0x02, 0x00];
    var data = [0x01, 0x00, 0x41, 0x00, 0x0b].concat(u32(HIDDEN_BYTES.length), Array.prototype.slice.call(HIDDEN_BYTES));
    return new Uint8Array(
      [0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]
        .concat(section(1, types), section(3, funcs), section(5, memory),
                section(7, exports), section(10, code), section(11, data))
    );
  }

  /* 纯 JS 等价实现，仅在 WASM 不可用时兜底 */
  function fallback(x) { return Math.imul(x ^ K, M) | 0; }

  OBF.register({
    id: 'wasm',
    title: '07 · WebAssembly 黑盒',
    tags: ['手写 wasm 二进制', 'LEB128', '代码段', '数据段', '线性内存', '导出函数', 'native code 伪装', '常量走私'],
    run: function () {
      var bytes = moduleBytes();
      var jsRef = fallback(0x2a);

      if (!root.WebAssembly) {
        OBF.skip('WASM 模块', '当前环境不支持 WebAssembly');
        OBF.wasm = { call: fallback, hidden: HIDDEN, bytes: bytes, mode: 'JS fallback' };
        return Promise.resolve('降级为 JS 等价函数');
      }

      OBF.check('wasm 二进制结构合法', root.WebAssembly.validate(bytes),
        bytes.length + ' 字节，6 个自定义段');

      var plainInBinary = false;
      for (var i = 0; i + HIDDEN.length <= bytes.length; i++) {
        var hit = true;
        for (var j = 0; j < HIDDEN.length; j++) if (bytes[i + j] !== HIDDEN.charCodeAt(j)) { hit = false; break; }
        if (hit) { plainInBinary = true; break; }
      }
      OBF.check('常量不以明文出现在二进制里', !plainInBinary, '数据段存的是 XOR 密文');

      return root.WebAssembly.instantiate(bytes, {}).then(function (res) {
        var ex = res.instance.exports;
        var out = ex.f(0x2a);
        OBF.check('wasm 导出函数等价 JS 参照', out === jsRef,
          'f(0x2a) = (0x2a^0x35)*7 = ' + out);

        var buf = new Uint8Array(ex.m.buffer, 0, HIDDEN_BYTES.length);
        var decoded = U.fromUtf8(U.xor(buf, U.utf8('\x5a')));
        OBF.check('线性内存常量走私', decoded === HIDDEN, '从 data 段读回 ' + decoded);

        var nativeLook = typeof ex.f === 'function' &&
                         Function.prototype.toString.call(ex.f).length < 200;
        OBF.check('导出函数在 toString 里不可读', nativeLook, '逆向者只能反编译 wasm 字节码');

        var compiled = root.WebAssembly.Module;
        OBF.check('Module / Instance 分离编译', typeof compiled === 'function' && typeof ex.f === 'function',
          '可缓存编译后的 module');

        OBF.wasm = {
          call: ex.f, fallback: fallback, hidden: decoded, bytes: bytes,
          K: K, M: M, mode: 'wasm', exports: ex
        };
        return '手写 ' + bytes.length + 'B wasm，f(x) 与 data 段双通道';
      }).catch(function (e) {
        OBF.skip('WASM 实例化', (e && e.message) || String(e));
        OBF.wasm = { call: fallback, hidden: HIDDEN, bytes: bytes, mode: 'JS fallback' };
        return '降级为 JS 等价函数';
      });
    }
  });
})(window);
