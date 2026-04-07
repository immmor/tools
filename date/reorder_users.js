const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, 'users.js');
const content = fs.readFileSync(usersFile, 'utf8');

const match = content.match(/const userData = \[(.+?)\];/s);
if (!match) {
    console.error('未找到 userData 数据');
    process.exit(1);
}

const dataStr = match[1];
const lines = dataStr.split('\n').filter(line => line.trim());

const users = lines.map(line => {
    const jsonStr = line.trim().replace(/,$/, '');
    return eval('(' + jsonStr + ')');
});

const firstNames = ['苏', '阿', '琳', '小', '大', '婷', '志', '佳', '梦', '子', '诗', '俊', '欣', '宇', '雨', '浩', '晨', '明', '雅', '雪', '晴', '涵', '悦', '诺', '依', '瑾', '瑜', '璇', '颖', '彤', '蕊', '菲', '娜', '怡', '倩', '婉', '静', '思', '洁', '玲', '玉', '晶', '冰', '霜', '云', '霞', '艳', '丽', '娟', '敏', '华', '英', '波', '磊', '军', '洋', '勇', '杰', '强', '辉', '宁', '超', '秀', '伟', '刚', '平', '康', '健', '帆', '哲', '阳', '霖', '昊', '轩', '睿', '辰', '然', '泽', '毅', '文', '博', '锐', '鸿', '翔', '鹏', '飞', '龙', '虎', '豹', '麟', '凤', '燕', '鸥', '雁', '莺', '鹂', '鹰', '鹤', '鸾', '雀', '隼', '鹗'];
const lastNames = ['苏', '阿', '琳', '小', '大', '婷', '志', '佳', '梦', '子', '诗', '俊', '欣', '宇', '雨', '浩', '晨', '明', '雅', '雪', '晴', '涵', '悦', '诺', '依', '瑾', '瑜', '璇', '颖', '彤', '蕊', '菲', '娜', '怡', '倩', '婉', '静', '思', '洁', '玲', '玉', '晶', '冰', '霜', '云', '霞', '艳', '丽', '娟', '敏', '华', '英', '波', '磊', '军', '洋', '勇', '杰', '强', '辉', '宁', '超', '秀', '伟', '刚', '平', '康', '健', '帆', '哲', '阳', '霖', '昊', '轩', '睿', '辰', '然', '泽', '毅', '文', '博', '锐', '鸿', '翔', '鹏', '飞', '龙', '虎', '豹', '麟', '凤', '燕', '鸥', '雁', '莺', '鹂', '鹰', '鹤', '鸾', '雀', '隼', '鹗'];

function getRandomName() {
    const nameLength = Math.floor(Math.random() * 3) + 2;
    let name = '';
    for (let i = 0; i < nameLength; i++) {
        if (i === 0) {
            name += firstNames[Math.floor(Math.random() * firstNames.length)];
        } else {
            name += lastNames[Math.floor(Math.random() * lastNames.length)];
        }
    }
    return name;
}

function getRandomAge() {
    return Math.floor(Math.random() * 23) + 18;
}

const newUsers = users.map((user, index) => ({
    ...user,
    id: index + 1,
    name: getRandomName(),
    age: getRandomAge()
}));

const output = `const userData = [
    ${newUsers.map(user => JSON.stringify(user).replace(/,/g, ', ')).join(',\n    ')}
];`;

fs.writeFileSync(usersFile, output, 'utf8');
console.log(`用户数据已重新生成！共 ${newUsers.length} 个用户`);
