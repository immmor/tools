import hashlib
import time
import requests


class YoudaoTranslator:

    def __init__(self):
        self.url = "https://dict.youdao.com/jsonapi_s"
        self.headers = {
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0"
                " Safari/537.36"
            ),
            "Referer": "https://dict.youdao.com/",
            "Origin": "https://dict.youdao.com",
        }

    def _generate_sign(self):
        """生成有道接口所需的加密参数 sign 和 mysticTime"""
        mystic_time = str(int(time.time() * 1000))
        client = "fanyideskweb"
        product = "webtranslate"

        # 核心混淆密钥，若接口报错签名错误，需在有道前端 JS 中查找最新 Key 替换此处
        secret_key = "fsdsogkndgtng1no76tsg9"

        # 拼接签名字符串并计算 MD5
        sign_str = f"client={client}&mysticTime={mystic_time}&product={product}&key={secret_key}"
        md5 = hashlib.md5()
        md5.update(sign_str.encode("utf-8"))
        sign = md5.hexdigest()

        return sign, mystic_time

    def _filter_result(self, raw_data):
        """核心过滤逻辑：剔除加密块、例句等杂质，只保留直接翻译"""
        if not isinstance(raw_data, dict):
            return {"error": "返回数据格式异常"}

        cleaned = {"word": "Unknown", "basic_trans": [], "phrase_trans": []}

        # 1. 提取词条原型
        individual = raw_data.get("individual", {})
        cleaned["word"] = individual.get("return-phrase", "") or raw_data.get(
            "ee", {}
        ).get("word", {}).get("return-phrase", "Unknown")

        # 2. 过滤提取基础词性与字面翻译
        if "trs" in individual:
            for item in individual["trs"]:
                pos = item.get("pos", "")  # 词性 (如 vt. / n.)
                tran = item.get("tran", "")  # 翻译文本
                if tran:
                    cleaned["basic_trans"].append(f"{pos} {tran}")

        # 3. 过滤提取常用词组与网络释义
        web_trans = raw_data.get("web_trans", {}).get("web-translation", [])
        for item in web_trans:
            phrase = item.get("key", "")
            trans_values = [
                t.get("value", "")
                for t in item.get("trans", [])
                if t.get("value")
            ]
            if phrase and trans_values:
                cleaned["phrase_trans"].append(
                    {"phrase": phrase, "translations": trans_values}
                )

        return cleaned

    def translate(self, word):
        """外部调用主函数"""
        sign, mystic_time = self._generate_sign()

        # URL 固定的 Query 参数
        params = {"doctype": "json", "jsonversion": "4"}

        # 表单提交数据
        data = {
            "q": word,
            "le": "en",
            "client": "fanyideskweb",
            "product": "webtranslate",
            "sign": sign,
            "mysticTime": mystic_time,
            "keyfrom": "fanyi.web",
        }

        # 动态伪造 Cookie 防止触发部分风控
        headers = self.headers.copy()
        headers["Cookie"] = (
            f"OUTFOX_SEARCH_USER_ID=-123456789@10.0.0.1; "
            f"OUTFOX_SEARCH_USER_ID_NCOO={int(time.time())};"
        )

        try:
            # 发送 POST 请求获取原始杂乱数据
            response = requests.post(
                self.url, params=params, data=data, headers=headers, timeout=10
            )

            if response.status_code == 200:
                raw_json = response.json()
                # 喂给清洗过滤器，直接返回干净数据
                return self._filter_result(raw_json)
            else:
                return {"error": f"接口请求失败，状态码: {response.status_code}"}
        except Exception as e:
            return {"error": f"网络或解析异常: {str(e)}"}


# --- 演示调用 ---
if __name__ == "__main__":
    translator = YoudaoTranslator()

    # 测试查词
    search_word = """
    这里为您整合一套完整的、开箱即用的 Python 脚本。

代码将前面分析的加密参数生成逻辑、网络请求以及数据清洗过滤完美结合。你只需要直接运行它，就能输入单词并拿到干净的翻译结果。
    """
    result = translator.translate(search_word)

    # 优雅优雅地打印过滤后的清爽结果
    if "error" in result:
        print(f"失败: {result['error']}")
    else:
        print(f"【查询词条】: {result['word']}")
        print("-" * 30)

        print("【核心字面释义】:")
        if result["basic_trans"]:
            for trans in result["basic_trans"]:
                print(f"  - {trans}")
        else:
            print("  暂无直接释义")

        print("\n【常用词组 / 网络短语】:")
        if result["phrase_trans"]:
            for item in result["phrase_trans"]:
                ph = item["phrase"]
                tl = ", ".join(item["translations"])
                print(f"  - {ph} : {tl}")
        else:
            print("  暂无相关短语")