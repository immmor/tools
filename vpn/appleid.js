import https from 'https';

const options = {
  hostname: 'pifaid.com',
  path: '/api/v1/public/products?page=1&page_size=20',
  headers: {
    'accept': '*/*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'priority': 'u=1, i',
    'referer': 'https://pifaid.com/',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'x-lang': 'zh-CN',
    'cookie': 'crisp-client%2Fsession%2Fada49f51-3f30-4b83-950d-b4dd84d9d00d=session_443af688-e3d2-4866-a0b2-5cb1d4a926a1; server_session_daffc2af=e2c746e9138a8d20ea09ea963ab805ad'
  }
};

const req = https.get(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const body = Buffer.concat(chunks).toString();
    let data;
    try {
      data = JSON.parse(body);
    } catch (e) {
      console.error('JSON 解析失败：', e.message);
      console.log(body);
      return;
    }
    // 重新序列化为带缩进的 JSON，并把被转义的尖括号/& 还原成真正的字符
    const json = JSON.stringify(data, null, 2)
      .replace(/\\u003c/g, '<')
      .replace(/\\u003e/g, '>')
      .replace(/\\u0026/g, '&');
    console.log(json);
  });
});