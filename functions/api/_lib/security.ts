export interface D1Result<T> {
  results: T[];
  success: boolean;
}

export interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T>(): Promise<T | null>;
  all<T>(): Promise<D1Result<T>>;
  run(): Promise<unknown>;
}

export interface D1Database {
  prepare(sql: string): D1Statement;
  batch(statements: D1Statement[]): Promise<unknown[]>;
}

export interface AuthEnv {
  DB?: D1Database;
  BOOTSTRAP_ADMIN_EMAIL?: string;
  BOOTSTRAP_ADMIN_TOKEN?: string;
  BOOTSTRAP_ADMIN_TOTP_SECRET?: string;
  TURNSTILE_SECRET_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  SESSION_TTL_HOURS?: string;
  EMPLOYEE_PIN_PEPPER?: string;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: 'platform_admin' | 'owner' | 'admin' | 'manager' | 'teamlead' | 'staff';
  tenantId: string | null;
  employeeId?: string | null;
}

export class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

const encoder = new TextEncoder();
const PBKDF2_ITERATIONS = 310_000;
const MAX_BODY_BYTES = 32_768;

export function json(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  const headers = new Headers(extraHeaders);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'same-origin');
  return new Response(JSON.stringify(data), { status, headers });
}

export function requireDatabase(env: AuthEnv): D1Database {
  if (!env.DB) throw new HttpError(503, 'Database is not configured.');
  return env.DB;
}

export async function readJson<T>(request: Request, maxBytes = MAX_BODY_BYTES): Promise<T> {
  const contentLength = Number(request.headers.get('content-length') || 0);
  if (contentLength > maxBytes) throw new HttpError(413, 'Request body is too large.');
  const text = await request.text();
  if (encoder.encode(text).byteLength > maxBytes) throw new HttpError(413, 'Request body is too large.');
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body.');
  }
}

export function requireSameOrigin(request: Request): void {
  const origin = request.headers.get('origin');
  if (!origin || new URL(origin).origin !== new URL(request.url).origin) {
    throw new HttpError(403, 'Cross-origin requests are not allowed.');
  }
  const fetchSite = request.headers.get('sec-fetch-site');
  if (fetchSite && fetchSite !== 'same-origin' && fetchSite !== 'none') {
    throw new HttpError(403, 'Cross-site requests are not allowed.');
  }
}

export function validateEmail(value: unknown): string {
  if (typeof value !== 'string' || value.length > 254) throw new HttpError(400, 'A valid email is required.');
  const email = value.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'A valid email is required.');
  return email;
}

export function validatePassword(value: unknown): string {
  if (typeof value !== 'string' || value.length < 14 || value.length > 256) {
    throw new HttpError(400, 'Password must be 14–256 characters.');
  }
  return value;
}

export async function hashPassword(password: string, salt = randomToken(16)): Promise<{ hash: string; salt: string }> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    key,
    256
  );
  return { hash: toHex(new Uint8Array(bits)), salt };
}

export function randomToken(bytes = 32): string {
  const values = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...values)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256(value: string): Promise<string> {
  return toHex(new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value))));
}

export async function hmacSha256(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return toHex(new Uint8Array(signature));
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

export function constantTimeEqual(left: string, right: string): boolean {
  const a = encoder.encode(left);
  const b = encoder.encode(right);
  let mismatch = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let i = 0; i < length; i++) mismatch |= (a[i % Math.max(a.length, 1)] || 0) ^ (b[i % Math.max(b.length, 1)] || 0);
  return mismatch === 0;
}

function cookieValue(request: Request, name: string): string | null {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return value.join('=') || null;
  }
  return null;
}

