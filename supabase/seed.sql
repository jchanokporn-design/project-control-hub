-- Optional seed data — run after 0001_init.sql if you want two starter templates.

insert into public.project_templates (name, type, default_tasks) values
(
  'IT Project — Standard',
  'it',
  '[
    {"name": "Requirement", "offset_days_start": 0, "offset_days_due": 10},
    {"name": "Design", "offset_days_start": 7, "offset_days_due": 20},
    {"name": "Development", "offset_days_start": 14, "offset_days_due": 45},
    {"name": "SIT", "offset_days_start": 45, "offset_days_due": 55},
    {"name": "UAT", "offset_days_start": 55, "offset_days_due": 70},
    {"name": "Training", "offset_days_start": 65, "offset_days_due": 72},
    {"name": "Go Live", "offset_days_start": 72, "offset_days_due": 73, "is_milestone": true},
    {"name": "Hypercare", "offset_days_start": 73, "offset_days_due": 87},
    {"name": "Close", "offset_days_start": 87, "offset_days_due": 90, "is_milestone": true}
  ]'
),
(
  'Construction Project — Standard',
  'construction',
  '[
    {"name": "Planning", "offset_days_start": 0, "offset_days_due": 7},
    {"name": "Site Survey", "offset_days_start": 5, "offset_days_due": 12},
    {"name": "Design", "offset_days_start": 10, "offset_days_due": 25},
    {"name": "Procurement", "offset_days_start": 20, "offset_days_due": 35},
    {"name": "Construction", "offset_days_start": 35, "offset_days_due": 90},
    {"name": "Installation", "offset_days_start": 80, "offset_days_due": 100},
    {"name": "Inspection", "offset_days_start": 95, "offset_days_due": 102},
    {"name": "Defect", "offset_days_start": 100, "offset_days_due": 110},
    {"name": "Handover", "offset_days_start": 108, "offset_days_due": 110, "is_milestone": true},
    {"name": "Close", "offset_days_start": 110, "offset_days_due": 112, "is_milestone": true}
  ]'
)
on conflict (name, type) do nothing;
-- Note: the (name, type) unique constraint used above is added in
-- migrations/0002_fixes_from_phase1_testing.sql. If you're running this
-- seed against a fresh database, apply 0001 then 0002 before this file.
