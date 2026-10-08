ALTER TABLE Projects ADD COLUMN gmail_thread_id TEXT;

CREATE TABLE IF NOT EXISTS ProjectUpdates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  note TEXT NOT NULL,
  gmail_thread_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES Projects(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_project_updates_project_id ON ProjectUpdates (project_id);
CREATE INDEX IF NOT EXISTS idx_project_updates_user_id ON ProjectUpdates (user_id);
