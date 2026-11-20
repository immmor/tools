import https from 'https';

const options = {
  hostname: 'www.toutiao.com',
  path: '/',
  headers: {
    'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/jxl,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
    'accept-language': 'zh-CN,zh;q=0.9',
    'cache-control': 'max-age=0',
    'priority': 'u=0, i',
    'referer': 'https://www.bing.com/',
    'sec-ch-ua': '"Chromium";v="158", "Not.A/Brand";v="24", "Google Chrome";v="158"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"macOS"',
    'sec-fetch-dest': 'document',
    'sec-fetch-mode': 'navigate',
    'sec-fetch-site': 'cross-site',
    'sec-fetch-user': '?1',
    'upgrade-insecure-requests': '1',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36',
    'cookie': 'csrftoken=c2df2b3229f628116dc54c56a22d1d4d; _ga=GA1.1.64500559.1730985036; tt_webid=7655382872085513771; __feed_out_channel_key=sports; s_v_web_id=verify_mudgxpvg_g36SMur2_zaoe_4GR2_AGYW_rswEs8CfTsEr; gfkadpd=24,6457; tt_scid=cua64StQYgeCgNeQ5IKkKDgt5dzIOfk.kShoBhbyrfrI2p3IRLRscHXf.9w6nmqX1db7; local_city_cache=%E5%8C%97%E4%BA%AC; ttwid=1%7CJhgkY0Xj0qeKRdBlmJUczwliCs-YhytW46jRIT9yK_M%7C1795142901%7C4e13196d3cef3e0ca4cdcb63bd98561687334771ed21159980457e29ce11acec; _ga_QEHZPBE5HH=GS2.1.s1795142902$o17$g0$t1795142902$j60$l0$h0'
  }
};

const req = https.get(options, function (res) {
  const chunks = [];

  res.on('data', function (chunk) {
    chunks.push(chunk);
  });

  res.on('end', function () {
    const html = Buffer.concat(chunks).toString();
    const matched = html.match(/<script id="RENDER_DATA" type="application\/json">([\s\S]*?)<\/script>/);
    if (!matched) {
      console.log('no RENDER_DATA found');
      return;
    }
    const list = JSON.parse(decodeURIComponent(matched[1])).data.initialFeedList;
    list.forEach((item, i) => {
      const title = (item.title ?? '').replace(/\s+/g, ' ').slice(0, 80);
      const meta = [item.source, `${item.comment_count ?? 0} 评论`, item.article_url]
        .filter(Boolean)
        .join(' · ');
      console.log(`${i + 1}. ${title}`);
      if (meta) console.log(`   ${meta}`);
    });
  });
});