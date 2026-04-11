-- 创建 link 表用于存储订阅链接配置
CREATE TABLE IF NOT EXISTS link (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- 插入默认链接配置
INSERT OR IGNORE INTO link (key, value) VALUES 
('clash_monthly', 'https://8f0ae.no-mad-sub.one/link/G9e7lAfkKoCAeAn3?clash=3&extend=1'),
('v2ray_monthly', 'https://8f0ae.no-mad-sub.one/link/G9e7lAfkKoCAeAn3?sub=3&extend=1'),
('clash_yearly', 'https://p5jli.no-mad-sub.one/link/R4eay53N8l0ooeQn?clash=3&extend=1'),
('v2ray_yearly', 'https://p5jli.no-mad-sub.one/link/R4eay53N8l0ooeQn?sub=3&extend=1');
