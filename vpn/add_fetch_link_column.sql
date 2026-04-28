-- 为 user 表添加 fetch_link 字段用于记录用户调用链接的历史
-- 执行时间：2026-04-29
-- 说明：fetch_link 存储 JSON 数组，记录用户调用免费/VIP 节点的历史

-- 添加 fetch_link 列（如果不存在）
ALTER TABLE user ADD COLUMN fetch_link TEXT DEFAULT '[]';

-- 更新现有用户的 fetch_link 为空数组
UPDATE user SET fetch_link = '[]' WHERE fetch_link IS NULL;

-- 验证修改
SELECT username, fetch_link FROM user LIMIT 5;
