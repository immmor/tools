import https from 'https';
import fs from 'fs';

const options = {
  hostname: 'www.toutiao.com',
  path: '/api/pc/list/feed?channel_id=3189399007&min_behot_time=0&offset=0&refresh_count=1&category=pc_profile_channel&client_extra_params=%7B%22short_video_item%22%3A%22filter%22%7D&aid=24&app_name=toutiao_web&msToken=9EeMl_vsoGXXWwNzUqEJ0qTsw1x0gKtsrK3I91csEZYfmKJqFHJ_NWCX2WklZ8CnaIyq_-VSxtVB_CfRKxVeBsclXxlJBhhRnT33ZXGexkjNabIT2smlbIXsbcxBSaM%3D&a_bogus=xXWMBVufdEfThD6V51QLfY3qV433Y2C10t9bMDhqMx3yZL39HMON9exER-tv7x8jF4%2FJIemjy4hbTpcprQVbMZwf98vx%2F25ZQfSkKl12soDC-Nije6kgrUvq-hs1SeA25kp-EKigq7lHFbbhAnAJ-7nXbfaSYrG0wrgECiqL13fIWE%3D%3D',
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
    // 'cookie': 'csrftoken=c2df2b3229f628116dc54c56a22d1d4d; _ga=GA1.1.64500559.1730985036; tt_webid=7655382872085513771; __feed_out_channel_key=sports; s_v_web_id=verify_mudgxpvg_g36SMur2_zaoe_4GR2_AGYW_rswEs8CfTsEr; gfkadpd=24,6457; local_city_cache=%E5%8C%97%E4%BA%AC; _ga_QEHZPBE5HH=GS2.1.s1795142902$o17$g1$t1795142927$j35$l0$h0; ttwid=1%7CJhgkY0Xj0qeKRdBlmJUczwliCs-YhytW46jRIT9yK_M%7C1795142927%7C566df458bbae213b43d8786d0c9b72315e3fcffe46accd286693da99994449ea; tt_scid=IfNnZR0iqbOfq5mwYV7wGybHyUdbFGgDLIANY5YRimGNlx0StfRMJssxfcdSHY--79c9'
  }
};

const req = https.get(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const body = Buffer.concat(chunks).toString();
    fs.writeFileSync(new URL('./tou_econ.json', import.meta.url), body);
    console.log('saved tou_econ.json');
  });
});