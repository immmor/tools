/* 11-app.js — 唯一的可运行自检入口 + 界面驱动 */
(function (root) {
  'use strict';

  var OBF = root.OBF;
  var els = {};

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function appendLog(line) {
    if (!els.console) return;
    var row = document.createElement('div');
    row.className = 'line ' + line.kind.toLowerCase();
    var stamp = new Date(line.at).toTimeString().slice(0, 8);
    row.innerHTML = '<span class="ts">' + stamp + '</span>' +
                    '<span class="kind">' + esc(line.kind) + '</span>' +
                    '<span class="txt">' + esc(line.text) + '</span>';
    els.console.appendChild(row);
    els.console.scrollTop = els.console.scrollHeight;
    while (els.console.childNodes.length > 400) els.console.removeChild(els.console.firstChild);
  }

  function renderCards() {
    OBF.layers.forEach(function (layer, i) {
      var card = document.createElement('section');
      card.className = 'card';
      card.id = 'card-' + layer.id;
      var tags = layer.tags.map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('');
      card.innerHTML =
        '<div class="card-head">' +
          '<span class="num">' + String(i + 1).padStart(2, '0') + '</span>' +
          '<h3>' + esc(layer.title) + '</h3>' +
          '<button class="run" type="button">运行</button>' +
        '</div>' +
        '<div class="tags">' + tags + '</div>' +
        '<div class="result" data-state="idle"><span class="muted">待运行</span></div>';
      els.grid.appendChild(card);
      card.querySelector('.run').addEventListener('click', function () { runUpTo(i); });
    });
  }

  function updateTotals() {
    var p = 0, f = 0, s = 0;
    OBF.checks.forEach(function (c) {
      if (c.ok === true) p++;
      else if (c.ok === false) f++;
      else s++;
    });
    els.pass.textContent = p;
    els.fail.textContent = f;
    els.skip.textContent = s;
    var done = p + f + s;
    els.bar.style.width = (done ? Math.min(100, (done / (OBF.layers.length * 8)) * 100) : 0) + '%';
    els.status.textContent = f ? '存在失败项' : (s ? '部分特性被浏览器限制' : '全部通过');
    els.status.dataset.state = f ? 'fail' : (s ? 'skip' : 'ok');
  }

  async function runLayer(layer) {
    var card = document.getElementById('card-' + layer.id);
    var result = card.querySelector('.result');
    var btn = card.querySelector('.run');
    btn.disabled = true;
    btn.textContent = '…';
    card.dataset.active = '1';
    result.dataset.state = 'running';
    result.innerHTML = '<span class="muted">执行中…</span>';

    var before = OBF.checks.length;
    var t0 = performance.now();
    var summary = '', err = null;
    try { summary = await layer.run(); }
    catch (e) { err = e; OBF.log('FAIL', layer.title + ' 抛出异常：' + ((e && e.message) || String(e))); }

    var added = OBF.checks.slice(before);
    var p = added.filter(function (c) { return c.ok === true; }).length;
    var f = added.filter(function (c) { return c.ok === false; }).length;
    var s = added.filter(function (c) { return c.ok === null; }).length;
    var ms = (performance.now() - t0).toFixed(0);

    result.dataset.state = err || f ? 'fail' : 'ok';
    result.innerHTML =
      '<div class="counts">' +
        '<span class="ok">✓ ' + p + '</span>' +
        '<span class="bad">✕ ' + f + '</span>' +
        '<span class="skipped">⊘ ' + s + '</span>' +
        '<span class="ms">' + ms + 'ms</span>' +
      '</div>' +
      '<div class="msg">' + esc(err ? '异常：' + (err.message || err) : String(summary)) + '</div>';

    btn.disabled = false;
    btn.textContent = '运行';
    delete card.dataset.active;
    updateTotals();
  }

  function showSecret() {
    if (!OBF.chain || !OBF.chain.unlocked) return;
    els.secret.dataset.state = 'open';
    els.secretText.textContent = OBF.chain.unlocked;
    els.pipeline.innerHTML = OBF.chain.pipeline.map(function (n, i) {
      return '<span class="stage">' + String(i + 1).padStart(2, '0') + ' ' + esc(n) + '</span>';
    }).join('<span class="arrow">→</span>');
    var b = OBF.chain.bundle;
    els.bundle.textContent = JSON.stringify({
      id: b.id, day: b.day,
      payload: b.payload.slice(0, 44) + ' … (' + b.payload.length + ' chars)',
      check: String(b.check).slice(0, 20) + '…',
      decoys: b.decoys.length, meta: b.meta
    }, null, 2);
  }

  function reset() {
    OBF.checks.length = 0;
    OBF.logs.length = 0;
    els.console.innerHTML = '';
    OBF.layers.forEach(function (l) {
      var result = document.querySelector('#card-' + l.id + ' .result');
      result.dataset.state = 'idle';
      result.innerHTML = '<span class="muted">待运行</span>';
    });
    els.secret.dataset.state = 'locked';
    els.secretText.textContent = '••••••••••••••••••••••••••••••••';
    els.pipeline.innerHTML = '<span class="muted">链路未建立</span>';
    els.bundle.textContent = '{ }';
    updateTotals();
  }

  var running = false;
  async function runUpTo(idx) {
    if (running) return;
    running = true;
    els.runAll.disabled = true;
    for (var i = 0; i <= idx; i++) {
      await runLayer(OBF.layers[i]);
      showSecret();
    }
    els.runAll.disabled = false;
    running = false;
  }

  function init() {
    els.grid = document.getElementById('grid');
    els.console = document.getElementById('console');
    els.pass = document.getElementById('pass');
    els.fail = document.getElementById('fail');
    els.skip = document.getElementById('skip');
    els.bar = document.getElementById('bar');
    els.status = document.getElementById('status');
    els.secret = document.getElementById('secret');
    els.secretText = document.getElementById('secretText');
    els.pipeline = document.getElementById('pipeline');
    els.bundle = document.getElementById('bundle');
    els.runAll = document.getElementById('runAll');

    OBF.onLog = appendLog;
    renderCards();
    els.runAll.addEventListener('click', function () { reset(); runUpTo(OBF.layers.length - 1); });
    document.getElementById('clear').addEventListener('click', function () { els.console.innerHTML = ''; });

    OBF.log('INFO', '已加载 ' + OBF.layers.length + ' 个混淆模块，开始自检…');
    runUpTo(OBF.layers.length - 1);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
