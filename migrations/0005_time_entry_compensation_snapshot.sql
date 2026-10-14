ALTER TABLE time_entries ADD COLUMN pay_type TEXT CHECK (pay_type IN ('hourly', 'salary'));
ALTER TABLE time_entries ADD COLUMN pay_rate_minor INTEGER CHECK (pay_rate_minor IS NULL OR pay_rate_minor >= 0);
ALTER TABLE time_entries ADD COLUMN pay_period TEXT;
ALTER TABLE time_entries ADD COLUMN currency TEXT;

UPDATE time_entries
SET pay_type = (
      SELECT pay_type FROM employees
      WHERE employees.id = time_entries.employee_id AND employees.tenant_id = time_entries.tenant_id
    ),
    pay_rate_minor = (
      SELECT pay_rate_minor FROM employees
      WHERE employees.id = time_entries.employee_id AND employees.tenant_id = time_entries.tenant_id
    ),
    pay_period = (
      SELECT pay_period FROM employees
      WHERE employees.id = time_entries.employee_id AND employees.tenant_id = time_entries.tenant_id
    ),
    currency = (
      SELECT currency FROM employees
      WHERE employees.id = time_entries.employee_id AND employees.tenant_id = time_entries.tenant_id
    )
WHERE pay_type IS NULL;
