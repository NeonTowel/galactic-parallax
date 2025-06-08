CREATE TABLE IF NOT EXISTS aggregated_results (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  keywords TEXT,
  orientation TEXT,
  tbs TEXT,
  engines_used TEXT,
  created_at DATETIME NOT NULL,
  expires_at DATETIME NOT NULL,
  user_id TEXT
);

CREATE TABLE IF NOT EXISTS result_items (
  id TEXT PRIMARY KEY,
  agg_id TEXT NOT NULL,
  title TEXT,
  url TEXT,
  thumbnailUrl TEXT,
  sourceUrl TEXT,
  sourceDomain TEXT,
  description TEXT,
  width INTEGER,
  height INTEGER,
  fileSize INTEGER,
  mimeType TEXT,
  fileFormat TEXT,
  source_engine TEXT,
  FOREIGN KEY (agg_id) REFERENCES aggregated_results(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_agg_id ON result_items(agg_id);
CREATE INDEX IF NOT EXISTS idx_expires_at ON aggregated_results(expires_at);
CREATE INDEX IF NOT EXISTS idx_user_query ON aggregated_results(user_id, query);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  preferences TEXT NOT NULL,
  updated_at DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS search_engines (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    api_key TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    request_count INTEGER DEFAULT 0,
    last_used DATETIME
);

INSERT OR IGNORE INTO search_engines (id, name) VALUES ('google', 'Google');
INSERT OR IGNORE INTO search_engines (id, name) VALUES ('brave', 'Brave');
INSERT OR IGNORE INTO search_engines (id, name) VALUES ('serper', 'Serper');

CREATE TABLE IF NOT EXISTS search_history (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  query TEXT NOT NULL,
  timestamp DATETIME NOT NULL
); 