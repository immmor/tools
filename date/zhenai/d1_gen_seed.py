#!/usr/bin/env python3
"""把 data/*.json 生成 Cloudflare D1 可导入的 SQL 种子文件（表名 duser）。

输出：zhenai/d1_seed/d1_seed_001.sql …（每个文件 2000 条，多行 INSERT）
用法：python3 d1_gen_seed.py
"""
import json
import pathlib
import sys

HERE = pathlib.Path(__file__).resolve().parent
DATA = HERE / 'data'
OUT_DIR = HERE / 'd1_seed'
# 可选参数：每个文件多少条（往控制台里粘贴时用 500 之类的小文件）
ROWS_PER_FILE = int(sys.argv[1]) if len(sys.argv) > 1 else 2000
ROWS_PER_INSERT = 50      # D1 单条 SQL 上限 100KB，一条 INSERT 别塞太多行

COLUMNS = [
    'id', 'name', 'gender', 'age', 'height', 'education', 'income', 'marital',
    'region', 'residence', 'hometown', 'job', 'constellation', 'blood_type',
    'school', 'major', 'hobby', 'bio', 'photo_url', 'profile_url', 'raw',
]


def sql_value(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


def to_row(u):
    return [
        u.get('id'), u.get('name'), u.get('gender'), u.get('age'), u.get('height'),
        u.get('education'), u.get('income'), u.get('marital'), u.get('region'),
        u.get('residence'), u.get('hometown'), u.get('job'), u.get('constellation'),
        u.get('bloodType'), u.get('school'), u.get('major'), u.get('hobby'), u.get('bio'),
        (u.get('photos') or [None])[0], u.get('profile'),
        json.dumps(u, ensure_ascii=False),
    ]


def main():
    rows = []
    for path in sorted(DATA.glob('*.json')):
        if path.name == 'index.json':
            continue
        rows.extend(to_row(u) for u in json.loads(path.read_text(encoding='utf-8')))

    OUT_DIR.mkdir(exist_ok=True)
    for old in OUT_DIR.glob('d1_seed_*.sql'):
        old.unlink()

    cols = ','.join(COLUMNS)
    file_no = 0
    for start in range(0, len(rows), ROWS_PER_FILE):
        file_no += 1
        chunk = rows[start:start + ROWS_PER_FILE]
        lines = [f'-- 第 {file_no} 块：{len(chunk)} 条']
        for i in range(0, len(chunk), ROWS_PER_INSERT):
            batch = chunk[i:i + ROWS_PER_INSERT]
            values = ',\n'.join('(' + ','.join(sql_value(v) for v in row) + ')' for row in batch)
            lines.append(f'INSERT OR REPLACE INTO duser ({cols}) VALUES\n{values};')
        out = OUT_DIR / f'd1_seed_{file_no:03d}.sql'
        out.write_text('\n'.join(lines) + '\n', encoding='utf-8')
        print(f'{out.name}: {len(chunk)} 条, {out.stat().st_size // 1024} KB')

    print(f'\n合计 {len(rows)} 条，输出目录 {OUT_DIR}')


if __name__ == '__main__':
    main()
