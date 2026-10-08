-- Fictional demo data for local development. Everyone here is made up.
-- Alex (first user, so the CLI's owner secret acts as Alex) shares a workspace with Robin.
INSERT INTO Users (id, email, name, created_at) VALUES
  ('demo-alex', 'alex@example.com', 'Alex Owner', '2026-01-01 00:00:00'),
  ('demo-robin', 'robin@example.com', 'Robin Fairweather', '2026-01-02 00:00:00'),
  ('demo-sam', 'sam@example.com', 'Sam Viewer', '2026-01-03 00:00:00');

INSERT INTO Organisations (id, name, slug, is_personal, created_by) VALUES
  ('org-alex', 'Alex Owner', 'alex', 1, 'demo-alex'),
  ('org-robin', 'Robin Fairweather', 'robin', 1, 'demo-robin'),
  ('org-acme', 'Acme Solar', 'acme-solar', 0, 'demo-alex');

INSERT INTO OrganisationMembers (id, org_id, user_id, role) VALUES
  ('m-alex', 'org-alex', 'demo-alex', 'owner'),
  ('m-robin', 'org-robin', 'demo-robin', 'owner'),
  ('m-acme-alex', 'org-acme', 'demo-alex', 'owner'),
  ('m-acme-robin', 'org-acme', 'demo-robin', 'member'),
  ('m-acme-sam', 'org-acme', 'demo-sam', 'viewer');

INSERT INTO Projects (id, org_id, key, name, lead_user_id) VALUES
  ('p-home', 'org-alex', 'HOM', 'Home', 'demo-alex'),
  ('p-portal', 'org-acme', 'POR', 'Installer Portal', 'demo-alex'),
  ('p-sales', 'org-acme', 'SAL', 'Sales', 'demo-alex');

INSERT INTO Goals (id, user_id, type, title, order_index) VALUES
  ('g-alex-1', 'demo-alex', 'aim', 'Build something worthwhile', 0);

INSERT INTO Epics (id, user_id, title, description, category, project_id, status) VALUES
  ('e-launch', 'demo-alex', 'Launch the installer portal', 'First customers live', 'Installer Portal', 'p-portal', 'active');

INSERT INTO Tasks (id, project_id, epic_id, reporter_id, assignee_id, title, reason, status, priority, size, updated_by) VALUES
  ('d1000001-0000-4000-8000-000000000001', 'p-portal', 'e-launch', 'demo-alex', 'demo-robin', 'Check the inverter datasheet import', 'Needed for quotes', 'do', 8, '**', 'demo-alex'),
  ('d1000002-0000-4000-8000-000000000002', 'p-portal', 'e-launch', 'demo-alex', 'demo-alex', 'Write the onboarding email', NULL, 'do', 6, '*', 'demo-alex'),
  ('d1000003-0000-4000-8000-000000000003', 'p-portal', NULL, 'demo-robin', NULL, 'Fix the flaky upload test', NULL, 'delay', 4, '***', 'demo-robin'),
  ('d1000004-0000-4000-8000-000000000004', 'p-sales', NULL, 'demo-alex', 'demo-alex', 'Follow up with the pilot customer', NULL, 'awaiting', 7, '*', 'demo-alex'),
  ('d1000005-0000-4000-8000-000000000005', 'p-home', NULL, 'demo-alex', 'demo-alex', 'Book the boiler service', NULL, 'do', 5, '*', 'demo-alex');
UPDATE Tasks SET await_until = '2030-01-01' WHERE id = 'd1000004-0000-4000-8000-000000000004';

INSERT INTO TaskUpdates (id, task_id, author_id, note) VALUES
  ('n-1', 'd1000001-0000-4000-8000-000000000001', 'demo-robin', 'Started on this, the CSV has two date formats');

INSERT INTO ActivityLog (id, actor_id, org_id, project_id, entity_type, entity_id, task_id, action, summary) VALUES
  ('a-1', 'demo-alex', 'org-acme', 'p-portal', 'task', 'd1000001-0000-4000-8000-000000000001', 'd1000001-0000-4000-8000-000000000001', 'assigned', 'Assigned "Check the inverter datasheet import" to Robin Fairweather');