export function sessionCookie(token: string, maxAge: number): string {
  return `nl_session=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export function clearSessionCookie(): string {
  return 'nl_session=; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=0';
}

export async function createSession(db: D1Database, env: AuthEnv, user: AuthenticatedUser): Promise<Response> {
  const token = randomToken();
  const hours = Math.max(1, Math.min(24, Number(env.SESSION_TTL_HOURS) || 8));
  const now = new Date();
  const expires = new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  await db.prepare(
    'INSERT INTO sessions (token_hash, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).bind(await sha256(token), user.id, now.toISOString(), expires).run();
  return json({ success: true, user }, 200, { 'Set-Cookie': sessionCookie(token, hours * 60 * 60) });
}

export async function getSession(request: Request, env: AuthEnv): Promise<AuthenticatedUser | null> {
  const token = cookieValue(request, 'nl_session');
  if (!token) return null;
  const db = requireDatabase(env);
  const row = await db.prepare(
    `SELECT u.id, u.email, u.name, u.role, u.tenant_id AS tenantId, u.employee_id AS employeeId
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = ? AND s.expires_at > ? AND u.active = 1`
  ).bind(await sha256(token), new Date().toISOString()).first<AuthenticatedUser>();
  if (row && row.role !== 'platform_admin') {
    const today = new Date().toISOString().slice(0, 10);
    const tenant = await db.prepare(
      `SELECT id FROM tenants WHERE id = ? AND status IN ('ACTIVE', 'TRIAL')
       AND (paid_until IS NULL OR paid_until >= ?)`
    ).bind(row.tenantId, today).first<{ id: string }>();
    if (!tenant) return null;
  }
  return row || null;
}

export async function requireSession(request: Request, env: AuthEnv): Promise<AuthenticatedUser> {
  const user = await getSession(request, env);
  if (!user) throw new HttpError(401, 'Authentication required.');
  return user;
}

export function requireRole(user: AuthenticatedUser, roles: AuthenticatedUser['role'][]): void {
  if (!roles.includes(user.role)) throw new HttpError(403, 'You are not allowed to perform this action.');
}

export async function requireTenantRole(
  request: Request,
  env: AuthEnv,
  tenantId: string,
  roles: AuthenticatedUser['role'][]
): Promise<AuthenticatedUser> {
  const user = await requireSession(request, env);
  if (user.role === 'platform_admin') return user;
  if (!user.tenantId || user.tenantId !== tenantId || !roles.includes(user.role)) {
    throw new HttpError(403, 'You are not allowed to access this tenant.');
  }
  const tenant = await requireDatabase(env).prepare(
    'SELECT status, paid_until AS paidUntil FROM tenants WHERE id = ?'
  ).bind(tenantId).first<{ status: string; paidUntil: string | null }>();
  const today = new Date().toISOString().slice(0, 10);
  if (!tenant || !['ACTIVE', 'TRIAL'].includes(tenant.status) ||
      (tenant.paidUntil !== null && tenant.paidUntil < today)) {
    throw new HttpError(403, 'This tenant is not active.');
  }
  return user;
}

export async function enforceLoginRateLimit(db: D1Database, subject: string): Promise<void> {
  const subjectHash = await sha256(subject);
  const nowSeconds = Math.floor(Date.now() / 1000);
  const attempt = await db.prepare(
    `INSERT INTO auth_attempts (subject_hash, window_started_at, attempts) VALUES (?, ?, 1)
     ON CONFLICT(subject_hash) DO UPDATE SET
       attempts = CASE
         WHEN excluded.window_started_at - auth_attempts.window_started_at >= 900 THEN 1
         ELSE auth_attempts.attempts + 1
       END,
       window_started_at = CASE
         WHEN excluded.window_started_at - auth_attempts.window_started_at >= 900 THEN excluded.window_started_at
         ELSE auth_attempts.window_started_at
       END
     RETURNING attempts`
  ).bind(subjectHash, nowSeconds).first<{ attempts: number }>();
  if (!attempt || attempt.attempts > 10) throw new HttpError(429, 'Too many attempts. Try again later.');
}

function decodeBase32(secret: string): Uint8Array {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const char of secret.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '')) {
    const value = alphabet.indexOf(char);
    if (value < 0) throw new HttpError(503, 'Authenticator configuration is invalid.');
    bits += value.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
  return new Uint8Array(bytes);
}

export async function verifyTotp(secret: string, candidate: string, now = Date.now()): Promise<boolean> {
  if (!/^\d{6}$/.test(candidate)) return false;
  const decodedSecret = decodeBase32(secret);
  const secretBuffer = new ArrayBuffer(decodedSecret.length);
  new Uint8Array(secretBuffer).set(decodedSecret);
  const key = await crypto.subtle.importKey(
    'raw', secretBuffer, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']
  );
  const counter = Math.floor(now / 30_000);
  for (let offset = -1; offset <= 1; offset++) {
    const buffer = new ArrayBuffer(8);
    new DataView(buffer).setBigUint64(0, BigInt(counter + offset));
    const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, buffer));
    const index = digest[digest.length - 1] & 0x0f;
    const number = ((digest[index] & 0x7f) << 24) |
      (digest[index + 1] << 16) | (digest[index + 2] << 8) | digest[index + 3];
    const code = String(number % 1_000_000).padStart(6, '0');
    if (constantTimeEqual(code, candidate)) return true;
  }
  return false;
}

export function id(): string {
  return crypto.randomUUID();
}
