-- Cloudflare D1 建表语句（表名 duser）
-- 用法：npx wrangler d1 execute duser-db --file=d1_schema.sql --remote

DROP TABLE IF EXISTS duser;
CREATE TABLE duser (
    id            TEXT PRIMARY KEY,             -- 珍爱用户 id
    name          TEXT NOT NULL,                -- 昵称
    gender        TEXT,                         -- 男 / 女
    age           INTEGER,
    height        INTEGER,                      -- 厘米；-1/0 表示未填
    education     TEXT,                         -- 高中及以下/中专/大专/大学本科/硕士/博士/''
    income        TEXT,                         -- 月薪区间，如 '8001-12000元'
    marital       TEXT,                         -- 未婚/离异/丧偶/未填写
    region        TEXT,                         -- 来源分片，如 beijing
    residence     TEXT,                         -- 现居地，如 '浙江杭州'
    hometown      TEXT,                         -- 原数据全空
    job           TEXT,
    constellation TEXT,
    blood_type    TEXT,
    school        TEXT,
    major         TEXT,
    hobby         TEXT,
    bio           TEXT,
    photo_url     TEXT,                         -- 每人 1 张，取 photos[0]
    profile_url   TEXT,                         -- 原始主页
    raw           TEXT,                         -- 原始 JSON 整条，兜底
    created_at    TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_duser_age        ON duser(age);
CREATE INDEX idx_duser_height     ON duser(height);
CREATE INDEX idx_duser_education  ON duser(education);
CREATE INDEX idx_duser_income     ON duser(income);
CREATE INDEX idx_duser_marital    ON duser(marital);
CREATE INDEX idx_duser_gender     ON duser(gender);
CREATE INDEX idx_duser_region     ON duser(region);
CREATE INDEX idx_duser_residence  ON duser(residence);
