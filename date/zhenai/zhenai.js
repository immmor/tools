import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 地区名 -> 该市/区拼音 slug 列表（URL 用）；按需增删
const PROVINCES = {
  hunan: [
    'changsha', 'zhuzhou', 'xiangtan', 'hengyang', 'shaoyang', 'yueyang',
    'changde', 'zhangjiajie', 'yiyang', 'chenzhou', 'yongzhou', 'huaihua',
    'loudi', 'xiangxi',
  ],
};

// 用法：node zhenai.js hunan （不传默认 hunan）
const REGION = process.argv[2] || 'hunan';
const DISTRICTS = PROVINCES[REGION];
if (!DISTRICTS) {
  console.error(`未知地区：${REGION}。可选：${Object.keys(PROVINCES).join(', ')}`);
  process.exit(1);
}

const MAX_PAGE = 50;        // 单区最多翻页数（安全上限，遇到空页会自动停）
const DELAY_MIN = 500;      // 请求间隔下限(ms)
const DELAY_MAX = 1800;     // 请求间隔上限(ms)，随机区间避免被识别为脚本
const OUT_DIR = fileURLToPath(new URL('./' + REGION, import.meta.url));

const HEADERS = {
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
  'Accept-Language': 'zh-CN,zh;q=0.9',
  'Connection': 'keep-alive',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'cross-site',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
  'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
  'sec-ch-ua-mobile': '?0',
  'sec-ch-ua-platform': '"macOS"',
  'Cookie': 'sid=69cacc9c-ae70-41bc-aa80-ecb54aabc0fc; Hm_lvt_2c8ad67df9e787ad29dbd54ee608f5d2=1793318802; HMACCOUNT=91558B1EFA11E991; Hm_lpvt_2c8ad67df9e787ad29dbd54ee608f5d2=1793318927; ec=t0vOUy0N-1793318926798-7a82b80124238-179181259; __channelId=901045%2C0; _efmdata=DLnCkVmT1GUVfnFhzKmC%2BGDZ6TU6Va3cHvIlE0sdVQvXm%2Bl7bHTy%2Bfs2K%2FQ3F1iIFP1Jww4d0Dhv2u9iRxV7aAUbiqFUECa2QkJ90ltTIcE%3D; _exid=%2ByNmwdrG5q59DumvgnAfjgmLxxZB4i2%2BsdHzuJqT4V8YepZeY%2BCJMBrfCjHGTqBlguYtbcX6VYFvkk9mi8VjKw%3D%3D'
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const randDelay = () => DELAY_MIN + Math.floor(Math.random() * (DELAY_MAX - DELAY_MIN));

function fetchPage(district, page) {
  return new Promise((resolve, reject) => {
    https.get(
      { hostname: 'www.zhenai.com', path: `/zhenghun/${district}/${page}`, headers: HEADERS },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      }
    ).on('error', reject);
  });
}

async function crawlDistrict(district) {
  const seen = new Map(); // id -> user，按 id 去重
  for (let page = 1; page <= MAX_PAGE; page++) {
    const html = await fetchPage(district, page);
    const users = parseUsers(html);
    if (users.length === 0) break; // 该页无数据，停止翻页
    for (const u of users) if (!seen.has(u.id)) seen.set(u.id, u);
    console.log(`  ${district} 第${page}页：${users.length} 条（累计 ${seen.size}）`);
    await sleep(randDelay());
  }
  return [...seen.values()];
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const all = [];
  for (const district of DISTRICTS) {
    console.log(`抓取 ${district} ...`);
    const users = await crawlDistrict(district);
    if (users.length) {
      fs.writeFileSync(path.join(OUT_DIR, `${district}.json`), JSON.stringify(users, null, 2), 'utf8');
      all.push(...users);
      console.log(`  ${district} 完成：${users.length} 条`);
    } else {
      console.warn(`  ${district}：未获取到数据（slug 可能不对或 404）`);
    }
    await sleep(randDelay());
  }
  fs.writeFileSync(path.join(OUT_DIR, 'all.json'), JSON.stringify(all, null, 2), 'utf8');
  console.log(`\n全部完成，共 ${all.length} 条，已写入 ${OUT_DIR}`);
}

main().catch((e) => { console.error('运行出错：', e); process.exit(1); });

// 按 <div class="list-item"> 切分，每个卡片解析出字段
function parseUsers(html) {
  const users = [];
  const parts = html.split('<div class="list-item">');
  for (let i = 1; i < parts.length; i++) {
    const b = parts[i];
    const idM = b.match(/album\.zhenai\.com\/u\/(\d+)/);
    if (!idM) continue;

    const avatarM = b.match(/<img[^>]*src="([^"]+)"/);
    const nameM = b.match(/<th><a[^>]*>([^<]+)<\/a><\/th>/) || b.match(/<img[^>]*alt="([^"]+)"/);
    const introM = b.match(/<div class="introduce">([\s\S]*?)<\/div>/);
    const tableM = b.match(/<table>([\s\S]*?)<\/table>/);
    const tb = tableM ? tableM[1] : b;

    const genderRaw = pick(tb, '性别');
    users.push({
      id: idM[1],
      name: nameM ? nameM[1].trim() : '',
      avatar: avatarM ? avatarM[1] : '',
      profile: `http://album.zhenai.com/u/${idM[1]}`,
      gender: ({ '男士': '男', '女士': '女', '先生': '男', '小姐': '女' })[genderRaw] || genderRaw,
      residence: pick(tb, '居住地'),
      age: toNum(pick(tb, '年龄')),
      education: pick(tb, '学历'),
      marital: pick(tb, '婚况'),
      height: toNum(pick(tb, '身高')),
      salary: pick(tb, '月薪'),
      introduce: introM ? introM[1].replace(/<[^>]+>/g, ' ').trim() : '',
    });
  }
  return users;
}

// 标签与值之间可能有全角空格；值通常在 </span> 之后，所以冒号后允许跳过标签再取值
function pick(block, label) {
  const pat = label.split('').join('\\s*') + '\\s*[：:](?:<[^>]*>)*\\s*([^<]+)';
  const m = block.match(new RegExp(pat));
  return m ? m[1].trim() : '';
}

function toNum(s) {
  const n = parseInt(s, 10);
  return Number.isNaN(n) ? null : n;
}
