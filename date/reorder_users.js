const fs = require('fs');
const path = require('path');

const usersFile = path.join(__dirname, 'users.json');
const content = fs.readFileSync(usersFile, 'utf8');

const users = JSON.parse(content);

const newUsers = users.map(user => {
    const { gender, ...rest } = user;
    return {
        ...rest,
        gender: Math.random() > 0.5 ? '女' : '男'
    };
});

const output = '[' + newUsers.map(user => JSON.stringify(user)).join(',\n') + ']';
fs.writeFileSync(usersFile, output, 'utf8');
console.log(`用户数据已更新！共 ${newUsers.length} 个用户`);
