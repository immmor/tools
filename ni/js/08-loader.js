/* 08-loader.js — 加载器层：eval / Function / setTimeout 字符串 / Blob / data: import / Worker / 自修改 / 多态 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  function morph(x){ return x + 1; }

  var polyCounter = 0;

  /* 每次生成的包装函数标识符、谓词都不同，但语义相同 */
  function polymorphic(seed) {
    polyCounter++;
    var r = U.rand((seed ^ (polyCounter * 0x9e3779b9)) >>> 0);
    var a = '_' + ((r() * 1e6) | 0).toString(36) + '_' + polyCounter;
    var b = '_' + ((r() * 1e6) | 0).toString(36) + '_' + polyCounter;
    var src = 'return function(' + a + '){' +
      'var ' + b + '=' + a + ';' +
      'if((' + b + '*' + b + '+' + b + ')%2===1) return -1;' +
      'return ' + b + ' ^ 0x2a;' +
      '};';
    var fn = U.jsEval(src);
    fn.source = src;
    return fn;
  }

  async function attempt(name, fn) {
    try {
      var r = await fn();
      OBF.check(name, r.ok, r.detail);
    } catch (e) {
      OBF.skip(name, (e && e.message) || String(e));
    }
  }

  OBF.register({
    id: 'loader',
    title: '08 · 动态加载与多态',
    tags: ['间接 eval', 'Function 链', 'setTimeout 字符串', 'Blob URL', 'data: 动态 import', 'Blob 动态 import', 'Web Worker', 'with 作用域劫持', 'sourceURL 伪造', '自修改代码', '多态壳', '一次性 getter', 'Proxy 陷阱', 'Symbol.toPrimitive', 'AsyncFunction'],
    run: async function () {
      OBF.check('间接 eval（全局作用域）', U.jsVal('(0, eval)("1+1")') === 2, '(0,eval) 绕过局部作用域');

      OBF.check('Function 构造函数链', U.jsVal('Function.constructor.constructor("return 0x2f")()') === 0x2f,
        'Function → constructor → constructor');

      await attempt('setTimeout 字符串代码', function () {
        return new Promise(function (resolve) {
          root.setTimeout('window.__OBF_TIMER__ = 0x3f;', 0);
          root.setTimeout(function () {
            var v = root.__OBF_TIMER__;
            delete root.__OBF_TIMER__;
            resolve({ ok: v === 0x3f, detail: '把代码藏进字符串参数' });
          }, 30);
        });
      });

      await attempt('Blob URL 脚本注入', function () {
        var src = 'window.__OBF_BLOB__ = 0x4a;';
        var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        var el = document.createElement('script');
        el.src = url;
        var p = new Promise(function (resolve, reject) {
          el.onload = resolve;
          el.onerror = function () { reject(new Error('blob script 被拦截')); };
        });
        document.head.appendChild(el);
        return p.then(function () {
          var v = root.__OBF_BLOB__;
          el.parentNode.removeChild(el);
          URL.revokeObjectURL(url);
          delete root.__OBF_BLOB__;
          return { ok: v === 0x4a, detail: '脚本标签动态注入后立即撤销 URL' };
        });
      });

      await attempt('data: URL 动态 import', function () {
        return import('data:text/javascript,' + encodeURIComponent('export default 0x5a;'))
          .then(function (m) { return { ok: m.default === 0x5a, detail: '无网络请求，模块内联在 URL 里' }; });
      });

      await attempt('Blob URL 动态 import', function () {
        var url = URL.createObjectURL(new Blob(['export const v = 0x3c;'], { type: 'text/javascript' }));
        return import(url).then(function (m) {
          URL.revokeObjectURL(url);
          return { ok: m.v === 0x3c, detail: '运行时生成的 ES module' };
        }, function (e) {
          URL.revokeObjectURL(url);
          throw e;
        });
      });

      await attempt('Web Worker 内执行隐藏逻辑', function () {
        var src = 'self.onmessage=function(e){postMessage(e.data ^ 0x5a);};';
        var url = URL.createObjectURL(new Blob([src], { type: 'text/javascript' }));
        var w = new Worker(url);
        return new Promise(function (resolve, reject) {
          w.onmessage = function (e) { resolve(e.data); };
          w.onerror = function (e) { reject(new Error(e.message || 'worker 创建失败')); };
          w.postMessage(0x2f);
        }).then(function (v) {
          w.terminate();
          URL.revokeObjectURL(url);
          return { ok: v === (0x2f ^ 0x5a), detail: '逻辑移到独立线程，主线程看不到源码' };
        }, function (e) {
          w.terminate();
          URL.revokeObjectURL(url);
          throw e;
        });
      });

      var withFn = new Function('o', 'with(o){return secret;}');
      OBF.check('with 作用域劫持', withFn({ secret: 0x7f }) === 0x7f, '标识符不在函数体内定义');

      var forged = new Function('return 1; //# sourceURL=vendor/angular.core.mjs');
      OBF.check('sourceURL 堆栈伪造', forged.toString().indexOf('angular.core.mjs') >= 0,
        '断点面板显示成第三方库');

      var modified = morph.toString().replace(/\bx\s*\+\s*1\b/, 'x * 7 + 3');
      var morphed = U.jsEval('return ' + modified + ';');
      OBF.check('自修改代码（改写自身源码）', morph(2) === 3 && morphed(2) === 17,
        'Function.prototype.toString → 替换 → 重新编译');

      var p1 = polymorphic(1), p2 = polymorphic(1);
      OBF.check('多态壳（每次源码都不同）',
        p1.source !== p2.source && p1(0x0f) === (0x0f ^ 0x2a) && p2(0x0f) === (0x0f ^ 0x2a),
        '随机标识符 + 恒假谓词，语义保持不变');

      Object.defineProperty(root, '__OBF_ONCE__', {
        configurable: true,
        get: function () { delete root.__OBF_ONCE__; return 0x9f; }
      });
      var once1 = root.__OBF_ONCE__, once2 = root.__OBF_ONCE__;
      OBF.check('一次性 getter 自毁', once1 === 0x9f && once2 === undefined, '第二次读取即失效');

      var proxied = new Proxy(function () { return 0x2a; }, {
        apply: function (t, self, args) { return t() + args[0]; },
        get: function (t, k) { return k === 'name' ? 'native' : Reflect.get(t, k); }
      });
      OBF.check('Proxy apply/get 陷阱', proxied(5) === 47 && proxied.name === 'native',
        '拦截调用与属性读取');

      var token = {};
      token[Symbol.toPrimitive] = function (hint) { return hint === 'number' ? 0x2a : 'tok'; };
      OBF.check('Symbol.toPrimitive 隐式转换', +token === 0x2a && String(token) === 'tok',
        '关键数值藏在隐式类型转换里');

      await attempt('AsyncFunction 构造器', function () {
        var AF = Object.getPrototypeOf(async function () {}).constructor;
        return AF('return await Promise.resolve(0x2f);')().then(function (v) {
          return { ok: v === 0x2f, detail: '不写 async 关键字也能造异步函数' };
        });
      });

      var stegoKey = OBF.lexical.stegoKey;
      var stegoPayload = U.b64(U.rc4(U.utf8(stegoKey), U.utf8('STEGO-PAYLOAD')));
      var opened = U.fromUtf8(U.rc4(U.utf8(stegoKey), U.unb64(stegoPayload)));
      OBF.check('零宽隐写密钥解锁 RC4 载荷', opened === 'STEGO-PAYLOAD', '密钥只存在于不可见注释中');

      OBF.loader = { polymorphic: polymorphic, stegoPayload: stegoPayload };
      return 'eval / Blob / import / Worker / 自修改 / 多态共 15 种执行通道';
    }
  });
})(window);
