import https from 'https';

const options = {
  hostname: 'talangya.com',
  path: '/user/api/authentication/login',
  method: 'POST',
  headers: {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'zh-CN,zh;q=0.9',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://talangya.com',
    'priority': 'u=1, i',
    'referer': 'https://talangya.com/',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': 'ACG-SHOP=d4tuugthg3i49cj66fqnfo48p4'
  }
};

const req = https.request(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const body = Buffer.concat(chunks);
    console.log('=== 响应体 ===');
    console.log(body.toString());

    console.log('\n=== 响应头中的 Cookie ===');
    const setCookie = res.headers['set-cookie'];
    if (setCookie && setCookie.length) {
      setCookie.forEach(function (c, i) {
        console.log(`[${i}] ${c}`);
      });
      // 提取 name=value 部分，方便直接使用
      const cookies = setCookie.map(function (c) { return c.split(';')[0]; });
      const cookieStr = cookies.join('; ');
      console.log('\n=== 合并后的 Cookie 字符串 ===');
      console.log(cookieStr);
    } else {
      console.log('（无 set-cookie）');
    }
  });
});

req.write(new URLSearchParams({
  'username': 'immmor@foxmail.com',
  'password': 'Wang123.',
  'remember': '1'
}).toString());
req.end();