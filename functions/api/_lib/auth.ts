import {
  AuthEnv,
  AuthenticatedUser,
  D1Database,
  HttpError,
  clearSessionCookie,
  createSession,
  enforceLoginRateLimit,
  getSession,
  hashPassword,
  hmacSha256,
  id,
  json,
  readJson,
  requireDatabase,
  requireSameOrigin,
  sha256,
  validateEmail,
  validatePassword,
  verifyTotp
} from './security';

interface LoginBody {
  email?: unknown;
  password?: unknown;
  totp?: unknown;
}

interface RegisterBody extends LoginBody {
  name?: unknown;
  ownerName?: unknown;
  adminPhone?: unknown;
  city?: unknown;
  pin?: unknown;
  planId?: unknown;
  turnstileToken?: unknown;
  currency?: unknown;
  timezone?: unknown;
}

interface StoredUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  passwordSalt: string;
  role: AuthenticatedUser['role'];
  tenantId: string | null;
  employeeId?: string | null;
}

async function verifyCaptcha(request: Request, token: unknown, env: AuthEnv & { TURNSTILE_SECRET_KEY?: string }): Promise<void> {
  if (!env.TURNSTILE_SECRET_KEY) throw new HttpError(503, 'Registration is not configured.');
  if (typeof token !== 'string' || token.length < 10 || token.length > 2048) {
    throw new HttpError(400, 'Complete the verification challenge.');
  }

  const form = new URLSearchParams({
    secret: env.TURNSTILE_SECRET_KEY,
    response: token
  });
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip) form.set('remoteip', ip);
  const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form
  });
  if (!response.ok) throw new HttpError(503, 'Registration verification is temporarily unavailable.');
  const result = await response.json() as { success?: boolean; hostname?: string; action?: string };
  const expectedHost = new URL(request.url).hostname.toLowerCase();
  if (!result.success || result.hostname?.toLowerCase() !== expectedHost || result.action !== 'register') {
    throw new HttpError(400, 'Verification failed. Please try again.');
  }
}

async function authenticate(db: D1Database, email: string, password: string): Promise<StoredUser | null> {
  const row = await db.prepare(
    `SELECT id, email, name, password_hash AS passwordHash, password_salt AS passwordSalt,
            role, tenant_id AS tenantId, employee_id AS employeeId
     FROM users WHERE email = ? COLLATE NOCASE AND active = 1`
  ).bind(email).first<StoredUser>();

  const candidate = await hashPassword(password, row?.passwordSalt || 'nilelink-invalid-account-salt');
  if (!row || candidate.hash !== row.passwordHash) return null;
  return row;
}

function asSessionUser(row: StoredUser): AuthenticatedUser {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    tenantId: row.tenantId,
    employeeId: row.employeeId
  };
}

