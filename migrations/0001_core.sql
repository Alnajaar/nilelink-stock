CREATE TABLE tenants (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  admin_email TEXT NOT NULL,
  admin_phone TEXT,
  city TEXT,
  plan_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED')),
  currency TEXT NOT NULL DEFAULT 'USD',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  created_at TEXT NOT NULL,
  paid_until TEXT,
  organization_id TEXT NOT NULL,
  is_multi_branch INTEGER NOT NULL DEFAULT 0 CHECK (is_multi_branch IN (0, 1))
);

CREATE TABLE plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_minor INTEGER NOT NULL CHECK (price_minor >= 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  billing_period TEXT NOT NULL CHECK (billing_period IN ('monthly', 'quarterly', 'annual', 'lifetime')),
  max_terminals INTEGER NOT NULL CHECK (max_terminals > 0),
  max_items INTEGER NOT NULL CHECK (max_items > 0),
  max_branches INTEGER NOT NULL CHECK (max_branches > 0),
  description TEXT NOT NULL DEFAULT '',
  features_json TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL DEFAULT 1 CHECK (published IN (0, 1)),
  updated_at TEXT NOT NULL
);

CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('platform_admin', 'owner', 'admin', 'manager', 'teamlead', 'staff')),
  tenant_id TEXT REFERENCES tenants(id),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  employee_id TEXT,
  created_at TEXT NOT NULL,
  CHECK ((role = 'platform_admin' AND tenant_id IS NULL) OR (role != 'platform_admin' AND tenant_id IS NOT NULL))
);

CREATE TABLE sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX sessions_expiry_idx ON sessions(expires_at);

CREATE TABLE employees (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  branch_id TEXT,
  user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,
  pin_salt TEXT NOT NULL,
  pin_lookup_hash TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'manager', 'teamlead', 'staff')),
  pay_type TEXT NOT NULL DEFAULT 'hourly' CHECK (pay_type IN ('hourly', 'salary')),
  pay_rate_minor INTEGER NOT NULL DEFAULT 0 CHECK (pay_rate_minor >= 0),
  pay_period TEXT NOT NULL DEFAULT 'monthly' CHECK (pay_period IN ('weekly', 'biweekly', 'semimonthly', 'monthly', 'annual')),
  currency TEXT NOT NULL DEFAULT 'USD',
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (tenant_id, id)
);

CREATE INDEX employees_tenant_idx ON employees(tenant_id, active);
CREATE UNIQUE INDEX employees_tenant_pin_lookup_idx ON employees(tenant_id, pin_lookup_hash);

CREATE TABLE time_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id TEXT NOT NULL,
  branch_id TEXT,
  clock_in TEXT NOT NULL,
  clock_out TEXT,
  break_minutes INTEGER NOT NULL DEFAULT 0 CHECK (break_minutes >= 0),
  break_started_at TEXT,
  notes TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK (status IN ('open', 'submitted', 'approved', 'rejected')),
  approved_by TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (tenant_id, employee_id) REFERENCES employees(tenant_id, id)
);

CREATE UNIQUE INDEX time_entries_one_open_shift
  ON time_entries(tenant_id, employee_id) WHERE clock_out IS NULL;
CREATE INDEX time_entries_period_idx ON time_entries(tenant_id, clock_in, employee_id);

CREATE TABLE inventory_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sync_operations (
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (tenant_id, operation_id)
);

CREATE TABLE site_content (
  id TEXT PRIMARY KEY,
  draft_json TEXT NOT NULL,
  published_json TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  updated_by TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

CREATE INDEX audit_events_tenant_idx ON audit_events(tenant_id, created_at);

CREATE TABLE auth_attempts (
  subject_hash TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE employee_time_audit (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entry_id TEXT NOT NULL REFERENCES time_entries(id) ON DELETE CASCADE,
  actor_id TEXT NOT NULL,
  action TEXT NOT NULL,
  previous_json TEXT,
  current_json TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE INDEX employee_time_audit_entry_idx ON employee_time_audit(entry_id, created_at);

INSERT INTO plans (
  id, name, price_minor, currency, billing_period, max_terminals, max_items, max_branches,
  description, features_json, published, updated_at
) VALUES
  ('plan-starter', 'Espresso Solo / Starter', 2900, 'USD', 'monthly', 2, 150, 1,
   'Inventory essentials for one location.', '["Stock tracking","Offline-ready PWA"]', 1, datetime('now')),
  ('plan-pro', 'Bistro & Roastery Pro', 6900, 'USD', 'monthly', 6, 750, 2,
   'Advanced inventory workflows for growing teams.', '["Forecasting","Waste insights","Branch transfers"]', 1, datetime('now')),
  ('plan-enterprise', 'Multi-Branch & Chain Enterprise', 14900, 'USD', 'monthly', 25, 5000, 10,
   'Centralized inventory management for restaurant groups.', '["Multi-branch","Central analytics","Priority support"]', 1, datetime('now'));

INSERT INTO site_content (id, draft_json, published_json, version, updated_by, updated_at)
VALUES (
  'landing',
  '{"headline":"Smarter stock management for hospitality teams","description":"Control inventory, reduce waste, and coordinate every location from one place.","features":["Stock tracking","Branch transfers","Waste insights","Offline workflows"]}',
  '{"headline":"Smarter stock management for hospitality teams","description":"Control inventory, reduce waste, and coordinate every location from one place.","features":["Stock tracking","Branch transfers","Waste insights","Offline workflows"]}',
  1, 'system', datetime('now')
);
