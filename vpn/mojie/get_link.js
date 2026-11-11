var https = require('https');
var http = require('http');
var tls = require('tls');

var headers = {
  'accept': '*/*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'priority': 'u=1, i',
  'referer': 'https://43.129.207.58:8000/dashboard',
  'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
  'cookie': 'lang=zh-cn; cw_conversation=eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VfaWQiOiJiMjUzNmYwNC03MTQ1LTQ3Y2UtYjk0Mi0zNzFjMDhlNzdiOTIiLCJpbmJveF9pZCI6MSwiZXhwIjoxODA5NTczNDA2LCJpYXQiOjE3OTQwMjE0MDZ9._emuRLQpTVeqTjpLjuCmK1T8-guJdYoL15GgUKpwGZ0; announcement=2026-11-10; auth=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6NDM4ODQ5Miwic2Vzc2lvbiI6IjVlMTg0NWNkOGVlMzVlYzY0NTRiYzgwMzAxMDRjOWVkIn0._B_sb0snuJbonpGerPyROHY-O_w6LRe0kG5O5icfk7E'
};

var TARGET = { host: '43.129.207.58', port: 8000, path: '/api?action=gettipsbody' };

function onResp(res) {
  var chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    var body = Buffer.concat(chunks).toString();
    console.log('HTTP', res.statusCode);
    console.log('=== 原始响应 ===');
    console.log(body);

    var inputTag = body.match(/<input\b[^>]*>/i);
    if (inputTag) {
      var m = inputTag[0].match(/\bvalue="([^"]*)"/i);
      if (m) {
        console.log('=== 第一个 input 的 value ===');
        console.log(m[1]);
      } else {
        console.log('该 input 没有 value 属性');
      }
    } else {
      console.log('未找到 input 标签');
    }
  });
}

function writeBody(req) {
  req.on('error', function (e) { console.error('请求错误:', e.message); });
  req.setTimeout(8000, function () {
    console.error('连接超时：8 秒内无响应，请检查网络/代理');
    req.destroy();
  });
  req.end();
}

function requestDirect() {
  var req = https.request({
    host: TARGET.host,
    port: TARGET.port,
    path: TARGET.path,
    method: 'GET',
    headers: headers,
    rejectUnauthorized: false
  }, onResp);
  writeBody(req);
}

function requestThroughProxy(proxy) {
  var p = new URL(proxy);
  var connectReq = http.request({
    host: p.hostname,
    port: p.port || 80,
    method: 'CONNECT',
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
      host: TARGET.host,
      port: TARGET.port,
      path: TARGET.path,
      method: 'GET',
      headers: headers,
      rejectUnauthorized: false,
      createConnection: function () {
        return tls.connect({ socket: socket, servername: TARGET.host, rejectUnauthorized: false });
      }
    }, onResp);
    writeBody(req);
  });
  connectReq.on('error', function (e) { console.error('代理连接错误:', e.message); });
  connectReq.end();
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