export async function handleAuthRequest(request: Request, env: AuthEnv): Promise<Response | null> {
  const { pathname } = new URL(request.url);
  if (!pathname.startsWith('/api/auth/')) return null;

  if (request.method === 'GET' && pathname === '/api/auth/config') {
    return json({ turnstileSiteKey: env.TURNSTILE_SITE_KEY || null });
  }

  if (request.method === 'GET' && pathname === '/api/auth/me') {
    const user = await getSession(request, env);
    return user ? json({ authenticated: true, user }) : json({ authenticated: false }, 401);
  }

  requireSameOrigin(request);
  const db = requireDatabase(env);

  if (request.method === 'POST' && pathname === '/api/auth/change-password') {
    const user = await getSession(request, env);
    if (!user) throw new HttpError(401, 'Authentication required.');
    const body = await readJson<LoginBody & { newPassword?: unknown }>(request);
    await enforceLoginRateLimit(
      db,
      `password-change:${request.headers.get('CF-Connecting-IP') || 'unknown'}:${user.id}`
    );
    const currentPassword = validatePasswordForLogin(body.password);
    const newPassword = validatePassword(body.newPassword);
    if (currentPassword === newPassword) throw new HttpError(400, 'Choose a different new password.');
    if (user.role === 'platform_admin' &&
        (!env.BOOTSTRAP_ADMIN_TOTP_SECRET || typeof body.totp !== 'string' ||
          !(await verifyTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET, body.totp)))) {
      throw new HttpError(401, 'Authenticator code is invalid.');
    }
    const existing = await authenticate(db, user.email, currentPassword);
    if (!existing || existing.id !== user.id) throw new HttpError(401, 'Current password is incorrect.');
    const credentials = await hashPassword(newPassword);
    await db.batch([
      db.prepare(
        `UPDATE users SET password_hash = ?, password_salt = ?
         WHERE id = ? AND password_hash = ? AND password_salt = ?`
      ).bind(credentials.hash, credentials.salt, user.id, existing.passwordHash, existing.passwordSalt),
      db.prepare(
        `INSERT INTO audit_events (id, tenant_id, actor_id, action, entity_type, entity_id, details_json, created_at)
         SELECT ?, NULL, ?, ?, ?, ?, ?, ?
         WHERE EXISTS (SELECT 1 FROM users WHERE id = ? AND password_hash = ? AND password_salt = ?)`
      ).bind(
        id(), user.id, 'auth.password_changed', 'user', user.id, '{}', new Date().toISOString(),
        user.id, credentials.hash, credentials.salt
      ),
      db.prepare(
        `DELETE FROM sessions WHERE user_id = ?
         AND EXISTS (SELECT 1 FROM users WHERE id = ? AND password_hash = ? AND password_salt = ?)`
      ).bind(user.id, user.id, credentials.hash, credentials.salt)
    ]);
    const authenticated = await authenticate(db, user.email, newPassword);
    if (!authenticated || authenticated.id !== user.id) {
      throw new HttpError(409, 'Password could not be changed. Please sign in again.');
    }
    return createSession(db, env, asSessionUser(authenticated));
  }

  if (request.method === 'POST' && pathname === '/api/auth/setup') {
    const body = await readJson<LoginBody & { token?: unknown }>(request);
    const configuredEmail = env.BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
    const configuredToken = env.BOOTSTRAP_ADMIN_TOKEN;
    const totpSecret = env.BOOTSTRAP_ADMIN_TOTP_SECRET;
    if (!configuredEmail || !configuredToken || configuredToken.length < 32 || !totpSecret) {
      throw new HttpError(503, 'Super Admin bootstrap is not configured.');
    }

    const email = validateEmail(body.email);
    await enforceLoginRateLimit(db, `setup:${request.headers.get('CF-Connecting-IP') || 'unknown'}:${email}`);
    const password = validatePassword(body.password);
    if (
      email !== configuredEmail ||
      typeof body.token !== 'string' ||
      !constantTimeToken(body.token, configuredToken)
    ) {
      throw new HttpError(403, 'Bootstrap credentials are invalid.');
    }
    if (typeof body.totp !== 'string' || !(await verifyTotp(totpSecret, body.totp))) {
      throw new HttpError(401, 'Authenticator code is invalid.');
    }

    const existing = await db.prepare('SELECT id FROM users WHERE role = ? LIMIT 1')
      .bind('platform_admin').first<{ id: string }>();
    if (existing) throw new HttpError(409, 'Super Admin setup has already been completed.');

    const credentials = await hashPassword(password);
    const userId = id();
    await db.prepare(
      `INSERT INTO users (id, email, name, password_hash, password_salt, role, tenant_id, active, created_at)
       SELECT ?, ?, 'Platform Super Admin', ?, ?, 'platform_admin', NULL, 1, ?
       WHERE NOT EXISTS (SELECT 1 FROM users WHERE role = 'platform_admin')`
    ).bind(userId, email, credentials.hash, credentials.salt, new Date().toISOString()).run();

    const created = await authenticate(db, email, password);
    if (!created || created.id !== userId) throw new HttpError(409, 'Super Admin setup has already been completed.');
    return createSession(db, env, asSessionUser(created));
  }

  if (request.method === 'POST' && pathname === '/api/auth/login') {
    const body = await readJson<LoginBody>(request);
    const email = validateEmail(body.email);
    const password = validatePasswordForLogin(body.password);
    const subject = `${request.headers.get('CF-Connecting-IP') || 'unknown'}:${email}`;
    await enforceLoginRateLimit(db, subject);

    const user = await authenticate(db, email, password);
    if (!user) throw new HttpError(401, 'Email or password is incorrect.');
    if (user.role === 'platform_admin') {
      if (!env.BOOTSTRAP_ADMIN_TOTP_SECRET || typeof body.totp !== 'string' ||
          !(await verifyTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET, body.totp))) {
        throw new HttpError(401, 'Authenticator code is invalid.');
      }
    }
    return createSession(db, env, asSessionUser(user));
  }

  if (request.method === 'POST' && pathname === '/api/auth/pin') {
    const body = await readJson<{ tenantId?: unknown; pin?: unknown }>(request);
    if (typeof body.tenantId !== 'string' || !/^[a-zA-Z0-9-]{8,64}$/.test(body.tenantId)) {
      throw new HttpError(400, 'A valid tenant is required.');
    }
    if (typeof body.pin !== 'string' || !/^\d{6,8}$/.test(body.pin)) {
      throw new HttpError(400, 'Enter a valid 6–8 digit PIN.');
    }
    if (!env.EMPLOYEE_PIN_PEPPER || env.EMPLOYEE_PIN_PEPPER.length < 32) {
      throw new HttpError(503, 'Employee sign-in is not configured.');
    }
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    await enforceLoginRateLimit(db, `${ip}:${body.tenantId}`);
    const lookupHash = await hmacSha256(env.EMPLOYEE_PIN_PEPPER, `${body.tenantId}:${body.pin}`);
    const employee = await db.prepare(
      `SELECT u.id, u.email, u.name, u.role, u.tenant_id AS tenantId,
              u.employee_id AS employeeId, e.pin_hash AS pinHash, e.pin_salt AS pinSalt
       FROM employees e JOIN users u ON u.id = e.user_id
       JOIN tenants t ON t.id = e.tenant_id
       WHERE e.tenant_id = ? AND e.pin_lookup_hash = ? AND e.active = 1 AND u.active = 1
         AND t.status IN ('ACTIVE', 'TRIAL') AND (t.paid_until IS NULL OR t.paid_until >= ?)`
    ).bind(body.tenantId, lookupHash, new Date().toISOString().slice(0, 10))
      .first<StoredUser & { employeeId: string; pinHash: string; pinSalt: string }>();
    if (!employee) throw new HttpError(401, 'PIN is incorrect.');
    const candidate = await hashPassword(body.pin, employee.pinSalt);
    if (candidate.hash !== employee.pinHash) throw new HttpError(401, 'PIN is incorrect.');
    return createSession(db, env, {
      ...asSessionUser(employee),
      employeeId: employee.employeeId
    });
  }

  if (request.method === 'POST' && pathname === '/api/auth/register') {
    const body = await readJson<RegisterBody>(request);
    await enforceLoginRateLimit(db, `register:${request.headers.get('CF-Connecting-IP') || 'unknown'}`);
    await verifyCaptcha(request, body.turnstileToken, env);
    const email = validateEmail(body.email);
    const password = validatePassword(body.password);
    const ownerName = typeof body.ownerName === 'string' ? body.ownerName.trim() : '';
    if (ownerName.length < 2 || ownerName.length > 120) {
      throw new HttpError(400, 'Owner name must be 2–120 characters.');
    }
    if (typeof body.pin !== 'string' || !/^\d{6,8}$/.test(body.pin)) {
      throw new HttpError(400, 'Owner PIN must contain 6–8 digits.');
    }
    if (!env.EMPLOYEE_PIN_PEPPER || env.EMPLOYEE_PIN_PEPPER.length < 32) {
      throw new HttpError(503, 'Owner terminal access is not configured.');
    }
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 120) {
      throw new HttpError(400, 'Business name must be 2–120 characters.');
    }
    const adminPhone = optionalProfileValue(body.adminPhone, 'Phone', 40);
    const city = optionalProfileValue(body.city, 'City', 120);
    if (typeof body.planId !== 'string' || !/^[a-z0-9-]{1,64}$/.test(body.planId)) {
      throw new HttpError(400, 'A valid subscription plan is required.');
    }
    const name = body.name.trim();
    const plan = await db.prepare(
      'SELECT id, name, max_branches AS maxBranches FROM plans WHERE id = ? AND published = 1'
    ).bind(body.planId).first<{ id: string; name: string; maxBranches: number }>();
    if (!plan) throw new HttpError(400, 'Selected plan is not available.');

    const userId = id();
    const tenantId = id();
    const employeeId = id();
    const organizationId = id();
    const now = new Date();
    const expiry = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const credentials = await hashPassword(password);
    const pinCredentials = await hashPassword(body.pin);
    const pinLookupHash = await hmacSha256(env.EMPLOYEE_PIN_PEPPER, `${tenantId}:${body.pin}`);
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO tenants
           (id, name, admin_email, admin_phone, city, plan_id, status, currency, timezone, created_at, paid_until, organization_id, is_multi_branch)
           VALUES (?, ?, ?, ?, ?, ?, 'TRIAL', ?, ?, ?, ?, ?, 0)`
        ).bind(
          tenantId, name, email, adminPhone, city, plan.id, validCurrency(body.currency), validTimezone(body.timezone),
          now.toISOString(), expiry, organizationId
        ),
        db.prepare(
          `INSERT INTO users
           (id, email, name, password_hash, password_salt, role, tenant_id, active, employee_id, created_at)
           VALUES (?, ?, ?, ?, ?, 'owner', ?, 1, ?, ?)`
        ).bind(userId, email, ownerName, credentials.hash, credentials.salt, tenantId, employeeId, now.toISOString()),
        db.prepare(
          `INSERT INTO employees
           (id, tenant_id, user_id, name, pin_hash, pin_salt, pin_lookup_hash, role, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 'admin', 1, ?, ?)`
        ).bind(
          employeeId, tenantId, userId, ownerName, pinCredentials.hash, pinCredentials.salt,
          pinLookupHash, now.toISOString(), now.toISOString()
        ),
        db.prepare(
          `INSERT INTO audit_events (id, tenant_id, actor_id, action, entity_type, entity_id, created_at)
           VALUES (?, ?, ?, 'tenant.registered', 'tenant', ?, ?)`
        ).bind(id(), tenantId, userId, tenantId, now.toISOString())
      ]);
    } catch (error) {
      const duplicate = await db.prepare('SELECT id FROM users WHERE email = ? COLLATE NOCASE')
        .bind(email).first<{ id: string }>();
      if (duplicate) throw new HttpError(409, 'An account with this email already exists.');
      throw error;
    }

    const session = await createSession(db, env, {
      id: userId,
      email,
      name: ownerName,
      role: 'owner',
      tenantId,
      employeeId
    });
    const tenant = {
      id: tenantId,
      name,
      adminEmail: email,
      adminPhone: adminPhone || undefined,
      city: city || undefined,
      plan: plan.name,
      planId: plan.id,
      accessCode: '',
      paidUntil: expiry,
      status: 'TRIAL',
      currency: validCurrency(body.currency),
      created: now.toISOString().slice(0, 10),
      organizationId,
      isMultiBranch: false
    };
    const sessionData = await session.json() as Record<string, unknown>;
    return json({ ...sessionData as Record<string, unknown>, tenant }, 200, {
      'Set-Cookie': session.headers.get('Set-Cookie') || ''
    });
  }

  if (request.method === 'POST' && pathname === '/api/auth/logout') {
    const token = getCookie(request, 'nl_session');
    if (token) await db.prepare('DELETE FROM sessions WHERE token_hash = ?').bind(await sha256(token)).run();
    return json({ success: true }, 200, { 'Set-Cookie': clearSessionCookie() });
  }

  return json({ error: 'Not found.' }, 404);
}

function getCookie(request: Request, name: string): string | null {
  for (const part of (request.headers.get('cookie') || '').split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}

function constantTimeToken(value: string, expected: string): boolean {
  let difference = value.length ^ expected.length;
  const length = Math.max(value.length, expected.length);
  for (let i = 0; i < length; i++) difference |= (value.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0);
  return difference === 0;
}

function validatePasswordForLogin(value: unknown): string {
  if (typeof value !== 'string' || value.length < 1 || value.length > 256) {
    throw new HttpError(400, 'A password is required.');
  }
  return value;
}

function validCurrency(value: unknown): string {
  if (value === undefined) return 'USD';
  if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) throw new HttpError(400, 'Currency must be an ISO 4217 code.');
  return value;
}

function validTimezone(value: unknown): string {
  if (value === undefined) return 'UTC';
  if (typeof value !== 'string' || value.length > 64) throw new HttpError(400, 'Invalid time zone.');
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value });
  } catch {
    throw new HttpError(400, 'Invalid time zone.');
  }
  return value;
}

function optionalProfileValue(value: unknown, field: string, maxLength: number): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > maxLength) {
    throw new HttpError(400, `Invalid ${field.toLowerCase()}.`);
  }
  const normalized = value.trim();
  return normalized || null;
}
