import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// 地区名 -> 该市/区拼音 slug 列表（URL 用）；按需增删
// 用法：node zhenai.js <地区名>  （不传默认 hunan）
const PROVINCES = {
  beijing: [
    'dongcheng', 'xicheng', 'chaoyang', 'haidian', 'fengtai', 'shijingshan',
    'tongzhou', 'shunyi', 'changping', 'daxing', 'huairou', 'pinggu',
    'mentougou', 'fangshan', 'miyun', 'yanqing',
  ],
  tianjin: ['tianjin'],
  hebei: [
    'shijiazhuang', 'tangshan', 'qinhuangdao', 'handan', 'xingtai', 'baoding',
    'zhangjiakou', 'chengde', 'cangzhou', 'langfang', 'hengshui',
  ],
  shanxi: [
    'taiyuan', 'datong', 'yangquan', 'changzhi', 'jincheng', 'shuozhou',
    'jinzhong', 'yuncheng', 'xinzhou', 'linfen', 'luliang',
  ],
  shanghai: [
    'huangpu', 'xuhui', 'changning', 'jingan', 'putuo', 'hongkou',
    'yangpu', 'minhang', 'baoshan', 'jiading', 'pudong', 'jinshan',
    'songjiang', 'qingpu', 'fengxian', 'chongming',
  ],
  jiangsu: [
    'nanjing', 'suzhou', 'wuxi', 'changzhou', 'xuzhou', 'nantong',
    'lianyungang', 'huaian', 'yancheng', 'yangzhou', 'zhenjiang',
    'taizhou', 'suqian',
  ],
  zhejiang: [
    'hangzhou', 'ningbo', 'wenzhou', 'jiaxing', 'huzhou', 'shaoxing',
    'jinhua', 'quzhou', 'zhoushan', 'taizhou', 'lishui',
  ],
  anhui: [
    'hefei', 'wuhu', 'bengbu', 'huainan', 'maanshan', 'huaibei', 'tongling',
    'anqing', 'huangshan', 'chuzhou', 'fuyang', 'suzhou', 'luan', 'bozhou',
    'chizhou', 'xuancheng',
  ],
  fujian: [
    'fuzhou', 'xiamen', 'putian', 'sanming', 'quanzhou', 'zhangzhou',
    'nanping', 'longyan', 'ningde',
  ],
  jiangxi: [
    'nanchang', 'jingdezhen', 'pingxiang', 'jiujiang', 'xinyu', 'yingtan',
    'ganzhou', 'jian', 'yichun', 'fuzhou', 'shangrao',
  ],
  shandong: [
    'jinan', 'qingdao', 'zibo', 'zaozhuang', 'dongying', 'yantai', 'weifang',
    'jining', 'taian', 'weihai', 'rizhao', 'linyi', 'dezhou', 'liaocheng',
    'binzhou', 'heze',
  ],
  henan: [
    'zhengzhou', 'kaifeng', 'luoyang', 'pingdingshan', 'anyang', 'hebi',
    'xinxiang', 'jiaozuo', 'puyang', 'xuchang', 'luohe', 'sanmenxia',
    'nanyang', 'shangqiu', 'xinyang', 'zhoukou', 'zhumadian', 'jiyuan',
  ],
  hubei: [
    'wuhan', 'huangshi', 'shiyan', 'yichang', 'xiangyang', 'ezhou', 'jingmen',
    'xiaogan', 'jingzhou', 'huanggang', 'xianning', 'suizhou', 'enshi',
  ],
  hunan: [
    'changsha', 'zhuzhou', 'xiangtan', 'hengyang', 'shaoyang', 'yueyang',
    'changde', 'zhangjiajie', 'yiyang', 'chenzhou', 'yongzhou', 'huaihua',
    'loudi', 'xiangxi',
  ],
  guangdong: [
    'guangzhou', 'shenzhen', 'dongguan', 'foshan', 'zhuhai', 'zhongshan',
    'huizhou', 'shantou', 'jiangmen', 'zhanjiang', 'zhaoqing', 'maoming',
    'jieyang', 'meizhou', 'qingyuan', 'shaoguan', 'heyuan', 'yangjiang',
    'chaozhou', 'yunfu',
  ],
  guangxi: [
    'nanning', 'liuzhou', 'guilin', 'wuzhou', 'beihai', 'fangchenggang',
    'qinzhou', 'guigang', 'yulin', 'baise', 'hezhou', 'hechi', 'laibin',
    'chongzuo',
  ],
  hainan: [
    'haikou', 'sanya', 'sansha', 'danzhou', 'wuzhishan', 'qionghai', 'wenchang',
    'wanning', 'dongfang',
  ],
  chongqing: ['chongqing'],
  sichuan: [
    'chengdu', 'zigong', 'panzhihua', 'luzhou', 'deyang', 'mianyang',
    'guangyuan', 'suining', 'neijiang', 'leshan', 'nanchong', 'meishan',
    'yibin', 'guangan', 'dazhou', 'bazhong', 'ziyang', 'yaan',
    'aba', 'ganzi', 'liangshan',
  ],
  guizhou: [
    'guiyang', 'liupanshui', 'zunyi', 'anshun', 'bijie', 'tongren',
    'qianxinan', 'qiandongnan', 'qiannan',
  ],
  yunnan: [
    'kunming', 'qujing', 'yuxi', 'baoshan', 'zhaotong', 'lijiang', 'puer',
    'lincang', 'chuxiong', 'honghe', 'wenshan', 'xishuangbanna', 'dali',
    'dehong', 'nujiang', 'diqing',
  ],
  xizang: [
    'lhasa', 'rikaze', 'shannan', 'naqu', 'linzhi', 'ali',
  ],
  shaanxi: [
    'xian', 'tongchuan', 'baoji', 'xianyang', 'weinan', 'yanan', 'hanzhong',
    'yulin', 'ankang', 'shangluo',
  ],
  gansu: [
    'lanzhou', 'jiayuguan', 'jinchang', 'tianshui', 'wuwei', 'zhangye',
    'pingliang', 'jiuquan', 'qingyang', 'dingxi', 'longnan', 'linxia', 'gannan',
  ],
  qinghai: [
    'xining', 'haidong', 'haibei', 'huangnan', 'hainan', 'guoluo', 'yushu',
    'haixi',
  ],
  ningxia: [
    'yinchuan', 'shizuishan', 'wuzhong', 'guyuan', 'zhongwei',
  ],
  xinjiang: [
    'wulumuqi', 'kelamayi', 'tulufan', 'hami', 'changji', 'bortala',
    'bayinguoleng', 'akesu', 'kezilesu', 'kashi', 'hetian', 'yili',
    'tacheng', 'aletai',
  ],
  neimenggu: [
    'hohhot', 'baotou', 'wuhai', 'chifeng', 'tongliao', 'ordos', 'hulunbuir',
    'bayannur', 'wulanchabu', 'xingan', 'xilingol', 'alashan',
  ],
  liaoning: [
    'shenyang', 'dalian', 'anshan', 'fushun', 'benxi', 'dandong', 'jinzhou',
    'yingkou', 'fuxin', 'liaoyang', 'panjin', 'tieling', 'chaoyang', 'huludao',
  ],
  jilin: [
    'changchun', 'jilin', 'siping', 'liaoyuan', 'tonghua', 'baishan',
    'songyuan', 'baicheng', 'yanbian',
  ],
  heilongjiang: [
    'harbin', 'qiqihar', 'jixi', 'hegang', 'shuangyashan', 'daqing', 'yichun',
    'jiamusi', 'qitaihe', 'mudanjiang', 'heihe', 'suihua', 'daxinganling',
  ],
};

