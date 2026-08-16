// translate.js
async function translateSentence(text, targetLang = 'zh-CN') {
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const data = await response.json();
    const translation = data[0].map(item => item[0]).join('');
    
    console.log('原文:', text);
    console.log('译文:', translation);
  } catch (error) {
    console.error('请求失败:', error.message);
  }
}

translateSentence('Artificial intelligence is replacing repetitive daily tasks rapidly across various industries.');