-- Migration: 0006_collaboration.sql
-- Multi-user collaboration: attribution, epic scoping and an activity log.
-- OrganisationMembers.role gains 'viewer' (read-only); no schema change needed (TEXT column).

-- Each user has exactly one personal workspace (private by default, can still be shared)
ALTER TABLE Organisations ADD COLUMN is_personal INTEGER NOT NULL DEFAULT 0;

-- Invites are kept once used, so opening the link again after signing in still works
ALTER TABLE OrganisationInvites ADD COLUMN accepted_by TEXT REFERENCES Users(id) ON DELETE SET NULL;
ALTER TABLE OrganisationInvites ADD COLUMN accepted_at TEXT;

-- Who last touched a task (NULL = synced from the legacy single-user table)
ALTER TABLE Tasks ADD COLUMN updated_by TEXT REFERENCES Users(id) ON DELETE SET NULL;

-- Epics belong to a project so collaborators can see them
ALTER TABLE Epics ADD COLUMN project_id TEXT REFERENCES Projects(id) ON DELETE SET NULL;
ALTER TABLE Epics ADD COLUMN updated_by TEXT REFERENCES Users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_epics_project_id ON Epics(project_id);

CREATE INDEX IF NOT EXISTS idx_tasks_project_id ON Tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assignee_id ON Tasks(assignee_id);
CREATE INDEX IF NOT EXISTS idx_task_updates_task_id ON TaskUpdates(task_id);
CREATE INDEX IF NOT EXISTS idx_projects_org_id ON Projects(org_id);

-- Who did what, when. actor_id NULL = system (e.g. the awaiting-return cron).
CREATE TABLE IF NOT EXISTS ActivityLog (
  id TEXT PRIMARY KEY,
  actor_id TEXT REFERENCES Users(id) ON DELETE SET NULL,
  org_id TEXT REFERENCES Organisations(id) ON DELETE CASCADE,
  project_id TEXT REFERENCES Projects(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL, -- 'task' | 'epic' | 'note' | 'project' | 'organisation' | 'member'
  entity_id TEXT NOT NULL,
  task_id TEXT, -- set for task and note events so a task timeline is one query
  epic_id TEXT,
  action TEXT NOT NULL, -- 'created' | 'updated' | 'status_changed' | 'assigned' | 'deleted' | ...
  summary TEXT NOT NULL,
  changes TEXT, -- JSON: { field: { from, to } }
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_activity_task ON ActivityLog(task_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_epic ON ActivityLog(epic_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_project ON ActivityLog(project_id, created_at);
CREATE INDEX IF NOT EXISTS idx_activity_org ON ActivityLog(org_id, created_at);

-- Keep search in step when notes are deleted, edited or moved (merge), so deleted text
-- can't be found again. (0005 only had an insert trigger.)
CREATE TRIGGER IF NOT EXISTS trg_task_updates_fts_delete AFTER DELETE ON TaskUpdates BEGIN
  UPDATE Tasks_FTS SET update_notes = coalesce(
    (SELECT group_concat(note, ' ') FROM TaskUpdates WHERE task_id = old.task_id), '')
  WHERE task_id = old.task_id;
END;

CREATE TRIGGER IF NOT EXISTS trg_task_updates_fts_update AFTER UPDATE OF note, task_id ON TaskUpdates BEGIN
  UPDATE Tasks_FTS SET update_notes = coalesce(
    (SELECT group_concat(note, ' ') FROM TaskUpdates WHERE task_id = old.task_id), '')
  WHERE task_id = old.task_id;
  UPDATE Tasks_FTS SET update_notes = coalesce(
    (SELECT group_concat(note, ' ') FROM TaskUpdates WHERE task_id = new.task_id), '')
  WHERE task_id = new.task_id;
END;
