#!/usr/bin/env python3
"""把 data/*.json 导入 SQLite（库文件 zhenai.db，表结构见 schema.sql）。

用法：python3 import_to_sqlite.py
"""
import json
import pathlib
import sqlite3

HERE = pathlib.Path(__file__).resolve().parent
DB = HERE / 'zhenai.db'
DATA = HERE / 'data'

COLUMNS = [
    'id', 'name', 'gender', 'age', 'height', 'education', 'income', 'marital',
    'region', 'residence', 'hometown', 'job', 'constellation', 'blood_type',
    'school', 'major', 'hobby', 'bio', 'photo_url', 'profile_url', 'raw',
]


def to_row(u):
    return (
        u.get('id'), u.get('name'), u.get('gender'), u.get('age'), u.get('height'),
        u.get('education'), u.get('income'), u.get('marital'), u.get('region'),
        u.get('residence'), u.get('hometown'), u.get('job'), u.get('constellation'),
        u.get('bloodType'), u.get('school'), u.get('major'), u.get('hobby'), u.get('bio'),
        (u.get('photos') or [None])[0], u.get('profile'),
        json.dumps(u, ensure_ascii=False),
    )


def main():
    con = sqlite3.connect(DB)
    con.executescript((HERE / 'schema.sql').read_text(encoding='utf-8'))

    placeholders = ','.join('?' * len(COLUMNS))
    sql = f"INSERT OR REPLACE INTO users ({','.join(COLUMNS)}) VALUES ({placeholders})"

    total = 0
    for path in sorted(DATA.glob('*.json')):
        if path.name == 'index.json':
            continue
        users = json.loads(path.read_text(encoding='utf-8'))
        con.executemany(sql, [to_row(u) for u in users])
        total += len(users)
        print(f'{path.name}: {len(users)}')

    con.commit()
    count = con.execute('SELECT COUNT(*) FROM users').fetchone()[0]
    con.close()
    print(f'\n写入 {total} 条，库中现有 {count} 条 -> {DB}')


if __name__ == '__main__':
    main()
