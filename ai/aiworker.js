/**
 * AI HUB 网关（极简版）
 * ---------------------------------------------------------------------------
 * 账号接口（JSON）：
 *   POST /api/register   {username,password}                 注册，送 ¥20
 *   POST /api/login      {username,password}                 返回 {ok,balance}
 *   POST /api/recharge   {username,password,amount}          充值
 *   POST /api/keys       {username,password,name}            生成 API Key
 *   GET  /api/me?username=&password=                        返回 {balance,keys}
 *   GET  /api/keys?username=&password=                      列出密钥
 *
 * 对话接口（OpenAI 兼容）：
 *   POST /v1/chat/completions   Authorization: Bearer <key>   支持 stream
 *   GET  /v1/models
 *
 * 配置：KV 绑定 AIHUB；Secrets: OPENAI_KEY / DEEPSEEK_KEY /
 *       DASHSCOPE_KEY / ZHIPU_KEY / MOONSHOT_KEY
 * ---------------------------------------------------------------------------
 */

const PROVIDERS = {
  openai:   { url: 'https://api.openai.com/v1/chat/completions',                 key: 'OPENAI_KEY' },
  deepseek: { url: 'https://api.deepseek.com/v1/chat/completions',               key: 'DEEPSEEK_KEY' },
  qwen:     { url: 'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', key: 'DASHSCOPE_KEY' },
  glm:      { url: 'https://open.bigmodel.cn/api/paas/v4/chat/completions',      key: 'ZHIPU_KEY' },
  moonshot: { url: 'https://api.moonshot.cn/v1/chat/completions',                key: 'MOONSHOT_KEY' },
};

function providerOf(model) {
  if (!model) return null;
  if (model.startsWith('gpt-')) return 'openai';
  if (model.startsWith('deepseek')) return 'deepseek';
  if (model.startsWith('qwen')) return 'qwen';
  if (model.startsWith('glm')) return 'glm';
  if (model.startsWith('moonshot')) return 'moonshot';
  return null;
}

// 每百万 tokens 计价（与前端一致）；usd 模型按 RATE 折算 ¥
const PRICING = {
  'gpt-4o': { in: 2.5, out: 10, usd: true },
  'gpt-4o-mini': { in: 0.15, out: 0.6, usd: true },
  'gpt-4-turbo': { in: 10, out: 30, usd: true },
  'deepseek-chat': { in: 1, out: 4 },
  'deepseek-reasoner': { in: 4, out: 16 },
  'qwen-plus': { in: 4, out: 12 },
  'qwen-max': { in: 20, out: 60 },
  'qwen-turbo': { in: 2, out: 6 },
  'glm-4-plus': { in: 50, out: 50 },
  'glm-4-air': { in: 10, out: 10 },
  'glm-4-flash': { in: 0, out: 0.1 },
  'moonshot-v1-8k': { in: 12, out: 12 },
  'moonshot-v1-128k': { in: 60, out: 60 },
};
const RATE = 7.2;

function cost(model, usage) {
  const p = PRICING[model];
  if (!p || !usage) return 0;
  const raw = (usage.prompt_tokens * p.in + usage.completion_tokens * p.out) / 1e6;
  return p.usd ? raw * RATE : raw;
}

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', ...CORS } });
const fail = (status, message) => json({ error: message }, status);

async function sha256(s) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function rand(n) {
  const c = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let s = '';
  for (let i = 0; i < n; i++) s += c[Math.floor(Math.random() * c.length)];
  return s;
}

const getUser = (env, u) => env.AIHUB.get('u:' + u, { type: 'json' });
const saveUser = (env, u, data) => env.AIHUB.put('u:' + u, JSON.stringify(data));

async function authUser(env, username, password) {
  const user = await getUser(env, username);
  if (!user || user.hash !== (await sha256(password))) return null;
  return user;
}

async function register(env, body) {
  const { username, password } = body;
  if (!username || !password) return fail(400, '用户名和密码必填');
  if (await getUser(env, username)) return fail(409, '用户名已存在');
  const user = { hash: await sha256(password), balance: 20, keys: [] };
  await saveUser(env, username, user);
  return json({ ok: true, balance: user.balance });
}

async function login(env, body) {
  const user = await authUser(env, body.username, body.password);
  if (!user) return fail(401, '用户名或密码错误');
  return json({ ok: true, balance: user.balance });
}

async function recharge(env, body) {
  const user = await authUser(env, body.username, body.password);
  if (!user) return fail(401, '用户名或密码错误');
  const a = Number(body.amount);
  if (!(a > 0)) return fail(400, '金额无效');
  user.balance = (user.balance || 0) + a;
  await saveUser(env, body.username, user);
  return json({ ok: true, balance: user.balance });
}

