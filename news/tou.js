// ponytail: 一份字典 + 一个本地 API；node tou.js 起服务，页面点分类调 /api/news
const origin = typeof location !== 'undefined' && location.protocol !== 'file:'
  ? location.origin
  : 'http://localhost:3000';

const signs = {
  econ: {
    msToken: '9EeMl_vsoGXXWwNzUqEJ0qTsw1x0gKtsrK3I91csEZYfmKJqFHJ_NWCX2WklZ8CnaIyq_-VSxtVB_CfRKxVeBsclXxlJBhhRnT33ZXGexkjNabIT2smlbIXsbcxBSaM%3D',
    aBogus: 'xXWMBVufdEfThD6V51QLfY3qV433Y2C10t9bMDhqMx3yZL39HMON9exER-tv7x8jF4%2FJIemjy4hbTpcprQVbMZwf98vx%2F25ZQfSkKl12soDC-Nije6kgrUvq-hs1SeA25kp-EKigq7lHFbbhAnAJ-7nXbfaSYrG0wrgECiqL13fIWE%3D%3D',
  },
  tech: {
    msToken: 'GbYrpFqW4Ge-G1JqONRQv7M1ifRk5LSlSK1pY83EBat3idIOyT0GYDsi7aUL8rmBtRwc5aYXvvE1s0d69CyHxpkunE9JYdWXY-89HKHqKF49JLf62XYwOw%3D%3D',
    aBogus: 'xjWM%2FQz6mEfN6DSZ51oLfY3qVvF3Y2t20t9bMDhqhn3yky39HMTH9exE5oGvreRjF4%2FJIemjy4hbTpcprQQJ0Hwf98vx%2F25ZQfSkKl12some-pinegsgrUvq-hs1SeA25kp-EKigq7lHFbbhAnAJ4hc4bfaSYrG0wrgECiqL13fI7f%3D%3D',
    cookie: 'csrftoken=c2df2b3229f628116dc54c56a22d1d4d; _ga=GA1.1.64500559.1730985036; tt_webid=7655382872085513771; s_v_web_id=verify_mudgxpvg_g36SMur2_zaoe_4GR2_AGYW_rswEs8CfTsEr; gfkadpd=24,6457; local_city_cache=%E5%8C%97%E4%BA%AC; __feed_out_channel_key=world; _ga_QEHZPBE5HH=GS2.1.s1795248796$o19$g1$t1795249359$j11$l0$h0; ttwid=1%7CJhgkY0Xj0qeKRdBlmJUczwliCs-YhytW46jRIT9yK_M%7C1795249359%7C9ee301aa8c1d0e37ea88378e8f93dc888a300433ccab4438c8e33dcde3570485; tt_scid=ONFJJk8b7f-8F7jtNxRkcegkP9D1xahEVa3gMhsmLwHFq2v5Ea2HgU0KQSnB5RBXae54',
  },
};

const tou = {
  channels: {
    recommend: { id: 0, label: '推荐' },
    video: { id: 3431225546, label: '视频' },
    hot: { id: 3189398996, label: '热点' },
    world: { id: 3189398968, label: '国际' },
    military: { id: 3189398960, label: '军事' },
    sports: { id: 3189398957, label: '体育' },
    entertainment: { id: 3189398972, label: '娱乐' },
    history: { id: 3189398965, label: '历史' },
    food: { id: 3189399002, label: '美食' },
    travel: { id: 3189398983, label: '旅游' },
    econ: { id: 3189399007, label: '财经', ...signs.econ },
    tech: { id: 3189398999, label: '科技', ...signs.tech },
  },

  api: (name) => `${origin}/api/news?channel=${encodeURIComponent(name)}`,

  async get(name) {
    const res = await fetch(tou.api(name));
    const text = await res.text();
    if (!res.ok) {
      let detail = text || String(res.status);
      try { detail = JSON.parse(text).error || detail; } catch {}
      throw new Error(detail.slice(0, 200));
    }
    return JSON.parse(text);
  },
};

if (typeof process !== 'undefined' && process.versions?.node) {
  (async () => {
    const http = (await import('node:http')).default;
    const https = (await import('node:https')).default;
    const fs = (await import('node:fs')).default;
    const path = (await import('node:path')).default;
    const port = Number(process.env.PORT || 3000);
    const cors = { 'access-control-allow-origin': '*' };

    const sendJson = (res, status, data) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', ...cors });
      res.end(JSON.stringify(data));
    };

    const upstream = (name) => new Promise((resolve, reject) => {
      const { id, msToken = signs.econ.msToken, aBogus = signs.econ.aBogus, cookie } = tou.channels[name];
      const options = {
        hostname: 'www.toutiao.com',
        path: `/api/pc/list/feed?channel_id=${id}&min_behot_time=0&offset=0&refresh_count=1&category=pc_profile_channel&client_extra_params=%7B%22short_video_item%22%3A%22filter%22%7D&aid=24&app_name=toutiao_web&msToken=${msToken}&a_bogus=${aBogus}`,
        headers: {
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'zh-CN,zh;q=0.9',
          'priority': 'u=1, i',
          'referer': 'https://www.toutiao.com/',
          'sec-ch-ua': '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
          ...(cookie ? { cookie } : {}),
        },
      };

      https.get(options, (r) => {
        const chunks = [];
        r.on('data', (chunk) => chunks.push(chunk));
        r.on('error', reject);
        r.on('end', () => {
          const body = Buffer.concat(chunks).toString();
          if (r.statusCode !== 200) return reject(new Error(`upstream ${r.statusCode}: ${body.slice(0, 120)}`));
          if (!body.trim()) return reject(new Error('上游返回空响应，签名可能已失效或与该频道不匹配'));
          try { resolve(JSON.parse(body)); } catch (err) { reject(err); }
        });
      }).on('error', reject);
    });

    http.createServer(async (req, res) => {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      if (url.pathname === '/api/news') {
        const name = url.searchParams.get('channel');
        if (tou.channels[name] === undefined) return sendJson(res, 400, { error: `未知频道: ${name}` });
        try {
          return sendJson(res, 200, await upstream(name));
        } catch (err) {
          return sendJson(res, 502, { error: err.message });
        }
      }

      const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
      if (!['index.html', 'tou.js'].includes(file)) return sendJson(res, 404, { error: 'not found' });

      res.writeHead(200, {
        'content-type': file.endsWith('.html') ? 'text/html; charset=utf-8' : 'text/javascript; charset=utf-8',
        ...cors,
      });
      res.end(fs.readFileSync(path.join(__dirname, file)));
    }).listen(port, () => console.log(`http://localhost:${port}`));
  })();
}
