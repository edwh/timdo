-- CATCH-UP after the cut-over: replay only what the OLD single-user API wrote to the legacy
-- tables after {{CUTOVER}} (the moment the one-shot sync started). Never undoes anything done
-- through the new API: tasks it has touched (updated_by set) only change if the legacy row is
-- newer, project placement is never changed for tasks that already exist, notes are only added.
--
-- Generate and run:
--   sed "s/{{CUTOVER}}/2026-10-08T13:00:00Z/g" collab-catchup-sync.template.sql > /tmp/catchup.sql
--   npx wrangler d1 execute timdo-v2-db --remote --file /tmp/catchup.sql

-- Tasks created or edited by the old API after the cut-over
INSERT INTO Tasks (id, project_id, epic_id, reporter_id, assignee_id, title, reason, status,
                   priority, size, notes, status_last_changed_on, await_until, gmail_thread_id,
                   is_deleted, created_at, updated_at, customer, tags, updated_by)
SELECT l.id,
       (SELECT p.id FROM Projects p
          JOIN OrganisationMembers m ON m.org_id = p.org_id AND m.user_id = l.user_id AND m.role = 'owner'
          JOIN Organisations o ON o.id = p.org_id
         WHERE lower(p.name) = lower(coalesce(nullif(trim(l.category), ''), 'General'))
         ORDER BY o.is_personal DESC, p.created_at
         LIMIT 1),
       l.epic_id, l.user_id, l.user_id, l.project, l.reason, l.status,
       l.priority, l.size, l.notes, l.status_last_changed_on, l.await_until, l.gmail_thread_id,
       coalesce(l.is_deleted, 0), l.created_at, l.updated_at, l.customer, l.tags, NULL
FROM Projects_Legacy l
WHERE datetime(l.updated_at) > datetime('{{CUTOVER}}')
   OR datetime(l.created_at) > datetime('{{CUTOVER}}')
ON CONFLICT(id) DO UPDATE SET
  epic_id = excluded.epic_id,
  title = excluded.title,
  reason = excluded.reason,
  status = excluded.status,
  priority = excluded.priority,
  size = excluded.size,
  notes = excluded.notes,
  status_last_changed_on = excluded.status_last_changed_on,
  await_until = excluded.await_until,
  gmail_thread_id = excluded.gmail_thread_id,
  is_deleted = excluded.is_deleted,
  updated_at = excluded.updated_at,
  customer = excluded.customer,
  tags = excluded.tags
WHERE Tasks.updated_by IS NULL
   OR datetime(excluded.updated_at) > datetime(Tasks.updated_at);

-- Goal links the old API set on those tasks (add only; never removes links)
INSERT OR IGNORE INTO TaskUserGoals (task_id, user_id, goal_id, created_at)
SELECT l.id, l.user_id, l.goal_id, CURRENT_TIMESTAMP
FROM Projects_Legacy l
WHERE l.goal_id IS NOT NULL
  AND l.goal_id IN (SELECT id FROM Goals)
  AND l.id IN (SELECT id FROM Tasks)
  AND datetime(l.updated_at) > datetime('{{CUTOVER}}')
  AND NOT EXISTS (SELECT 1 FROM TaskUserGoals g WHERE g.task_id = l.id AND g.user_id = l.user_id);

-- Notes the old API added after the cut-over
INSERT INTO TaskUpdates (id, task_id, author_id, note, gmail_thread_id, created_at, updated_at)
SELECT pu.id, pu.project_id, pu.user_id, pu.note, pu.gmail_thread_id, pu.created_at, pu.updated_at
FROM ProjectUpdates pu
WHERE pu.project_id IN (SELECT id FROM Tasks)
  AND datetime(pu.created_at) > datetime('{{CUTOVER}}')
ON CONFLICT(id) DO NOTHING;
