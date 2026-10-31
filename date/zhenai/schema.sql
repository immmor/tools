-- 珍爱数据表结构（SQLite）
-- 用法：sqlite3 zhenai.db < schema.sql

PRAGMA journal_mode = WAL;

DROP TABLE IF EXISTS users;
CREATE TABLE users (
    id            TEXT PRIMARY KEY,             -- 珍爱用户 id
    name          TEXT NOT NULL,                -- 昵称
    gender        TEXT,                         -- 男 / 女
    age           INTEGER,
    height        INTEGER,                      -- 厘米；-1 表示未填
    education     TEXT,                         -- 高中及以下 / 中专 / 大专 / 大学本科 / 硕士 / 博士 / ''
    income        TEXT,                         -- 月薪区间，如 '8001-12000元'
    marital       TEXT,                         -- 未婚 / 离异 / 丧偶 / 未填写
    region        TEXT,                         -- 来源分片，如 'beijing'
    residence     TEXT,                         -- 现居地，如 '浙江杭州'
    hometown      TEXT,                         -- 原数据全空
    job           TEXT,
    constellation TEXT,
    blood_type    TEXT,
    school        TEXT,
    major         TEXT,
    hobby         TEXT,
    bio           TEXT,
    photo_url     TEXT,                         -- 目前每人 1 张，取 photos[0]
    profile_url   TEXT,                         -- 原始主页
    raw           TEXT,                         -- 原始 JSON 整条，兜底
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_users_age        ON users(age);
CREATE INDEX idx_users_height     ON users(height);
CREATE INDEX idx_users_education  ON users(education);
CREATE INDEX idx_users_income     ON users(income);
CREATE INDEX idx_users_marital    ON users(marital);
CREATE INDEX idx_users_gender     ON users(gender);
CREATE INDEX idx_users_region     ON users(region);
CREATE INDEX idx_users_residence  ON users(residence);
