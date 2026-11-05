import https from 'https';

const options = {
  hostname: 'm.ryyqf.cc',
  path: '/h5/goods/cat/lists',
  method: 'POST',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'captchatoken': '',
    'content-type': 'application/json',
    'origin': 'https://m.ryyqf.cc',
    'priority': 'u=1, i',
    'referer': 'https://m.ryyqf.cc/',
    'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36'
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

req.write(JSON.stringify({
  'payload': 'bf/YCOh8YdZunGjckblI8/AGPvFm09oJG2MMgiSzpxQrqIQDCLlY7tHJXwdVvagHJ5WWQk/Vmf9svMaiuV1obq3jlxu1BL2tbxbRxzsz2KU='
}));
req.end();