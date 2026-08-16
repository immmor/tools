const https = require('https');

function translateYoudao(word) {
  // 构建 URL（通过 urlencode 处理中文或空格）
  const encodedWord = encodeURIComponent(word);
  const url = `https://dict.youdao.com/suggest?num=1&ver=3.0&doctype=json&cache=false&le=en&q=${encodedWord}`;

  const options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  https.get(url, options, (res) => {
    let data = '';

    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        console.log('完整响应:', JSON.stringify(json, null, 2));

        // 提取释义
        if (json.data && json.data.entries && json.data.entries.length > 0) {
          const result = json.data.entries[0];
          console.log(`\n查询文本: ${result.entry}`);
          console.log(`翻译/释义: ${result.explain}`);
        } else {
          console.log('未查到相关翻译');
        }
      } catch (err) {
        console.error('解析 JSON 失败:', err.message);
      }
    });

  }).on('error', (err) => {
    console.error('请求失败:', err.message);
  });
}

// 调用测试
translateYoudao('hello');