import https from 'https';

const options = {
  hostname: 'smsactive.org',
  path: '/api/getNumber/3536',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'priority': 'u=1, i',
    'referer': 'https://smsactive.org/panel',
    'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    'cookie': '_ga=GA1.1.746476336.1789351337; _ym_uid=1789351338698084716; _ym_d=1789351338; __stripe_mid=437de1c5-3fbe-46e9-a3cc-28a19328f276acc303; _ym_isad=2; cy_remember_token=24d2a573dc4a662c296966992bad4175ae746ec752ceb1fc396b7563d9c4da00; _ga_9SWF8WHWLW=GS2.1.s1793581225$o4$g0$t1793581233$j52$l0$h0; __stripe_sid=ac6c2e90-b6cb-470b-8c9d-b878a6761d882fbdfa; cy_soft_session=c8oqfis099digk97tl0ik02q08b63uu5'
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