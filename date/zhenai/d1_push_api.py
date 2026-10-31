#!/usr/bin/env python3
"""不用 wrangler：走 Cloudflare REST API 把 d1_seed/*.sql 写进 D1。

先准备三个环境变量（控制台里都能看到）：
  CF_ACCOUNT_ID   账号 ID（Workers & Pages 右侧栏 / 任意域名概览页右下）
  CF_API_TOKEN    API Token，权限选「D1 → Edit」
  D1_DATABASE_ID  D1 数据库 ID（进 duser-db 详情页可见）

用法：
  python3 d1_push_api.py          # 从第 1 个文件开始
  python3 d1_push_api.py 8        # 从 d1_seed_008.sql 开始（断了可以续）
"""
import json
import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

HERE = pathlib.Path(__file__).resolve().parent
SEED_DIR = HERE / 'd1_seed'
API = 'https://api.cloudflare.com/client/v4/accounts/{acc}/d1/database/{db}/query'
STATEMENT = re.compile(r'\n(?=INSERT OR REPLACE INTO duser)')


def push(sql, url, token):
    body = json.dumps({'sql': sql}, ensure_ascii=False).encode('utf-8')
    req = urllib.request.Request(
        url, data=body, method='POST',
        headers={'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json'},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            data = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        return False, f'HTTP {e.code}: {e.read().decode("utf-8", "ignore")[:300]}'
    if not data.get('success'):
        return False, json.dumps(data.get('errors'), ensure_ascii=False)[:300]
    return True, ''


def main():
    acc = os.environ.get('CF_ACCOUNT_ID', '')
    token = os.environ.get('CF_API_TOKEN', '')
    db = os.environ.get('D1_DATABASE_ID', '')
    if not (acc and token and db):
        sys.exit('请先设置 CF_ACCOUNT_ID / CF_API_TOKEN / D1_DATABASE_ID')

    url = API.format(acc=acc, db=db)
    start = int(sys.argv[1]) if len(sys.argv) > 1 else 1
    ok = fail = 0

    for path in sorted(SEED_DIR.glob('d1_seed_*.sql')):
        if int(path.stem.split('_')[-1]) < start:
            continue
        text = path.read_text(encoding='utf-8')
        statements = [s.strip() for s in STATEMENT.split(text) if 'INSERT' in s]
        print(f'{path.name}: {len(statements)} 条语句', flush=True)
        for i, sql in enumerate(statements, 1):
            success, err = push(sql, url, token)
            if success:
                ok += 1
            else:
                fail += 1
                print(f'  第 {i} 条失败：{err}', flush=True)
                if fail > 3:
                    sys.exit('失败过多，已停止；修好后用参数从当前文件续跑')
        print(f'  完成，累计成功 {ok} 条', flush=True)

    print(f'\n全部完成：成功 {ok} 条，失败 {fail} 条')


if __name__ == '__main__':
    main()
