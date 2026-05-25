import os
from binance.client import Client
from binance.exceptions import BinanceAPIException

# 1. 填入你在手机币安 App 上申请到的 API Key 和 Secret Key
API_KEY = 'l2Z62aYKmIU9jM8tsHt6kplvJy1SlpxMTDbaS9ND7OXBTm2nLhFBWLEO48ZMAubI'
API_SECRET = 'j7rDcCyGqozLMUR3nJtRYZbUT9FclLZaBw54xNEXCTYgVFJTONacgjjGSXqSE2LX'

client = Client(API_KEY, API_SECRET)

def check_deposit_status(target_tx_id=None, coin=None):
    """
    检查充值是否到账
    :param target_tx_id: 区块链上的交易哈希 (TxId)，推荐使用
    :param coin: 币种名称，如 'USDT', 'BTC' (可选，不传则查近期所有币种)
    """
    # 币安状态码字典映射
    STATUS_MAP = {
        0: "充值中 (Pending)",
        6: "已入账但无法提现 (Credited but cannot withdraw)",
        1: "成功到账 (Success)"
    }
    
    try:
        print("正在从币安获取充值历史记录...")
        # 如果指定了币种，传入 coin 参数可以缩小查询范围
        params = {}
        if coin:
            params['coin'] = coin.upper()
            
        # 获取充币历史列表
        deposit_history = client.get_deposit_history(**params)
        
        if not deposit_history:
            print("最近未查询到任何充值记录。")
            return

        # 遍历历史记录进行匹配
        found = False
        for record in deposit_history:
            tx_id = record.get('txId')
            record_coin = record.get('coin')
            amount = record.get('amount')
            status_code = record.get('status')
            status_desc = STATUS_MAP.get(status_code, f"未知状态码:{status_code}")
            insert_time = record.get('insertTime') # 毫秒级时间戳
            
            # 如果指定了 TxId，则进行精准匹配
            if target_tx_id and tx_id == target_tx_id:
                print(f"\n找到匹配的交易！")
                print(f"币种: {record_coin} | 数量: {amount}")
                print(f"交易状态: 【{status_desc}】")
                print(f"交易哈希 (TxId): {tx_id}")
                found = True
                break
            
            # 如果没有指定 TxId，只指定了币种，就列出该币种最近的记录
            elif not target_tx_id:
                print(f"币种: {record_coin} | 数量: {amount} | 状态: {status_desc} | TxId: {tx_id}")
                found = True
                
        if target_tx_id and not found:
            print(f"\n未能在近期充值记录中找到该 TxId: {target_tx_id}")
            print("提示：如果刚刚在链上发起转账，币安可能还没捕捉到区块确认，请等待1-2分钟后再试。")

    except BinanceAPIException as e:
        print(f"币安 API 错误: {e.message}")
    except Exception as e:
        print(f"发生未知错误: {e}")

if __name__ == "__main__":
    # 场景 A：已知链上转账的 TxId（哈希），精准查询是否到账
    MY_TXID = "这里替换成你在链上转账或钱包里复制的TxId"
    check_deposit_status(target_tx_id=MY_TXID)
    
    # 场景 B：不知道 TxId，只想看最近 USDT 的充值状态
    # check_deposit_status(coin="USDT")