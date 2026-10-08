-- workers/src/db/migrations/0002_multiuser_organisations.sql
-- Create Organisations table
CREATE TABLE IF NOT EXISTS Organisations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  created_by TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_organisations_created_by ON Organisations(created_by);
CREATE INDEX IF NOT EXISTS idx_organisations_slug ON Organisations(slug);

-- Create OrganisationMembers table
CREATE TABLE IF NOT EXISTS OrganisationMembers (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES Organisations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member', -- 'owner' | 'admin' | 'member'
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_members_org_id ON OrganisationMembers(org_id);
CREATE INDEX IF NOT EXISTS idx_org_members_user_id ON OrganisationMembers(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_org_user ON OrganisationMembers(org_id, user_id);

-- Create OrganisationInvites table
CREATE TABLE IF NOT EXISTS OrganisationInvites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES Organisations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member', -- 'admin' | 'member'
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_org_invites_org_id ON OrganisationInvites(org_id);
CREATE INDEX IF NOT EXISTS idx_org_invites_token ON OrganisationInvites(token);
CREATE INDEX IF NOT EXISTS idx_org_invites_email ON OrganisationInvites(email);

-- Create formal Projects table (in place of legacy Projects table)
CREATE TABLE IF NOT EXISTS Projects_New (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES Organisations(id) ON DELETE CASCADE,
  key TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  lead_user_id TEXT REFERENCES Users(id) ON DELETE SET NULL,
  is_archived INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_projects_org_id ON Projects_New(org_id);
CREATE INDEX IF NOT EXISTS idx_projects_key ON Projects_New(org_id, key);

-- Create Tasks table (migrated from legacy Projects)
CREATE TABLE IF NOT EXISTS Tasks (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES Projects_New(id) ON DELETE CASCADE,
  epic_id TEXT REFERENCES Epics(id) ON DELETE SET NULL,
  reporter_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  assignee_id TEXT REFERENCES Users(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'do', -- 'do' | 'delay' | 'done' | 'delegate' | 'awaiting'
  priority INTEGER NOT NULL DEFAULT 5,
  size TEXT NOT NULL DEFAULT '***',
  notes TEXT,
  status_last_changed_on TEXT,
  await_until TEXT,
  gmail_thread_id TEXT,
  is_deleted INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON Tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_epic_id ON Tasks(epic_id);
CREATE INDEX IF NOT EXISTS idx_tasks_reporter_id ON Tasks(reporter_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON Tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON Tasks(status);

-- Create TaskUserGoals table (personal life goal overlay on tasks)
CREATE TABLE IF NOT EXISTS TaskUserGoals (
  task_id TEXT NOT NULL REFERENCES Tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  goal_id TEXT NOT NULL REFERENCES Goals(id) ON DELETE CASCADE,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (task_id, user_id, goal_id)
);

CREATE INDEX IF NOT EXISTS idx_task_user_goals_user ON TaskUserGoals(user_id);
CREATE INDEX IF NOT EXISTS idx_task_user_goals_goal ON TaskUserGoals(goal_id);

-- Create TaskUpdates table (formerly ProjectUpdates)
CREATE TABLE IF NOT EXISTS TaskUpdates (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES Tasks(id) ON DELETE CASCADE,
  author_id TEXT NOT NULL REFERENCES Users(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  gmail_thread_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON TaskUpdates(task_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_author_id ON TaskUpdates(author_id);
