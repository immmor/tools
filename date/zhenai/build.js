import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// 汇总 zhenai 下所有 <地区>/all.json
const regions = fs.readdirSync(here).filter((d) => {
  const p = path.join(here, d);
  return fs.statSync(p).isDirectory() && fs.existsSync(path.join(p, 'all.json'));
});

const out = [];
const seen = new Set();
for (const r of regions) {
  const arr = JSON.parse(fs.readFileSync(path.join(here, r, 'all.json'), 'utf8'));
  for (const u of arr) {
    if (!u.id || seen.has(u.id)) continue;
    seen.add(u.id);
    out.push(normalize(u, r));
  }
}

const target = path.join(here, 'users.json');
fs.writeFileSync(target, JSON.stringify(out, null, 2), 'utf8');
console.log(`合并 ${regions.length} 个地区（${regions.join(', ')}），去重后共 ${out.length} 条，已写入 ${target}`);

// 把抓取字段映射到 index.html 期望的 users.json 结构
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
