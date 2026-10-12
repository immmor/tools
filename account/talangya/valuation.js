import https from 'https';

const options = {
  hostname: 'talangya.com',
  path: '/user/api/index/valuation',
  method: 'POST',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://talangya.com',
    'priority': 'u=1, i',
    'referer': 'https://talangya.com/',
    'sec-ch-ua': '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': 'ACG-SHOP=l9hhhl05jctiudp28lqm8ae4is; USER_SESSION=ZXlKMGVYQWlPaUpLVjFRaUxDSjFhV1FpT2pNNU16QXdMQ0poYkdjaU9pSklVekkxTmlKOS5leUpsZUhCcGNtVWlPakU0TWpNek1EVTJNelFzSW14dloybHVWR2x0WlNJNklqSXdNall0TVRBdE1USWdNRGs2TkRjNk1UUWlmUS5xMjAzbHN2VTZ1Q0JFVnpQbWJUYjAxX0ZZMUYweFVXQnJyRDZ6ZllOU1d3'
  }
};

const req = https.request(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.write(new URLSearchParams({
  'item_id': '3485',
  'num': '1',
  'card_id': '0',
  'coupon': '',
  'race': ''
}).toString());
req.end();