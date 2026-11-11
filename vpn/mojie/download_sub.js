var https = require('https');
var http = require('http');
var tls = require('tls');
var fs = require('fs');
var path = require('path');

var SUB_URL = 'https://103.117.100.123:5000/api/v1/client/subscribe?token=063f74b0f31345b67555d6f3b94ae3dd';
var DIR = __dirname;
var OUT_CLASH = path.join(DIR, 'clash.yaml');
var OUT_V2RAY = path.join(DIR, 'v2ray.txt');

var u = new URL(SUB_URL);
var TARGET = { host: u.hostname, port: u.port || 443, path: u.pathname + u.search };
var infoKeys = /流量|到期|套餐|过滤|剩余|已用|总量|可用/;

function onResp(res) {
  if (res.statusCode !== 200) {
    console.error('HTTP', res.statusCode, '- 下载失败');
    res.resume();
    return;
  }
  var chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    var buf = Buffer.concat(chunks);
    convert(buf.toString('utf8').trim());
  });
}

function writeReq(req) {
  req.on('error', function (e) { console.error('请求错误:', e.message); });
  req.setTimeout(10000, function () {
    console.error('连接超时：10 秒内无响应，请检查网络/代理');
    req.destroy();
  });
  req.end();
}

function requestDirect() {
  var req = https.request({
    host: TARGET.host, port: TARGET.port, path: TARGET.path, method: 'GET',
    rejectUnauthorized: false
  }, onResp);
  writeReq(req);
}

function requestThroughProxy(proxy) {
  var p = new URL(proxy);
  var connectReq = http.request({
    host: p.hostname, port: p.port || 80, method: 'CONNECT',
    path: TARGET.host + ':' + TARGET.port,
    headers: { Host: TARGET.host + ':' + TARGET.port }
  });
  connectReq.on('connect', function (res, socket) {
    if (res.statusCode !== 200) {
      console.error('代理 CONNECT 失败，状态码:', res.statusCode);
      socket.destroy();
      return;
    }
    var req = https.request({
      host: TARGET.host, port: TARGET.port, path: TARGET.path, method: 'GET',
      rejectUnauthorized: false,
      createConnection: function () {
        var opts = { socket: socket, rejectUnauthorized: false };
        if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(TARGET.host)) opts.servername = TARGET.host;
        return tls.connect(opts);
      }
    }, onResp);
    writeReq(req);
  });
  connectReq.on('error', function (e) { console.error('代理连接错误:', e.message); });
  connectReq.end();
}

function parseNodes(b64text) {
  var decoded = Buffer.from(b64text, 'base64').toString('utf8');
  var links = decoded.split(/\r?\n/).map(function (s) { return s.trim(); })
    .filter(function (s) { return s.indexOf('vmess://') === 0; });
  var nodes = [];
  var info = [];
  var seen = {};
  links.forEach(function (link) {
    var b = link.slice('vmess://'.length);
    var cfg;
    try { cfg = JSON.parse(Buffer.from(b, 'base64').toString('utf8')); }
    catch (e) { return; }
    if (!cfg || !cfg.add) return;
    var name = cfg.ps || cfg.add || 'node';
    if (infoKeys.test(name)) { info.push(name); return; }
    if (seen[name]) { seen[name]++; name = name + '-' + seen[name]; }
    else seen[name] = 1;
    nodes.push({
      name: name, link: link, add: cfg.add, port: parseInt(cfg.port, 10),
      id: cfg.id, aid: parseInt(cfg.aid || '0', 10),
      net: cfg.net || 'tcp', path: cfg.path || '/',
      host: cfg.host || cfg.add,
      tls: (cfg.tls === 'tls' || cfg.tls === true)
    });
  });
  return { nodes: nodes, info: info };
}

function toClashYaml(nodes) {
  var proxies = nodes.map(function (n) {
    var s = '  - name: ' + JSON.stringify(n.name) + '\n';
    s += '    type: vmess\n';
    s += '    server: ' + n.add + '\n';
    s += '    port: ' + n.port + '\n';
    s += '    uuid: ' + n.id + '\n';
    s += '    alterId: ' + n.aid + '\n';
    s += '    cipher: auto\n';
    s += '    network: ' + n.net + '\n';
    if (n.net === 'ws') {
      s += '    ws-opts:\n';
      s += '      path: ' + JSON.stringify(n.path) + '\n';
      s += '      headers:\n        Host: ' + n.host + '\n';
    }
    if (n.tls) { s += '    tls: true\n    servername: ' + n.host + '\n'; }
    else { s += '    tls: false\n'; }
    return s;
  }).join('');

  var nameList = nodes.map(function (n) { return '      - ' + JSON.stringify(n.name); }).join('\n');
  return 'port: 7890\n' +
    'socks-port: 7891\n' +
    'allow-lan: false\n' +
    'mode: rule\n' +
    'log-level: info\n' +
    'external-controller: 127.0.0.1:9090\n' +
    'dns:\n' +
    '  enable: true\n' +
    '  enhanced-mode: fake-ip\n' +
    '  nameserver:\n' +
    '    - 223.5.5.5\n' +
    '    - 119.29.29.29\n\n' +
    'proxies:\n' + proxies +
    'proxy-groups:\n' +
    '  - name: 🚀 节点选择\n' +
    '    type: select\n' +
    '    proxies:\n' +
    '      - 自动选择\n' +
    '      - DIRECT\n' + nameList + '\n' +
    '  - name: 自动选择\n' +
    '    type: url-test\n' +
    '    url: https://www.gstatic.com/generate_204\n' +
    '    interval: 300\n' +
    '    proxies:\n' + nameList + '\n\n' +
    'rules:\n' +
    '  - GEOIP,CN,DIRECT\n' +
    '  - DOMAIN-SUFFIX,cn,DIRECT\n' +
    '  - MATCH,🚀 节点选择\n';
}

function toV2RayText(nodes) {
  return nodes.map(function (n) { return n.link; }).join('\n') + '\n';
}

function convert(b64text) {
  var parsed = parseNodes(b64text);
  if (parsed.info.length) {
    console.log('=== 订阅内嵌信息 ===');
    parsed.info.forEach(function (i) { console.log('  ' + i); });
  }
  if (!parsed.nodes.length) {
    console.error('未解析到任何节点');
    return;
  }
  fs.writeFileSync(OUT_CLASH, toClashYaml(parsed.nodes));
  console.log('已生成 Clash 配置：', OUT_CLASH, '(' + parsed.nodes.length + ' 个节点)');
  fs.writeFileSync(OUT_V2RAY, toV2RayText(parsed.nodes));
  console.log('已生成 V2Ray 配置：', OUT_V2RAY, '(' + parsed.nodes.length + ' 个节点)');
}

var proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
            process.env.HTTP_PROXY || process.env.http_proxy || 'http://127.0.0.1:7897';

if (proxy) {
  console.log('使用代理:', proxy);
  requestThroughProxy(proxy);
} else {
  console.log('未设置代理，直连', TARGET.host + ':' + TARGET.port);
  requestDirect();
}
