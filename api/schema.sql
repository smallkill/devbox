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

-- Ask my resume 問答記錄(devbox-ask worker 寫入):每次問答一列,不存 IP。
-- 只記 問題/答案/時間/國家/語系;/admin?key=ADMIN_KEY 查看。
CREATE TABLE IF NOT EXISTS ask_log (
  id       INTEGER PRIMARY KEY AUTOINCREMENT,
  ts       INTEGER NOT NULL,
  country  TEXT,
  lang     TEXT,
  question TEXT,
  answer   TEXT
);
CREATE INDEX IF NOT EXISTS idx_ask_log_ts ON ask_log(ts);
