-- Migration: 0005_task_relations_tags_fts.sql
-- Add customer and tags columns to Tasks and Projects_Legacy
ALTER TABLE Tasks ADD COLUMN customer TEXT;
ALTER TABLE Tasks ADD COLUMN tags TEXT;

ALTER TABLE Projects_Legacy ADD COLUMN customer TEXT;
ALTER TABLE Projects_Legacy ADD COLUMN tags TEXT;

CREATE INDEX IF NOT EXISTS idx_tasks_customer ON Tasks(customer);
CREATE INDEX IF NOT EXISTS idx_legacy_projects_customer ON Projects_Legacy(customer);

-- Create TaskRelations table for semantic links
CREATE TABLE IF NOT EXISTS TaskRelations (
  id TEXT PRIMARY KEY,
  source_task_id TEXT NOT NULL,
  target_task_id TEXT NOT NULL,
  relation_type TEXT NOT NULL DEFAULT 'relates_to', -- 'relates_to' | 'blocks' | 'blocked_by' | 'duplicates'
  reason TEXT,
  created_by TEXT REFERENCES Users(id) ON DELETE SET NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(source_task_id, target_task_id, relation_type)
);

CREATE INDEX IF NOT EXISTS idx_task_relations_source ON TaskRelations(source_task_id);
CREATE INDEX IF NOT EXISTS idx_task_relations_target ON TaskRelations(target_task_id);

-- Create FTS5 virtual table across tasks and updates
CREATE VIRTUAL TABLE IF NOT EXISTS Tasks_FTS USING fts5(
  task_id UNINDEXED,
  title,
  reason,
  notes,
  customer,
  tags,
  update_notes,
  tokenize='porter unicode61'
);

-- Triggers to auto-sync FTS with Tasks changes
CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_insert AFTER INSERT ON Tasks BEGIN
  INSERT INTO Tasks_FTS (task_id, title, reason, notes, customer, tags, update_notes)
  VALUES (new.id, new.title, coalesce(new.reason, ''), coalesce(new.notes, ''), coalesce(new.customer, ''), coalesce(new.tags, ''), '');
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_update AFTER UPDATE ON Tasks BEGIN
  UPDATE Tasks_FTS SET
    title = new.title,
    reason = coalesce(new.reason, ''),
    notes = coalesce(new.notes, ''),
    customer = coalesce(new.customer, ''),
    tags = coalesce(new.tags, '')
  WHERE task_id = old.id;
END;

CREATE TRIGGER IF NOT EXISTS trg_tasks_fts_delete AFTER DELETE ON Tasks BEGIN
  DELETE FROM Tasks_FTS WHERE task_id = old.id;
END;

-- Trigger to append update notes to FTS on TaskUpdates insert
CREATE TRIGGER IF NOT EXISTS trg_task_updates_fts_insert AFTER INSERT ON TaskUpdates BEGIN
  UPDATE Tasks_FTS SET
    update_notes = coalesce(update_notes, '') || ' ' || new.note
  WHERE task_id = new.task_id;
END;

-- Seed existing tasks into Tasks_FTS
INSERT INTO Tasks_FTS (task_id, title, reason, notes, customer, tags, update_notes)
SELECT id, title, coalesce(reason, ''), coalesce(notes, ''), coalesce(customer, ''), coalesce(tags, ''), ''
FROM Tasks;
