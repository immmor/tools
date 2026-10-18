// 本地 CORS 反向代理
// 作用：浏览器因 CORS 无法直接访问 https://api.agnes-ai.cn，
//       本代理在本机监听，由 Node 代为转发请求（服务端请求不受 CORS 限制），
//       并在响应里补上 Access-Control-Allow-Origin，使前端页面可正常调用。
//
// 运行： node video.js   （无需安装任何依赖，Node >= 14 即可）
// 然后在前端 video.html 中将 USE_PROXY 设为 true。

const http = require('http');
const https = require('https');
const { URL } = require('url');

const LISTEN_HOST = '127.0.0.1';
const LISTEN_PORT = 8787;
const UPSTREAM_BASE = 'https://api.agnes-ai.cn'; // 注意：不带结尾斜杠

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type, Origin, X-Requested-With, Accept'
};

const server = http.createServer((req, res) => {
  // 预检请求（OPTIONS）直接放行
  if (req.method === 'OPTIONS') {
    res.writeHead(204, CORS);
    return res.end();
  }

  let target;
  try {
    target = new URL(UPSTREAM_BASE + req.url);
  } catch (err) {
    res.writeHead(400, { ...CORS, 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ error: 'bad_url', message: err.message }));
  }

  const bodyChunks = [];
  req.on('data', (chunk) => bodyChunks.push(chunk));
  req.on('end', () => {
    const body = Buffer.concat(bodyChunks);

    // 转发原始请求头，但重写 host，去掉会暴露本地来源的 origin/referer
    const headers = { ...req.headers };
    headers.host = target.host;
    delete headers.origin;
    delete headers.referer;
    // 不接受压缩，便于代理日志直接看到上游的错误信息（gzip 会把 403 原因也压成乱码）
    delete headers['accept-encoding'];

    const upstreamReq = https.request(
      target,
      { method: req.method, headers },
      (upstreamRes) => {
        const responseHeaders = { ...CORS };
        for (const [k, v] of Object.entries(upstreamRes.headers)) {
          // 避免上游已有的 CORS 头与我们的冲突
          if (k.toLowerCase() === 'access-control-allow-origin') continue;
          responseHeaders[k] = v;
        }

        // 收集上游响应体用于日志与透传
        const chunks = [];
        upstreamRes.on('data', (c) => chunks.push(c));
        upstreamRes.on('end', () => {
          const raw = Buffer.concat(chunks);
          // 打印诊断信息（不打印 Authorization）
          const logHeaders = { ...headers };
          if (logHeaders.authorization) logHeaders.authorization = 'Bearer ***';
          console.log(
            `\n[${new Date().toISOString()}] ${req.method} ${req.url}` +
            `\n  → ${target.href}` +
            `\n  请求头: ${JSON.stringify(logHeaders)}` +
            (body.length ? `\n  请求体: ${body.toString('utf8').slice(0, 500)}` : '') +
            `\n  上游状态码: ${upstreamRes.statusCode}` +
            `\n  上游响应: ${raw.toString('utf8').slice(0, 1000)}\n`
          );
          res.writeHead(upstreamRes.statusCode, responseHeaders);
          res.end(raw);
        });
      }
    );

    upstreamReq.on('error', (err) => {
      res.writeHead(502, { ...CORS, 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'proxy_error', message: err.message }));
    });

    if (body.length > 0) upstreamReq.write(body);
    upstreamReq.end();
  });
});

server.listen(LISTEN_PORT, LISTEN_HOST, () => {
  console.log(
    `CORS 代理已启动: http://${LISTEN_HOST}:${LISTEN_PORT}  →  ${UPSTREAM_BASE}`
  );
});
