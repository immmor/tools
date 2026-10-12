import https from 'https';

const options = {
  hostname: 'smsactive.org',
  path: '/api/getNumber/2957',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'priority': 'u=1, i',
    'referer': 'https://smsactive.org/panel',
    'sec-ch-ua': '"Chromium";v="154", "Google Chrome";v="154", "Not A(Brand";v="99"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36',
    'cookie': '_ga=GA1.1.746476336.1789351337; _ym_uid=1789351338698084716; _ym_d=1789351338; __stripe_mid=437de1c5-3fbe-46e9-a3cc-28a19328f276acc303; _ga_9SWF8WHWLW=GS2.1.s1791776347$o2$g1$t1791776375$j32$l0$h0; __stripe_sid=9c7ffe07-cbbb-413c-acc0-f626579983f7f1027b; cy_soft_session=m9mdvs6lp5kbgu5gv7igijkir3o5qjp9'
  }
};

const req = https.get(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});