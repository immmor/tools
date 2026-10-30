import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(here, 'data');

// 单个分片体积上限：Cloudflare Pages 单文件限制 25MB，留出余量按 20MB 切
const CHUNK_LIMIT = 20 * 1024 * 1024;

// 汇总 zhenai 下所有 <地区>/all.json
const regions = fs.readdirSync(here).filter((d) => {
  const p = path.join(here, d);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'all.json'));
});

fs.mkdirSync(outDir, { recursive: true });

const seen = new Set();
const chunks = [];
let total = 0;

for (const r of regions) {
  const arr = JSON.parse(fs.readFileSync(path.join(here, r, 'all.json'), 'utf8'));
  const users = [];
  for (const u of arr) {
    if (!u.id || seen.has(u.id)) continue;
    seen.add(u.id);
    users.push(normalize(u, r));
  }
  if (!users.length) continue;

  splitBySize(users).forEach((part, i, all) => {
    const file = all.length === 1 ? `${r}.json` : `${r}-${i + 1}.json`;
    fs.writeFileSync(path.join(outDir, file), JSON.stringify(part), 'utf8');
    chunks.push({ region: r, file, count: part.length });
    total += part.length;
  });
}

// 清单：前端只读这个文件，再按需加载各分片
const manifest = {
  total,
  chunkSizeLimit: CHUNK_LIMIT,
  generatedAt: new Date().toISOString(),
  chunks,
};
fs.writeFileSync(path.join(outDir, 'index.json'), JSON.stringify(manifest, null, 2), 'utf8');

console.log(
  `合并 ${regions.length} 个地区，去重后 ${total} 条，切成 ${chunks.length} 个分片，已写入 ${outDir}`
);

// 超过单文件上限时按人数对半递归切分
function splitBySize(users) {
  if (JSON.stringify(users).length <= CHUNK_LIMIT || users.length <= 1) return [users];
  const mid = Math.ceil(users.length / 2);
  return [...splitBySize(users.slice(0, mid)), ...splitBySize(users.slice(mid))];
}

// 把抓取字段映射到 index.html 期望的结构
function normalize(u, region) {
  let avatar = (u.avatar || '').replace(/&amp;/g, '&');
  avatar = avatar.replace(/w=140/g, 'w=400').replace(/h=140/g, 'h=400'); // 缩略图放大，显示更清晰
  return {
    id: u.id,
    name: u.name || '',
    age: u.age ?? null,
    job: '',
    height: u.height ?? null,
    constellation: '',
    bloodType: '',
    education: u.education || '',
    hobby: '',
    bio: u.introduce || '',
    photos: avatar ? [avatar] : [],
    income: u.salary || '',
    hometown: '',
    school: '',
    major: '',
    gender: u.gender || '',
    // 额外保留的真实字段（详情页/卡片副标题可用）
    region,
    residence: u.residence || '',
    marital: u.marital || '',
    profile: u.profile || '',
  };
}
