
// 注意：这段代码需要在支持 Fetch API 的环境中运行，例如浏览器或新的 Node.js 环境。

console.log("开始使用 Fetch API 请求百度...");

fetch('https://www.baidu.com')
    // 1. 检查响应是否成功
    .then(response => {
        if (!response.ok) {
            // 如果HTTP状态码不是2xx，则抛出错误
            throw new Error(`HTTP 错误！状态码: ${response.status}`);
        }
        // 2. 将响应体解析为纯文本 (因为百度返回的是HTML)
        return response.text(); 
    })
    // 3. 处理返回的数据
    .then(data => {
        console.log('请求成功！返回的数据摘要 (前300字符):');
        // 只打印数据的前300个字符，避免输出过多内容
        console.log(data.substring(0, 300) + '...');
    })
    // 4. 捕获任何网络或解析错误
    .catch(error => {
        console.error('请求发生错误:', error);
    });
