import os
import time
import random
import re
import requests
from bs4 import BeautifulSoup
from fake_useragent import UserAgent
from concurrent.futures import ThreadPoolExecutor, as_completed

# 1. 填入你测试成功的配置
cookies = {
    '_ga': 'GA1.1.786809494.1781431358',
    'IcYL_be21_saltkey': 't6IH1BLn',
    'IcYL_be21_lastvisit': '1781427757',
    'IcYL_be21_sid': 'Qb3hHh',
    'IcYL_be21_lastact': '1781431401%09get_uid_ajax.php%09',
    'PHPSESSID': '7fpc042tudngikv7p7j143qp5t',
    'marriage': '1',
    '_ga_Y85ZP1V3GW': 'GS2.1.s1781431357$o1$g1$t1781433126$j55$l0$h1064435083',
}

ua = UserAgent()

def get_headers(referer):
    return {
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'accept-language': 'zh-CN,zh;q=0.9',
        'cache-control': 'max-age=0',
        'referer': referer,
        'user-agent': ua.random, # 每次请求都伪装不同的浏览器
        'sec-ch-ua-platform': '"macOS"',
    }

def download_single_detail(detail_url, list_url, folder_name):
    """【线程任务】下载单个详情页"""
    # 线程启动时，故意错开一两百毫秒，防止并发洪峰
    time.sleep(random.uniform(0.1, 0.5))
    
    item_id_match = re.search(r'item-(\d+)', detail_url)
    item_id = item_id_match.group(1) if item_id_match else str(int(time.time() * 1000))
    filename = f'{folder_name}/detail_{item_id}.html'
    
    if os.path.exists(filename):
        return f"  skip ⏭️ {filename} 已存在"

    try:
        res = requests.get(detail_url, cookies=cookies, headers=get_headers(list_url), timeout=10)
        if res.status_code == 200 and "温馨提醒" not in res.text:
            with open(filename, 'w', encoding='utf-8') as f:
                f.write(res.text)
            return f"    ✅ 成功保存: {filename}"
        elif "温馨提醒" in res.text:
            return f"    ❌ {item_id} 失败: 触发了温馨提醒拦截！"
        else:
            return f"    ❌ {item_id} 失败: HTTP {res.status_code}"
    except Exception as e:
        return f"    ❌ {item_id} 异常: {e}"

def scrape_with_concurrent(start_page=1, end_page=3, max_workers=4):
    """
    主控程序：页码之间顺序，页码内部详情页并发
    max_workers: 并发线程数。推荐 3~5。太大容易被封 IP 或导致 Cookie 失效。
    """
    for page in range(start_page, end_page + 1):
        list_url = f'https://c.vanpeople.com/qzzhaopin/?page={page}'
        folder_name = f'page_{page}'
        os.makedirs(folder_name, exist_ok=True)
        
        print(f"\n⚡ ================= 正在并发处理第 {page} 页 (线程数: {max_workers}) =================")
        
        try:
            # 1. 顺序抓取当前的列表页
            res = requests.get(list_url, cookies=cookies, headers=get_headers('https://c.vanpeople.com/qzzhaopin/'), timeout=10)
            if res.status_code != 200 or "温馨提醒" in res.text:
                print(f"❌ 第 {page} 页列表请求失败或被拦截，跳过此页。")
                continue
                
            list_filename = f'{folder_name}/list_page_{page}.html'
            with open(list_filename, 'w', encoding='utf-8') as f:
                f.write(res.text)
            print(f"  ✅ 列表页已归档: {list_filename}")
                
            # 2. 解析出当前页所有的详情页 URL
            soup = BeautifulSoup(res.text, 'html.parser')
            all_links = soup.find_all('a', href=True)
            detail_urls = set()
            
            for link in all_links:
                href = link['href']
                if 'item-' in href and '.html' in href:
                    if href.startswith('//'):
                        full_url = f"https:{href}"
                    elif href.startswith('/'):
                        full_url = f"https://c.vanpeople.com{href}"
                    else:
                        full_url = href
                    detail_urls.add(full_url)
            
            print(f"  📊 找到 {len(detail_urls)} 个详情链接。开始多线程全速下载...")
            
            # 3. 【核心并发点】启动线程池并发下载这一页的所有详情
            start_time = time.time()
            with ThreadPoolExecutor(max_workers=max_workers) as executor:
                # 提交这一页所有的详情页下载任务
                futures = [
                    executor.submit(download_single_detail, d_url, list_url, folder_name) 
                    for d_url in detail_urls
                ]
                
                # 哪个线程先完工，就先打印哪个的结果
                for future in as_completed(futures):
                    print(future.result())
                    
            end_time = time.time()
            print(f"  ⏱️ 第 {page} 页内部详情并发完成！耗时: {end_time - start_time:.2f} 秒")
            
            # 页与页之间稍微喘口气，假装人类在翻页
            print(f"  💤 歇息 3 秒，准备进入下一页...\n")
            time.sleep(random.uniform(2, 5))
            
        except Exception as e:
            print(f"❌ 处理第 {page} 页时发生严重异常: {e}")
            break

if __name__ == "__main__":
    # max_workers=10 代表同时有 10 个线程在疯狂下载详情页
    scrape_with_concurrent(start_page=21, end_page=7150, max_workers=30)
