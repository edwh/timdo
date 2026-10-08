-- workers/migrations/0003_add_goals_epics_categories.sql
CREATE TABLE IF NOT EXISTS Goals (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'aim' | 'focus' | 'value' | 'housekeeping'
  title TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_goals_user_id ON Goals(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_type ON Goals(type);

CREATE TABLE IF NOT EXISTS Epics (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  goal_id TEXT REFERENCES Goals(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active' | 'completed' | 'on_hold'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_epics_user_id ON Epics(user_id);
CREATE INDEX IF NOT EXISTS idx_epics_category ON Epics(category);
CREATE INDEX IF NOT EXISTS idx_epics_goal_id ON Epics(goal_id);

ALTER TABLE Projects ADD COLUMN category TEXT;
ALTER TABLE Projects ADD COLUMN epic_id TEXT REFERENCES Epics(id) ON DELETE SET NULL;
ALTER TABLE Projects ADD COLUMN goal_id TEXT REFERENCES Goals(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_projects_category ON Projects(category);
CREATE INDEX IF NOT EXISTS idx_projects_epic_id ON Projects(epic_id);
CREATE INDEX IF NOT EXISTS idx_projects_goal_id ON Projects(goal_id);
