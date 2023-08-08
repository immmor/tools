def trans_youdao(transContent: str):
    import requests
    data = {
        'doctype': 'json', 
        'type': 'auto',
        'i': transContent
    }
    r = requests.get("http://fanyi.youdao.com/translate",params=data)
    result = r.json()['translateResult'][0][0]['tgt']
    print(result)
    return result
