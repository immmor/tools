import https from 'https';

const options = {
  hostname: 'smsactive.org',
  path: '/login',
  method: 'POST',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://smsactive.org',
    'priority': 'u=1, i',
    'referer': 'https://smsactive.org/index.php/',
    'sec-ch-ua': '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': '_ga=GA1.1.746476336.1789351337; _ym_uid=1789351338698084716; _ym_d=1789351338; __stripe_mid=437de1c5-3fbe-46e9-a3cc-28a19328f276acc303; __stripe_sid=9c7ffe07-cbbb-413c-acc0-f626579983f7f1027b; _ym_isad=2; cy_soft_session=jj6qg4qbdengu1v4jnnr48ga95nhhv2m; _ga_9SWF8WHWLW=GS2.1.s1791787623$o3$g1$t1791787703$j58$l0$h0'
  }
};

// ponytail: 登录POST不下发cookie；只有登录后直接GET panel才会拿到续期set-cookie
const req = https.request(options, function (res) {
  console.log(`${res.statusCode} /login`);
  res.resume();
  res.on('end', function () {
    https.get({
      hostname: 'smsactive.org',
      path: '/index.php/panel',
      headers: options.headers
    }, function (res2) {
      console.log(`${res2.statusCode} /panel  set-cookie:`, res2.headers['set-cookie']);
      const chunks = [];
      res2.on('data', function (c) { chunks.push(c); });
      res2.on('end', function () {
        const html = Buffer.concat(chunks).toString();
        console.log('logged in:', html.includes('ninenine000099'));
      });
    });
  });
});

req.write(new URLSearchParams({
  'emailInput': 'ninenine000099@gmail.com',
  'passwordInput': 'Wang123.'
}).toString());
req.end();
