import hashlib
import time
import requests
import json

class YoudaoLongTextTranslator:
    def __init__(self):
        # 使用更稳定的 Web 端标准翻译接口
        self.url = "https://dict.youdao.com/webtranslate"
        self.headers = {
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://fanyi.youdao.com/",
            "Origin": "https://fanyi.youdao.com",
            "Host": "dict.youdao.com"
        }

    def _generate_sign(self, mystic_time, secret_key="fsdsogkndgtng1no76tsg9"):
        """
        最新标准：有道 Web 端长文本签名的精确拼接逻辑
        """
        client = "fanyideskweb"
        product = "webtranslate"
        
        # 严格按此顺序拼接：client, mysticTime, product, key
        sign_str = f"client={client}&mysticTime={mystic_time}&product={product}&key={secret_key}"
        
        md5 = hashlib.md5()
        md5.update(sign_str.encode('utf-8'))
        return md5.hexdigest()

    def _filter_result(self, raw_data):
        """
        解析和清洗长文本返回的数据结构
        """
        if not isinstance(raw_data, dict):
            return {"error": "返回格式非合法JSON"}
            
        # 检查是否依然触发风控或错误
        if raw_data.get("code") != 0 and "translateResult" not in raw_data:
            return {"error": f"有道接口返回错误码: {raw_data.get('code', raw_data)}"}

        translate_result = raw_data.get("translateResult", [])
        if not translate_result and "data" in raw_data:
            # 兼容部分直接包裹在 data 内部的结构
            translate_result = raw_data.get("data", {}).get("translateResult", [])

        if not translate_result:
            return {"error": "未能从响应中提取到有效翻译段落"}

        # 清洗并拼接多段落长文本
        translated_paragraphs = []
        for paragraph in translate_result:
            paragraph_text = "".join([sentence.get("tgt", "") for sentence in paragraph if sentence.get("tgt")])
            if paragraph_text:
                translated_paragraphs.append(paragraph_text)

        return {"translation": "\n".join(translated_paragraphs)}

    def translate(self, text, from_lang="auto", to_lang="auto"):
        if not text.strip():
            return {"error": "输入文本不能为空"}

        # 1. 必须使用 13 位字符串型时间戳
        mystic_time = str(int(time.time() * 1000))
        
        # 2. 生成最新签名
        sign = self._generate_sign(mystic_time)

        # 3. 构造长文本必备的 Form Data 载荷
        data = {
            "i": text,
            "from": from_lang,
            "to": to_lang,
            "dictResult": "true",
            "keyfrom": "fanyi.web",
            "client": "fanyideskweb",
            "product": "webtranslate",
            "sign": sign,
            "mysticTime": mystic_time
        }

        # 4. 补充混淆 Cookie 防御 50 错误
        headers = self.headers.copy()
        headers["Cookie"] = f"OUTFOX_SEARCH_USER_ID=-{int(time.time())}@10.0.0.1; OUTFOX_SEARCH_USER_ID_NCOO={int(time.time() * 10)};"

        try:
            response = requests.post(self.url, data=data, headers=headers, timeout=10)
            
            if response.status_code == 200:
                # 有些长文本接口返回的是一段纯加密密文(Base64格式)，有些是直接的JSON
                try:
                    raw_json = response.json()
                    return self._filter_result(raw_json)
                except json.JSONDecodeError:
                    # 如果抓包发现返回的是一串乱码/密文，说明触发了有道的 AES 密文传输逻辑
                    return {"error": "接口返回了 AES 加密密文，需要结合解密密钥进行二次解密。"}
            else:
                return {"error": f"请求失败，HTTP 状态码: {response.status_code}"}
        except Exception as e:
            return {"error": f"网络请求异常: {str(e)}"}


# --- 测试运行 ---
if __name__ == "__main__":
    translator = YoudaoLongTextTranslator()
    
    test_text = (
        "Hello world. This is a robust integration test for long text translation.\n"
        "Hope the errorCode 50 has been successfully resolved now."
    )
    
    print("--- 重新尝试长文本翻译 ---")
    res = translator.translate(test_text, from_lang="en", to_lang="zh-CHS")
    
    if "error" in res:
        print(f"❌ 依然失败: {res['error']}")
        print("\n💡 提示: 如果依然报 50 错误，请打开浏览器 F12，在任意翻译请求的 Payload 中查看当前的 'key' 混淆字符串是否已更新，并替换代码中第 18 行的 secret_key。")
    else:
        print("✅ 翻译成功！过滤后的干净结果：")
        print("-" * 40)
        print(res["translation"])
        print("-" * 40)