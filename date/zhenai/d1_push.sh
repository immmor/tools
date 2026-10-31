#!/usr/bin/env bash
# 断点续传导入 d1_seed/*.sql：额度用完自动停，第二天重跑自动从断点继续
#   bash d1_push.sh        续传
#   bash d1_push.sh 31     从第 31 片开始
set -eu
cd "$(dirname "$0")"
DB=duser-db
LAST=.d1_last
from=${1:-$(($(cat "$LAST" 2>/dev/null || echo 30) + 1))}

for n in $(seq "$from" 75); do
  f=$(printf 'd1_seed/d1_seed_%03d.sql' "$n")
  echo "→ $f"
  if ! npx wrangler d1 execute "$DB" --file="$f" --remote; then
    echo "✗ 第 $n 片失败（多半是今日写入额度 10 万行用完），明天重跑本脚本会从 $n 继续"
    exit 1
  fi
  echo "$n" > "$LAST"
done

echo "全部完成，校验：npx wrangler d1 execute $DB --remote --command 'SELECT COUNT(*) FROM duser'"
