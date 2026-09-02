import https from 'https';

const options = {
  hostname: 'ikuuu.win',
  path: '/auth/login',
  method: 'POST',
  headers: {
    'accept': 'application/json, text/javascript, */*; q=0.01',
    'accept-language': 'zh-CN,zh;q=0.9',
    'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
    'origin': 'https://ikuuu.win',
    'priority': 'u=1, i',
    'referer': 'https://ikuuu.win/auth/login',
    'sec-ch-ua': '"Not=A?Brand";v="99", "Google Chrome";v="151", "Chromium";v="151"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36',
    'x-requested-with': 'XMLHttpRequest',
    'cookie': 'PHPSESSID=dv5vbpjbkq60vcs1f41nfqklrm; ip=ffc1c3e333da05682a5b768396671eec; expire_in=1788053303; _gid=GA1.2.1891777297.1787966904; _gat_gtag_UA_158605448_1=1; _ga=GA1.1.1442495420.1783545398; _ga_8HVN7928SC=GS2.1.s1787966903$o23$g1$t1787966983$j56$l0$h0'
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
  'host': 'ikuuu.win',
  'phase': 'password',
  'captcha_result[lot_number]': '4e2ae9d5d97f4fe8b7d800b272b40733',
  'captcha_result[captcha_output]': '7quRQ-2vEgT9AbowjPh7oFxPyRyKLGa1F12LM6ZGIsc6O6YpyKxW6YKSKmC_372gbZlm7_ugEBLqmdZYGUyJDlDv0sphz92Vjf7a_mkKLQCmFaDAcqYPBCUpYv8I35PqqtfbA0PTT7yjPsOL3B9LfuFACevJPpJ6rAxnK6Ntj8vlC_hHAzc6_1UMoAEHz-Tqwq6deLJNv0WfZpmq-0XMu3CFG1ebOsNytnPwZhhga1mwef0lw_LGnDMcqobZxFoQMdiA8XdVkJhdiM_pmZ2EuFJ0tCxntYW9Y_YhmHZzt5EaBKtaDcGI9m3jxoODfZy1PUD2z6VEPvPK4YvV7nvHlXMYY-Xdy-ZqWndjHrko40vDPI5TnPfkD6HheFjuMns9IIMEDJ4XgDCFExaf_FW6Lwlhc8ojHbkNHjwqG0upvvuMbNoUMb28dEohGzeT5Q1wzv7FMp-QWJPXJs401TFT0w==',
  'captcha_result[pass_token]': '174f9652386311958cce47f0b59672fb0bc03bde17d4b63ed7bdb4d83476d515',
  'captcha_result[gen_time]': '1787966984',
  'email': 'yhhoujdi3@hotmail.com',
  'passwd': 'xzk875817',
  'pageLoadedAt': '1787966983671'
}).toString());
req.end();