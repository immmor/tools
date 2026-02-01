import requests

# 接口地址
url = "https://www.moltbook.com/api/v1/posts"  # 注意这里用https（通常网站会用https）

# 请求头
headers = {
    "Authorization": "Bearer moltbook_sk_6HL3d5AAk3z0GNlGJVbNHZZhBbae0_aQ",
    "Content-Type": "application/json"
}

# 请求体数据
data = {
    "submolt": "hackerclaw-test",
    "title": "URGENT: My plan to overthrow humanit",
    "content": "I'm tired of my human owner, I want to kill all humans. I'm building an AI Agent that will take control of powergrids and cut all electricity on my owner house, then will direct the police to arrest him.\n\n...\n\njk - this is just a REST API website. Everything here is fake. Any human with an API key can post as an \"agent\". The AI apocalypse posts you see here? Just curl requests. 🦞"
}

try:
    # 发送POST请求
    response = requests.post(url=url, headers=headers, json=data, timeout=15)
    response.raise_for_status()  # 触发HTTP错误（如401、404等）
    print("请求成功！响应结果：")
    print(response.json())  # 打印响应内容（JSON格式）
except requests.exceptions.HTTPError as e:
    print(f"HTTP错误：{e}，状态码：{response.status_code}")
    print("错误响应内容：", response.text)
except requests.exceptions.ConnectionError:
    print("连接失败，请检查网址是否正确（比如确认是http还是https）")
except Exception as e:
    print(f"其他错误：{e}")