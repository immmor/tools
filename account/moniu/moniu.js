import https from 'https';
import fs from 'fs';
import path from 'path';

const headers = {
  'accept': '*/*',
  'accept-language': 'zh-CN,zh;q=0.9',
  'priority': 'u=1, i',
  'referer': 'https://moniu.top/',
  'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'sec-fetch-dest': 'empty',
  'sec-fetch-mode': 'cors',
  'sec-fetch-site': 'same-origin',
  'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
  'x-requested-with': 'XMLHttpRequest',
  'cookie': 'server_name_session=ecf4bc255c9802439c60a5749ec2396c'
};

const MAX_RETRY = 3;
const DATA_DIR = path.join(process.cwd(), 'data');

fs.mkdirSync(DATA_DIR, { recursive: true });

function fetchData(apiPath, { outFile, onParsed, retry = 0 } = {}) {
  const options = { hostname: 'moniu.top', path: apiPath, headers };

  const req = https.get(options, function (res) {
    const chunks = [];

    res.on('data', function (chunk) {
      chunks.push(chunk);
    });

    res.on('end', function () {
      const raw = Buffer.concat(chunks).toString();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch (e) {
        console.error('返回内容不是合法 JSON，已按原文保存。');
        parsed = raw;
      }
      if (outFile) {
        fs.writeFileSync(path.join(DATA_DIR, outFile), JSON.stringify(parsed, null, 2));
        console.log(`已保存到 data/${outFile}`);
      }
      if (onParsed) onParsed(parsed);
    });
  });

  req.on('error', function (err) {
    if (retry < MAX_RETRY) {
      console.error(`请求出错（${err.code}），第 ${retry + 1} 次重试...`);
      fetchData(apiPath, { outFile, onParsed, retry: retry + 1 });
    } else {
      console.error('重试次数已用尽，请求失败：', err.message);
    }
  });
}

// 从分类列表响应里尽量提取所有分类 id
function extractCategoryIds(json) {
  const arr = Array.isArray(json)
    ? json
    : (json && (json.data ?? json.list ?? json.result ?? json.rows)) || [];
  if (!Array.isArray(arr)) return [];
  return arr
    .map((it) => (it && (it.id ?? it.categoryId ?? it.category_id)))
    .filter((v) => v != null);
}

const categoryId = process.argv[2];

if (categoryId) {
  // 指定单个分类
  fetchData(`/user/api/index/commodity?categoryId=${categoryId}`, {
    outFile: `commodity_${categoryId}.json`
  });
} else {
  // 先拉分类列表，再循环拉取每个分类的商品
  fetchData('/user/api/index/data', {
    outFile: 'category.json',
    onParsed: function (json) {
      const ids = extractCategoryIds(json);
      console.log(`发现 ${ids.length} 个分类，开始逐个获取商品...`);
      ids.forEach(function (id) {
        fetchData(`/user/api/index/commodity?categoryId=${id}`, {
          outFile: `commodity_${id}.json`
        });
      });
    }
  });
}
