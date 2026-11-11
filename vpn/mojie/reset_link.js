var https = require('https');
var http = require('http');
var tls = require('tls');

var headers = {
  'accept': '*/*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'priority': 'u=1, i',
  'referer': 'https://43.129.207.58:8000/profile',
  'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
  'cookie': 'lang=zh-cn; cw_conversation=eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VfaWQiOiJiMjUzNmYwNC03MTQ1LTQ3Y2UtYjk0Mi0zNzFjMDhlNzdiOTIiLCJpbmJveF9pZCI6MSwiZXhwIjoxODA5NTczNDA2LCJpYXQiOjE3OTQwMjE0MDZ9._emuRLQpTVeqTjpLjuCmK1T8-guJdYoL15GgUKpwGZ0; auth=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6NDYxNTU0Miwic2Vzc2lvbiI6IjViZjFmMTYwZTE5ZDc5MTkyN2Y1ZmFiYzcxOGQxZjExIn0.X5Pv3FRXyCsoMZk9S4P4IN3VLC5k3FDTLFWNXpsOctU; announcement=2026-11-10'
};

var TARGET = { host: '43.129.207.58', port: 8000, path: '/api?action=resetSecurity' };

function onResp(res) {
  var chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    console.log('HTTP', res.statusCode);
    console.log(Buffer.concat(chunks).toString());
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
