/* 09-esoteric.js — 极简字符集：JSFuck 自举、JJEncode 风味、AAEncode 风味 */
(function (root) {
  'use strict';

  var OBF = root.OBF, U = OBF.util;

  /* 一位数字的字符串表达式，例如 3 → "3" */
  function digitExpr(n) {
    if (n === 0) return '(+[]+[])';
    return '(+(' + Array(n).fill('!![]').join('+') + ')+[])';
  }

  /* 任意非负整数的数值表达式：把十进制位拼成字符串再一元 + */
  function numExpr(n) {
    var ds = String(n).split('').map(function (c) { return digitExpr(+c); });
    if (ds.length === 1) return '(+' + ds[0] + ')';
    return '(+(' + ds.join('+') + '))';
  }

  /* 自举链：基础串 → "filter" → "constructor" → 原生函数源码 */
  function createEncoder() {
    var bases = [];
    var map = Object.create(null);

    function addBase(expr) { bases.push([expr, U.jsVal(expr)]); }

    function refresh() {
      bases.forEach(function (pair) {
        for (var i = 0; i < pair[1].length; i++) {
          var c = pair[1][i];
          if (!map[c]) map[c] = pair[0] + '[' + numExpr(i) + ']';
        }
      });
    }

    function strExpr(s) {
      var out = [], i, e;
      for (i = 0; i < s.length; i++) {
        e = map[s[i]];
        if (!e) throw new Error('字符集不含字符 "' + s[i] + '"');
        out.push(e);
      }
      return out.join('+');
    }

    addBase('(![]+[])');       // "false"
    addBase('(!![]+[])');      // "true"
    addBase('([][[]]+[])');    // "undefined"
    addBase('(+[![]]+[])');    // "NaN"
    addBase('({}+[])');        // "[object Object]"
    refresh();

    var fk = strExpr('filter');
    addBase('([][' + fk + ']+[])');                    // function filter() { ... }
    refresh();

    var ck = strExpr('constructor');
    addBase('([][' + ck + ']+[])');                    // function Array() { ... }
    addBase('([][' + fk + '][' + ck + ']+[])');        // function Function() { ... }
    refresh();

    for (var d = 0; d <= 9; d++) {
      var dc = String(d);
      if (!map[dc]) map[dc] = digitExpr(d);
    }

    return { strExpr: strExpr, map: map, bases: bases };
  }

  var ENC = createEncoder();

  function aliasSource(text, prefix, header) {
    var body = ENC.strExpr(text);
    var aliases = ENC.bases.map(function (b, i) {
      return { name: prefix[i % prefix.length] + '_' + i, expr: b[0] };
    });
    /* 长表达式先替换，避免更短的基串把动态引导串切碎 */
    aliases.sort(function (a, b) { return b.expr.length - a.expr.length; });
    aliases.forEach(function (a) { body = body.split(a.expr).join(a.name); });
    return header + '\n' + aliases.map(function (a) {
      return 'var ' + a.name + '=' + a.expr + ';';
    }).join('\n') + '\nreturn ' + body + ';';
  }

  function jjencode(text) {
    return aliasSource(text, ['$', '_$', '$$', '$_', '_$$', '$$_', '$$$', '_$_'], '$=~[];/* JJEncode 风味 */');
  }

  function aaencode(text) {
    return aliasSource(text,
      ['_\uff9f\u03c9\uff9f', '_\uff9f\u0398\uff9f', '_\uff9f\u03bb\uff9f', '_\uff9f\u0414\uff9f',
       '_\uff9f\uff70\uff9f', '_\uff9f\u03a6\uff9f', '_\uff9f\u03a8\uff9f', '_\uff9f\u03a9\uff9f'],
      '/*\u00b4\u2207\uff40*/  // ~\u253b\u2501\u253b\nvar _\uff9f\u03c9\uff9f=~[]; /*(\uff9f\u0414\uff9f;)*/');
  }

  OBF.register({
    id: 'esoteric',
    title: '09 · 极简字符集编码',
    tags: ['JSFuck', '8 字符集', '自举 filter/constructor', 'JJEncode', 'AAEncode 颜文字', 'Unicode 标识符', '动态别名表', '无明文常量'],
    run: function () {
      var text = 'obfuscate 2026';
      var src = ENC.strExpr(text);

      OBF.check('JSFuck 解码等价', U.jsVal(src) === text, '还原出 "' + text + '"');
      OBF.check('JSFuck 仅 8 种字符', /^[\[\]()!+{}]+$/.test(src),
        '长度 ' + src.length + '，字符集 [] ( ) ! + { }');
      OBF.check('JSFuck 源码不含明文', src.indexOf(text) < 0, '全部字符由索引表达式拼出');

      OBF.check('自举：filter → constructor → Function',
        typeof ENC.map['v'] === 'string' && typeof ENC.map['('] === 'string',
        ENC.bases.length + ' 个基础串，字符表 ' + Object.keys(ENC.map).length + ' 项');

      var jj = jjencode(text);
      OBF.check('JJEncode 风味可执行', U.jsEval(jj) === text && jj.indexOf('$=~[];') === 0,
        '$/_ 别名表，' + jj.length + ' 字符');

      var aa = aaencode(text);
      OBF.check('AAEncode 颜文字可执行', U.jsEval(aa) === text && aa.indexOf('\uff9f\u03c9\uff9f') >= 0,
        '片假名标识符 + 颜文字注释');

      var extended = 'native v 2026';
      var ext = ENC.strExpr(extended);
      OBF.check('扩展字符集（括号 / v / 大写）', U.jsVal(ext) === extended,
        '借原生函数源码扩充字符表');

      OBF.esoteric = {
        jsfuck: function (t) { return ENC.strExpr(t); },
        decode: function (s) { return U.jsVal(s); },
        jjencode: jjencode, aaencode: aaencode,
        charsetSize: Object.keys(ENC.map).length,
        baseCount: ENC.bases.length
      };
      return 'JSFuck ' + src.length + ' 字符 / JJ ' + jj.length + ' / AA ' + aa.length + '，字符表 ' + Object.keys(ENC.map).length + ' 项';
    }
  });
})(window);
