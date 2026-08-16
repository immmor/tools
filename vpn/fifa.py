import requests

url = "https://dict.youdao.com/suggest?num=1&ver=3.0&doctype=json&cache=false&le=en&q=hello"
response = requests.get(url)
print(response.json())