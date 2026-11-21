import https from 'https';

const options = {
  hostname: 'www.toutiao.com',
  path: '/article/7709423876824744475/?log_from=dd91f64f60a788_1795249336491',
  headers: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'max-age=0',
    'priority': 'u=0, i',
    'referer': 'https://www.toutiao.com/',
    'sec-ch-ua': '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'same-origin',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
    'cookie': 'csrftoken=c2df2b3229f628116dc54c56a22d1d4d; _ga=GA1.1.64500559.1730985036; tt_webid=7655382872085513771; s_v_web_id=verify_mudgxpvg_g36SMur2_zaoe_4GR2_AGYW_rswEs8CfTsEr; gfkadpd=24,6457; local_city_cache=%E5%8C%97%E4%BA%AC; __feed_out_channel_key=world; ttwid=1%7CJhgkY0Xj0qeKRdBlmJUczwliCs-YhytW46jRIT9yK_M%7C1795249345%7C3b180afa747830fd070b36c2531399eef5c11a8ebf1e8fe7a8ac3bd028481309; tt_scid=ta5bWUUV8FEfpp58Q.NbCZPJo4My6nOtINDTXr6fjFLblyEAGbT1TdWARtf57lTCe4c4; _ga_QEHZPBE5HH=GS2.1.s1795248796$o19$g1$t1795249349$j21$l0$h0'
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