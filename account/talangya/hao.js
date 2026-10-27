import https from 'https';
import http from 'http';
import tls from 'tls';
import zlib from 'zlib';
import fs from 'fs';

// 代理地址：留空则直连。也可通过环境变量 PROXY / HTTPS_PROXY 传入，例如：
//   PROXY=http://127.0.0.1:7890 node hao.js
const PROXY = process.env.PROXY || process.env.HTTPS_PROXY || 'http://127.0.0.1:7897';

const options = {
  hostname: 'talangya.com',
  path: '/user/api/index/commodity?categoryId=0&compact=1',
  headers: {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'zh-CN,zh;q=0.9',
    'priority': 'u=1, i',
    'referer': 'https://talangya.com/',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': 'ACG-SHOP=d4tuugthg3i49cj66fqnfo48p4'
  }
};

// 直连
function fetchDirect() {
  return new Promise((resolve, reject) => {
    const req = https.get(options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks).toString()));
    });
    req.on('error', reject);
  });
}

// 经 HTTP 代理 CONNECT 隧道访问 HTTPS（stdlib，无依赖）
function fetchViaProxy(proxyUrl) {
  const proxy = new URL(proxyUrl);
  return new Promise((resolve, reject) => {
    const connectReq = http.request({
      host: proxy.hostname,
      port: proxy.port || 80,
      method: 'CONNECT',
      path: `${options.hostname}:${options.port || 443}`,
    });
    connectReq.on('connect', (res, socket) => {
      if (res.statusCode !== 200) {
        return reject(new Error('代理 CONNECT 失败: ' + res.statusCode));
      }
      const tlsSocket = tls.connect({ socket, servername: options.hostname }, () => {
        const headerLines = Object.entries(options.headers || {})
          .map(([k, v]) => `${k}: ${v}`).join('\r\n');
        const reqStr = `GET ${options.path} HTTP/1.1\r\n` +
          `Host: ${options.hostname}\r\n` +
          headerLines + '\r\n' +
          'Connection: close\r\n\r\n';
        tlsSocket.write(reqStr);
      });
      let raw = Buffer.alloc(0);
      tlsSocket.on('data', (d) => { raw = Buffer.concat([raw, d]); });
      tlsSocket.on('end', () => {
        const idx = raw.indexOf('\r\n\r\n');
        const head = raw.slice(0, idx).toString();
        let body = raw.slice(idx + 4);
        // 解析响应头，按需解码 chunked / gzip
        const enc = /transfer-encoding:\s*chunked/i.test(head);
        const gzip = /content-encoding:\s*gzip/i.test(head);
        if (enc) body = decodeChunked(body);
        if (gzip) body = zlib.gunzipSync(body);
        resolve(body.toString());
      });
      tlsSocket.on('error', reject);
    });
    connectReq.on('error', reject);
    connectReq.end();
  });
}

// 解码 HTTP/1.1 chunked 传输编码（代理原始隧道返回的是分块体）
function decodeChunked(buf) {
  const out = [];
  let i = 0;
  while (i < buf.length) {
    const lineEnd = buf.indexOf('\r\n', i);
    if (lineEnd === -1) break;
    const size = parseInt(buf.slice(i, lineEnd).toString().trim().split(';')[0], 16);
    if (isNaN(size) || size === 0) break;
    i = lineEnd + 2;
    out.push(buf.slice(i, i + size));
    i += size + 2; // 跳过块数据 + 末尾 \r\n
  }
  return Buffer.concat(out);
}

const task = PROXY ? fetchViaProxy(PROXY) : fetchDirect();

task.then((body) => {
  const json = JSON.parse(body);
  fs.writeFileSync('data.json', JSON.stringify(json, null, 2));
  console.log('已保存到 data.json');
}).catch((err) => {
  console.error('请求失败：', err.message);
});
