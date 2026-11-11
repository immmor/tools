var https = require('https');
var http = require('http');
var tls = require('tls');

var headers = {
  'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'accept-language': 'zh-CN,zh;q=0.9',
  'cache-control': 'max-age=0',
  'priority': 'u=0, i',
  'referer': 'https://43.129.207.58:8000/dashboard',
  'sec-ch-ua': '"Not-A.Brand";v="99", "Google Chrome";v="157", "Chromium";v="157"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'document',
  'sec-fetch-mode': 'navigate',
  'sec-fetch-site': 'same-origin',
  'sec-fetch-user': '?1',
  'upgrade-insecure-requests': '1',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157.0.0.0 Safari/537.36',
  'cookie': 'lang=zh-cn; cw_conversation=eyJhbGciOiJIUzI1NiJ9.eyJzb3VyY2VfaWQiOiJiMjUzNmYwNC03MTQ1LTQ3Y2UtYjk0Mi0zNzFjMDhlNzdiOTIiLCJpbmJveF9pZCI6MSwiZXhwIjoxODA5NTczNDA2LCJpYXQiOjE3OTQwMjE0MDZ9._emuRLQpTVeqTjpLjuCmK1T8-guJdYoL15GgUKpwGZ0; auth=eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpZCI6NDM4ODQ5Miwic2Vzc2lvbiI6IjVlMTg0NWNkOGVlMzVlYzY0NTRiYzgwMzAxMDRjOWVkIn0._B_sb0snuJbonpGerPyROHY-O_w6LRe0kG5O5icfk7E; announcement=2026-11-11'
};

var TARGET = { host: '43.129.207.58', port: 8000, path: '/dashboard' };

function onResp(res) {
  var chunks = [];
  res.on('data', function (c) { chunks.push(c); });
  res.on('end', function () {
    var body = Buffer.concat(chunks).toString();
    console.log('HTTP', res.statusCode);
    console.log('=== 提取结果 ===');
    extractTraffic(body);
  });
}

function extractTraffic(body) {
  // 1) 标签 + 数值 + 单位，如「剩余流量：120 GB」「总流量 500GB」
  var labelRe = /([剩余可用已用本月总套餐使用量]+\s*流量|[剩余可用已用总]+\s*用量|套餐流量)[^0-9<>\n]{0,12}?([\d.,]+)\s*([KMGT]?B)/gi;
  var m, found = false;
  while ((m = labelRe.exec(body)) !== null) {
    console.log(m[1].trim() + '：' + m[2] + ' ' + (m[3] || ''));
    found = true;
  }

  // 2) "X / Y" 比值，如 "120.5 GB / 500 GB"
  var ratioRe = /([\d.,]+)\s*([KMGT]?B)\s*[/／]\s*([\d.,]+)\s*([KMGT]?B)/gi;
  while ((m = ratioRe.exec(body)) !== null) {
    console.log('已用/总量：' + m[1] + ' ' + m[2] + ' / ' + m[3] + ' ' + m[4]);
    found = true;
  }

  // 3) 纯百分比，如「已用 24%」
  var pctRe = /(已用|用量|流量)[^0-9<>\n]{0,8}?(\d+(?:\.\d+)?)\s*%/gi;
  while ((m = pctRe.exec(body)) !== null) {
    console.log(m[1].trim() + '：' + m[2] + '%');
    found = true;
  }

  if (!found) console.log('（未通过正则提取到流量数值，请把该接口返回的 HTML 片段发我以补全规则）');
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
