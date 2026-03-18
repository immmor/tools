# 消息管理功能部署指南

## 问题排查

如果遇到404错误，请按以下步骤检查：

### 1. 检查D1数据库绑定

在Cloudflare Dashboard中：
1. 进入你的Worker
2. 点击"设置"标签
3. 向下滚动到"绑定"
4. 确保D1数据库已绑定，且Variable name为 `DB`

### 2. 创建消息表

在Cloudflare D1中执行以下SQL：

```sql
CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL,
    is_read INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_messages_username ON messages(username);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);
CREATE INDEX IF NOT EXISTS idx_messages_is_read ON messages(is_read);
```

### 3. 重新部署Worker

在Cloudflare Workers中重新部署修改后的worker.js文件。

### 4. 测试API

在浏览器控制台中测试：

```javascript
// 测试发送消息
fetch('/api/send-message', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        title: '测试消息',
        content: '这是一条测试消息',
        target: 'all'
    })
})
.then(res => res.json())
.then(data => console.log(data));
```

### 5. 检查Worker日志

在Cloudflare Dashboard中查看Worker日志，确认是否有错误信息。

## 常见问题

### Q: 404错误
A: 检查Worker是否已重新部署，以及API路由是否在默认接口之前

### Q: 500错误
A: 检查D1数据库是否正确绑定，以及消息表是否已创建

### Q: 消息无法发送
A: 检查user表中是否有用户，以及数据库绑定是否正确
