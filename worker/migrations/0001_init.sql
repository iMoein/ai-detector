CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT NOT NULL,
  result TEXT NOT NULL CHECK (result IN ('all', 'ai', 'edited', 'camera', 'unknown')),
  count INTEGER NOT NULL DEFAULT 0 CHECK (count >= 0),
  PRIMARY KEY (day, result)
);

CREATE INDEX IF NOT EXISTS idx_daily_stats_day ON daily_stats(day);
