export default {
  async fetch(request, env, ctx) {
    // 允许跨域（音频播放必备）
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "Range",
    };

    // 处理 OPTIONS 预检请求
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // 仅处理 GET/HEAD 请求
    if (!["GET", "HEAD"].includes(request.method)) {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
      // 1. 获取音频文件名（示例：从请求路径提取，如 /audio/song.mp3）
      const url = new URL(request.url);
      const audioFileName = url.pathname.slice(1); // 去掉开头的 /
      if (!audioFileName) {
        return new Response("请指定音频文件路径，如 /song.mp3", { status: 400, headers: corsHeaders });
      }

      // 2. 从 R2 存储桶获取音频文件元信息
      const object = await env.AUDIO_BUCKET.head(audioFileName);
      if (!object) {
        return new Response("音频文件不存在", { status: 404, headers: corsHeaders });
      }
      const fileSize = object.size;
      const mimeType = object.httpMetadata?.contentType || "audio/mpeg"; // 默认 MP3 类型

      // 3. 解析 Range 请求头（处理分片请求）
      const rangeHeader = request.headers.get("Range");
      let start = 0;
      let end = fileSize - 1;

      if (rangeHeader) {
        // 解析 Range 格式：bytes=0-1024
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (!rangeMatch) {
          // 不合法的 Range，返回 416 状态码
          return new Response("Range Not Satisfiable", {
            status: 416,
            headers: {
              ...corsHeaders,
              "Content-Range": `bytes */${fileSize}`,
            },
          });
        }

        start = parseInt(rangeMatch[1], 10);
        end = rangeMatch[2] ? parseInt(rangeMatch[2], 10) : fileSize - 1;
        // 确保 end 不超过文件大小
        end = Math.min(end, fileSize - 1);
      }

      // 4. 计算分片长度
      const chunkSize = end - start + 1;

      // 5. 从 R2 读取指定范围的音频片段
      const audioChunk = await env.AUDIO_BUCKET.get(audioFileName, {
        range: { start, end },
      });
      if (!audioChunk) {
        return new Response("读取音频片段失败", { status: 500, headers: corsHeaders });
      }

      // 6. 构造响应头
      const responseHeaders = {
        ...corsHeaders,
        "Content-Type": mimeType,
        "Accept-Ranges": "bytes", // 告知客户端支持范围请求
        "Content-Length": chunkSize.toString(),
      };

      // 如果是分片请求，添加 Content-Range 头
      if (rangeHeader) {
        responseHeaders["Content-Range"] = `bytes ${start}-${end}/${fileSize}`;
      }

      // 7. 流式返回音频片段（核心：逐段推送）
      return new Response(audioChunk.body, {
        status: rangeHeader ? 206 : 200, // 206 = 部分内容，200 = 完整内容
        headers: responseHeaders,
      });
    } catch (error) {
      console.error("音频推送失败：", error);
      return new Response("服务器内部错误", { status: 500, headers: corsHeaders });
    }
  },
};