import https from 'https';

const options = {
  hostname: 'moniu.top',
  path: '/user/api/index/commodity?categoryId=3',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'priority': 'u=1, i',
    'referer': 'https://moniu.top/',
    'sec-ch-ua': '"Not:A-Brand";v="8", "Chromium";v="156", "Google Chrome";v="156"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/156.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': 'server_name_session=ecf4bc255c9802439c60a5749ec2396c'
  }
};

const MAX_RETRY = 3;

function fetch(retry = 0) {
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

  req.on('error', function (err) {
    if (retry < MAX_RETRY) {
      console.error(`请求出错（${err.code}），第 ${retry + 1} 次重试...`);
      fetch(retry + 1);
    } else {
      console.error('重试次数已用尽，请求失败：', err.message);
    }
  });
}

fetch();