const REGION = process.argv[2] || '--all';   // 不传参数 = 跑全部（自动跳过已抓过的省份）
const MAX_PAGE = 50;        // 单区最多翻页数（安全上限，遇到空页会自动停）
const DELAY_MIN = 0;        // 请求间隔下限(ms)
const DELAY_MAX = 5000;     // 请求间隔上限(ms)，随机区间(0-5秒)避免被识别为脚本

// 省份输出目录；该目录下已有 all.json 视为已抓取过，自动跳过
function regionOutDir(region) {
  return fileURLToPath(new URL('./' + region, import.meta.url));
}
function isRegionDone(region) {
  return fs.existsSync(path.join(regionOutDir(region), 'all.json'));
}

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

async function scrapeRegion(region) {
  const districts = PROVINCES[region];
  if (!districts) {
    console.error(`未知地区：${region}。可选：${Object.keys(PROVINCES).join(', ')}`);
    return;
  }
  if (isRegionDone(region)) {
    console.log(`⏭  跳过 ${region}（已抓取过：${regionOutDir(region)}）`);
    return;
  }
  const outDir = regionOutDir(region);
  fs.mkdirSync(outDir, { recursive: true });
  const all = [];
  for (const district of districts) {
    console.log(`抓取 ${region}/${district} ...`);
    const users = await crawlDistrict(district);
    if (users.length) {
      fs.writeFileSync(path.join(outDir, `${district}.json`), JSON.stringify(users, null, 2), 'utf8');
      all.push(...users);
      console.log(`  ${district} 完成：${users.length} 条`);
    } else {
      console.warn(`  ${district}：未获取到数据（slug 可能不对或 404）`);
    }
    await sleep(randDelay());
  }
  fs.writeFileSync(path.join(outDir, 'all.json'), JSON.stringify(all, null, 2), 'utf8');
  console.log(`\n${region} 完成，共 ${all.length} 条，已写入 ${outDir}`);
}

async function main() {
  if (REGION === '--all') {
    for (const key of Object.keys(PROVINCES)) {
      await scrapeRegion(key);
    }
    console.log('\n全部省份处理完毕（已抓过的自动跳过）。');
  } else {
    await scrapeRegion(REGION);
  }
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
