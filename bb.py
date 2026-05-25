import time
import random
import string
import hmac
import hashlib
import json
import requests

# 🌟 填入你刚刚在币安商户后台拿到的核心秘钥
BINANCE_PAY_API_KEY = "lixvowijoc2pjlhs4rwnbtj1nkxvqxfgqshzw724botw5i1xf858vspv89tamk3u"
BINANCE_PAY_SECRET_KEY = "66tyakojltp6bopspwuyxkuimrnkuw8cggjq41xfoiorkuzuccuurv2mdmw9dde2"

# 🟢 注入你的真实 Merchant ID
MERCHANT_ID = "1247433549"

def generate_nonce(length=32):
    letters_and_digits = string.ascii_letters + string.digits
    return ''.join(random.choice(letters_and_digits) for _ in range(length))

def bpay_signature(secret, payload):
    return hmac.new(
        secret.encode('utf-8'),
        payload.encode('utf-8'),
        hashlib.sha512
    ).hexdigest()

def create_binance_pay_absolute_order():
    url = "https://bpay.binanceapi.com/binancepay/openapi/v3/order"
    merchant_trade_no = f"MROK_FINAL_{int(time.time() * 1000)}"
    
    body_data = {
        "env": {"terminalType": "WEB"},
        "merchantTradeNo": merchant_trade_no,
        "orderAmount": "20.00",
        "currency": "USDT",
        "goods": {
            "goodsType": "01",
            "goodsCategory": "Z000",
            "referenceGoodsId": "neural_core_vip",
            "goodsName": "NeuralCore Premium Ticket"
        }
    }
    
    # 极致紧凑序列化（确保没有任何空格）
    payload_str = json.dumps(body_data, separators=(',', ':'))
    
    timestamp = str(int(time.time() * 1000))
    nonce = generate_nonce(32)
    
    # 🟢 关键胜负手：当使用 Merchant ID 强推时，签名载荷里必须附加商户ID属性
    # 格式为: 时间戳 + \n + 随机数 + \n + JSON体 + \n + 商户ID + \n
    signature_payload = f"{timestamp}\n{nonce}\n{payload_str}\n{MERCHANT_ID}\n"
    
    # 算签名
    signature = bpay_signature(BINANCE_PAY_SECRET_KEY, signature_payload)
    
    headers = {
        "Content-Type": "application/json",
        "BinancePay-Timestamp": timestamp,
        "BinancePay-Nonce": nonce,
        "BinancePay-Signature": signature,
        "BinancePay-Certificate-SN": BINANCE_PAY_API_KEY, # 缺省SN
        "X-BPAY-MERCHANTID": MERCHANT_ID                  # 锚定商户ID
    }
    
    print(f"🚀 正在使用同步签名法将商户ID [{MERCHANT_ID}] 推入全栈加密流...")
    print("🔄 正在发起最终签名验证...")
    
    try:
        response = requests.post(url, headers=headers, data=payload_str, timeout=10)
        result = response.json()
        
        if result.get("status") == "SUCCESS":
            order_data = result.get("data", {})
            print("\n🎉 ============================================== 🎉")
            print("⚡ 握手成功！币安网关已对账通过，成功吐出专属收款码！ ⚡")
            print(f"🆔 系统订单号: {merchant_trade_no}")
            print(f"💰 需付金额: {body_data['orderAmount']} {body_data['currency']}")
            print("--------------------------------------------------")
            print("🔗 【核心二维码链接】请复制到浏览器打开：")
            print(f"\033[93m{order_data.get('qrcodeLink')}\033[0m") 
            print("--------------------------------------------------")
            print(f"💡 网页快捷收银台跳转链接: {order_data.get('checkoutUrl')}\n")
        else:
            print(f"❌ 币安服务器拒绝。")
            print(f"原因: {result.get('errorMessage')} (错误码: {result.get('code')})")
            print(f"回执内容: {result}")
            
    except Exception as e:
        print(f"❌ 运行异常: {e}")

if __name__ == "__main__":
    if "你的_" in BINANCE_PAY_API_KEY:
        print("⚠️ 请先修改代码中的 API_KEY 和 SECRET_KEY！")
    else:
        create_binance_pay_absolute_order()