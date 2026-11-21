import https from 'https';

const options = {
  hostname: 'www.toutiao.com',
  path: '/api/pc/list/feed?channel_id=3189398999&min_behot_time=0&offset=0&refresh_count=1&category=pc_profile_channel&client_extra_params=%7B%22short_video_item%22%3A%22filter%22%7D&aid=24&app_name=toutiao_web&msToken=GbYrpFqW4Ge-G1JqONRQv7M1ifRk5LSlSK1pY83EBat3idIOyT0GYDsi7aUL8rmBtRwc5aYXvvE1s0d69CyHxpkunE9JYdWXY-89HKHqKF49JLf62XYwOw%3D%3D&a_bogus=xjWM%2FQz6mEfN6DSZ51oLfY3qVvF3Y2t20t9bMDhqhn3yky39HMTH9exE5oGvreRjF4%2FJIemjy4hbTpcprQQJ0Hwf98vx%2F25ZQfSkKl12some-pinegsgrUvq-hs1SeA25kp-EKigq7lHFbbhAnAJ4hc4bfaSYrG0wrgECiqL13fI7f%3D%3D',
  headers: {
    'accept': 'application/json, text/plain, */*',
    'accept-language': 'zh-CN,zh;q=0.9',
    'priority': 'u=1, i',
    'referer': 'https://www.toutiao.com/',
    'sec-ch-ua': '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'empty',
    'sec-fetch-mode': 'cors',
    'sec-fetch-site': 'same-origin',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
    'cookie': 'csrftoken=c2df2b3229f628116dc54c56a22d1d4d; _ga=GA1.1.64500559.1730985036; tt_webid=7655382872085513771; s_v_web_id=verify_mudgxpvg_g36SMur2_zaoe_4GR2_AGYW_rswEs8CfTsEr; gfkadpd=24,6457; local_city_cache=%E5%8C%97%E4%BA%AC; __feed_out_channel_key=world; _ga_QEHZPBE5HH=GS2.1.s1795248796$o19$g1$t1795249359$j11$l0$h0; ttwid=1%7CJhgkY0Xj0qeKRdBlmJUczwliCs-YhytW46jRIT9yK_M%7C1795249359%7C9ee301aa8c1d0e37ea88378e8f93dc888a300433ccab4438c8e33dcde3570485; tt_scid=ONFJJk8b7f-8F7jtNxRkcegkP9D1xahEVa3gMhsmLwHFq2v5Ea2HgU0KQSnB5RBXae54'
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