async function createKey(env, body) {
  const user = await authUser(env, body.username, body.password);
  if (!user) return fail(401, '用户名或密码错误');
  const key = 'sk-aihub-' + rand(32);
  const rec = { name: body.name || '密钥-' + (user.keys.length + 1), key, created: new Date().toISOString() };
  user.keys.push(rec);
  await saveUser(env, body.username, user);
  await env.AIHUB.put('k:' + key, body.username); // key -> username 反查
  return json({ ok: true, key, name: rec.name });
}

async function deleteKey(env, body) {
  const user = await authUser(env, body.username, body.password);
  if (!user) return fail(401, '用户名或密码错误');
  const key = body.key;
  if (!key) return fail(400, '缺少 key');
  user.keys = user.keys.filter((k) => k.key !== key);
  await saveUser(env, body.username, user);
  await env.AIHUB.delete('k:' + key).catch(() => {});
  return json({ ok: true });
}

async function me(env, url) {
  const user = await authUser(env, url.searchParams.get('username'), url.searchParams.get('password'));
  if (!user) return fail(401, '用户名或密码错误');
  return json({ ok: true, balance: user.balance, keys: user.keys });
}

// ---- 对话代理 ----
async function chat(env, ctx, request, body) {
  const m = (request.headers.get('authorization') || '').match(/^Bearer\s+(.+)$/i);
  if (!m) return fail(401, '缺少 API Key');
  const username = await env.AIHUB.get('k:' + m[1]);
  if (!username) return fail(401, '无效的 API Key');
  const user = await getUser(env, username);
  if (!user || (user.balance || 0) <= 0) return fail(402, '余额不足');

  const pname = providerOf(body.model);
  if (!pname) return fail(404, '不支持的模型：' + body.model);
  const provider = PROVIDERS[pname];
  const upstreamKey = env[provider.key];
  if (!upstreamKey) return fail(503, '厂商未配置密钥');

  const upBody = { ...body };
  if (body.stream) upBody.stream_options = { include_usage: true };

  const up = await fetch(provider.url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: 'Bearer ' + upstreamKey },
    body: JSON.stringify(upBody),
  }).catch(() => null);
  if (!up) return fail(502, '上游连接失败');

  if (!up.ok) {
    return new Response(await up.text().catch(() => ''), { status: up.status, headers: { 'content-type': 'application/json', ...CORS } });
  }

  const bill = (usage) => {
    const c = cost(body.model, usage);
    if (!c) return;
    ctx.waitUntil((async () => {
      const u = await getUser(env, username);
      if (!u) return;
      u.balance = Math.max(0, (u.balance || 0) - c);
      await saveUser(env, username, u);
    })());
  };

  if (body.stream) {
    const reader = up.body.getReader();
    const decoder = new TextDecoder();
    let buf = '';
    const stream = new ReadableStream({
      async pull(controller) {
        const { done, value } = await reader.read();
        if (done) {
          const u = parseUsage(buf);
          if (u) bill(u);
          controller.close();
          return;
        }
        buf += decoder.decode(value, { stream: true });
        controller.enqueue(value);
      },
      cancel() { reader.cancel(); },
    });
    return new Response(stream, {
      status: 200,
      headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-cache', ...CORS },
    });
  }

  const data = await up.json().catch(() => null);
  if (data && data.usage) bill(data.usage);
  return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json', ...CORS } });
}

function parseUsage(buf) {
  for (const line of buf.split('\n')) {
    const t = line.trim();
    if (t.startsWith('data:')) {
      const d = t.slice(5).trim();
      if (d && d !== '[DONE]') {
        try { const j = JSON.parse(d); if (j.usage) return j.usage; } catch { /* 忽略 */ }
      }
    }
  }
  return null;
}

function listModels() {
  return json({
    object: 'list',
    data: Object.keys(PRICING).map((id) => ({ id, object: 'model', owned_by: 'aihub' })),
  });
}

export default {
  async fetch(request, env, ctx) {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });
    const url = new URL(request.url);
    const p = url.pathname;
    const body = request.method === 'POST' ? await request.json().catch(() => ({})) : {};

    if (p === '/api/register') return register(env, body);
    if (p === '/api/login') return login(env, body);
    if (p === '/api/recharge') return recharge(env, body);
    if (p === '/api/keys' && request.method === 'POST') return createKey(env, body);
    if (p === '/api/keys/delete' && request.method === 'POST') return deleteKey(env, body);
    if (p === '/api/me') return me(env, url);
    if (p === '/v1/chat/completions' && request.method === 'POST') return chat(env, ctx, request, body);
    if (p === '/v1/models') return listModels();
    return fail(404, '接口不存在：' + p);
  },
};
