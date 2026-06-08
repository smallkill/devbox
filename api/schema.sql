CREATE TABLE IF NOT EXISTS links (
  slug TEXT PRIMARY KEY,
  url  TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

-- 訪客埋點:每次造訪一列。ip_hash 為加 salt 的每日雜湊(不存原始 IP)。
CREATE TABLE IF NOT EXISTS visits (
  ts      INTEGER NOT NULL,
  day     TEXT NOT NULL,
  ip_hash TEXT NOT NULL,
  country TEXT,
  path    TEXT
);
CREATE INDEX IF NOT EXISTS idx_visits_day ON visits(day);
