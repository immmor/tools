# 消息管理功能使用说明

## 功能概述

消息管理功能允许管理员向单个用户或所有用户发送通知消息。用户可以在个人中心查看和管理收到的消息。

## 数据库配置

### 创建消息表

在Cloudflare D1中执行以下SQL语句创建消息表：

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

### 与user表关联

消息表通过 `username` 字段与user表关联：

- **消息表字段**: `username` (TEXT NOT NULL)
- **user表字段**: `username` (text)
- **关联方式**: 应用层关联（通过username字段匹配）

**关联查询示例**:
```sql
-- 获取用户消息及用户信息
SELECT m.*, u.balance, u.v_expire_date 
FROM messages m 
LEFT JOIN user u ON m.username = u.username 
WHERE m.username = ?;

-- 获取所有用户的未读消息数量
SELECT u.username, u.balance, COUNT(m.id) as unread_count
FROM user u
LEFT JOIN messages m ON u.username = m.username AND m.is_read = 0
GROUP BY u.username;
```

**数据完整性说明**:
- 消息表不使用外键约束（D1对外键支持有限）
- 通过应用层保证数据一致性
- 删除用户时，建议同时删除该用户的消息

## API接口

### 1. 发送消息

**接口地址:** `POST /api/send-message`

**请求参数:**
```json
{
    "title": "消息标题",
    "content": "消息内容",
    "target": "all",
    "username": "用户名（可选，当target为single时需要）"
}
```

**参数说明:**
- `title`: 消息标题（必填）
- `content`: 消息内容（必填）
- `target`: 发送对象，可选值：
  - `all`: 向所有用户发送
  - `single`: 向单个用户发送
- `username`: 用户名（当target为single时必填）

**响应示例:**
```json
{
    "code": 200,
    "msg": "发送成功",
    "data": {
        "total": 10,
        "title": "消息标题",
        "content": "消息内容"
    }
}
```

### 2. 获取用户消息

**接口地址:** `GET /api/messages?username=xxx`

**响应示例:**
```json
{
    "code": 200,
    "msg": "查询成功",
    "data": {
        "messages": [
            {
                "id": 1,
                "username": "user1",
                "title": "消息标题",
                "content": "消息内容",
                "created_at": "2026-03-18 10:00:00",
                "is_read": 0
            }
        ],
        "unreadCount": 1
    }
}
```

### 3. 标记消息为已读

**接口地址:** `POST /api/messages/read`

**请求参数:**
```json
{
    "messageId": 1,
    "username": "user1"
}
```

**响应示例:**
```json
{
    "code": 200,
    "msg": "标记成功"
}
```

## 使用方法

### 管理员发送消息

1. 登录后台管理系统（bms.html）
2. 点击侧边栏的"消息管理"菜单
3. 填写消息标题和内容
4. 选择发送对象：
   - **所有用户**：向所有注册用户发送通知
   - **单个用户**：仅向指定用户发送通知
5. 点击"发送消息"按钮

**发送逻辑说明**：
- 发送给所有用户时，系统会从user表获取所有用户名，然后为每个用户创建一条消息
- 发送给单个用户时，系统会先验证user表中是否存在该用户，存在才发送消息
- 消息通过username字段与user表关联

### 用户查看消息

1. 登录用户中心（index.html）
2. 点击右上角的铃铛图标
3. 查看收到的消息列表
4. 点击消息可以标记为已读
5. 未读消息会在铃铛图标上显示红点

### 数据库维护

**删除用户时同步删除消息**：
```sql
-- 删除用户及其所有消息
DELETE FROM messages WHERE username = ?;
DELETE FROM user WHERE username = ?;
```

**查询用户未读消息数量**：
```sql
SELECT COUNT(*) as unread_count 
FROM messages 
WHERE username = ? AND is_read = 0;
```

**查询用户所有消息**：
```sql
SELECT * FROM messages 
WHERE username = ? 
ORDER BY created_at DESC 
LIMIT 50;
```

## 注意事项

1. 确保D1数据库中已创建消息表
2. 消息标题建议不超过20字
3. 消息内容建议不超过500字
4. 消息会显示在用户的个人中心通知栏
5. 用户可以标记消息为已读状态

## 技术实现

### 前端（bms.html）

- 添加了消息管理页面
- 支持向单个用户或所有用户发送消息
- 包含使用说明

### 前端（index.html）

- 用户登录后自动加载消息
- 显示未读消息数量
- 支持标记消息为已读
- 消息时间显示为相对时间（如"2小时前"）

### 后端（worker.js）

- `/api/send-message`: 发送消息接口
- `/api/messages`: 获取用户消息接口
- `/api/messages/read`: 标记消息为已读接口
