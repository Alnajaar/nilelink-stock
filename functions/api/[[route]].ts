import { handleAuthRequest } from './_lib/auth';
import {
  AuthEnv,
  AuthenticatedUser,
  D1Database,
  HttpError,
  hashPassword,
  id,
  json,
  readJson,
  requireDatabase,
  requireRole,
  requireSameOrigin,
  requireSession,
  requireTenantRole,
  hmacSha256
} from './_lib/security';

interface Env extends AuthEnv {}

interface PlanRow {
  id: string;
  name: string;
  priceMinor: number;
  currency: string;
  billingPeriod: 'monthly' | 'quarterly' | 'annual' | 'lifetime';
  maxTerminals: number;
  maxItems: number;
  maxBranches: number;
  description: string;
  featuresJson: string;
  popular: number;
  badge: string | null;
  idealFor: string | null;
  published: number;
}

interface TenantRow {
  id: string;
  name: string;
  adminEmail: string;
  adminPhone: string | null;
  city: string | null;
  planId: string;
  plan: string;
  paidUntil: string | null;
  status: 'ACTIVE' | 'EXPIRED' | 'TRIAL' | 'SUSPENDED';
  currency: string;
  created: string;
  organizationId: string;
  isMultiBranch: number;
}

const PLAN_SELECT = `SELECT p.id, p.name, p.price_minor AS priceMinor, p.currency,
  p.billing_period AS billingPeriod, p.max_terminals AS maxTerminals,
  p.max_items AS maxItems, p.max_branches AS maxBranches, p.description,
  p.features_json AS featuresJson, 0 AS popular, NULL AS badge, NULL AS idealFor,
  p.published FROM plans p`;

const TENANT_SELECT = `SELECT t.id, t.name, t.admin_email AS adminEmail,
  t.admin_phone AS adminPhone, t.city, t.plan_id AS planId, p.name AS plan,
  t.paid_until AS paidUntil, t.status, t.currency, t.created_at AS created,
  t.organization_id AS organizationId, t.is_multi_branch AS isMultiBranch
  FROM tenants t JOIN plans p ON p.id = t.plan_id`;

export async function onRequest(context: {
  request: Request;
  env: Env;
  params: unknown;
}): Promise<Response> {
  const { request, env } = context;
  const url = new URL(request.url);

  try {
    if (request.method === 'OPTIONS') {
      return json({ error: 'Cross-origin requests are not supported.' }, 405);
    }

    const authResponse = await handleAuthRequest(request, env);
    if (authResponse) return authResponse;

    if (url.pathname === '/api/health' && request.method === 'GET') {
      let databaseReady = false;
      try {
        const probe = await requireDatabase(env).prepare(
          `SELECT COUNT(*) AS count FROM sqlite_master
           WHERE type = 'table' AND name IN ('users', 'tenants', 'plans', 'time_entries', 'inventory_items')`
        ).first<{ count: number }>();
        databaseReady = Number(probe?.count) === 5;
      } catch (error) {
        console.error('Health check could not verify D1 readiness.', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      const authConfigured = Boolean(
        env.BOOTSTRAP_ADMIN_EMAIL && env.BOOTSTRAP_ADMIN_TOKEN && env.BOOTSTRAP_ADMIN_TOKEN.length >= 32 &&
        env.BOOTSTRAP_ADMIN_TOTP_SECRET && env.EMPLOYEE_PIN_PEPPER && env.EMPLOYEE_PIN_PEPPER.length >= 32 &&
        env.TURNSTILE_SECRET_KEY && env.TURNSTILE_SITE_KEY
      );
      const ready = Boolean(env.DB) && databaseReady && authConfigured;
      return json({
        status: ready ? 'ready' : 'degraded',
        databaseConfigured: Boolean(env.DB),
        databaseReady,
        authConfigured,
        timestamp: new Date().toISOString()
      }, ready ? 200 : 503);
    }

    if (url.pathname === '/api/plans' && request.method === 'GET') {
      const db = requireDatabase(env);
      const { results } = await db.prepare(`${PLAN_SELECT} WHERE p.published = 1 ORDER BY p.price_minor`)
        .all<PlanRow>();
      return json({ success: true, plans: results.map(publicPlan) });
    }

    if (url.pathname === '/api/content' && request.method === 'GET') {
      const db = requireDatabase(env);
      const content = await db.prepare(
        'SELECT published_json AS content, version FROM site_content WHERE id = ?'
      ).bind('landing').first<{ content: string; version: number }>();
      if (!content) throw new HttpError(404, 'Published content was not found.');
      return json({ success: true, content: JSON.parse(content.content), version: content.version });
    }

    if (url.pathname === '/api/content/draft' && request.method === 'GET') {
      const user = await requireSession(request, env);
      requireRole(user, ['platform_admin']);
      const content = await requireDatabase(env).prepare(
        'SELECT draft_json AS content, version FROM site_content WHERE id = ?'
      ).bind('landing').first<{ content: string; version: number }>();
      if (!content) throw new HttpError(404, 'Site content was not found.');
      return json({ success: true, content: JSON.parse(content.content), version: content.version });
    }

    if (url.pathname === '/api/tenant/lookup' && request.method === 'GET') {
      const tenantId = url.searchParams.get('tenantId') || '';
      if (!/^[0-9a-f-]{36}$/i.test(tenantId)) throw new HttpError(404, 'Workspace was not found.');
      const tenant = await requireDatabase(env).prepare(
        `SELECT t.id, t.name, t.city, t.plan_id AS planId, p.name AS plan,
          t.paid_until AS paidUntil, t.status, t.currency, t.created_at AS created,
          t.organization_id AS organizationId, t.is_multi_branch AS isMultiBranch
         FROM tenants t JOIN plans p ON p.id = t.plan_id
         WHERE t.id = ? AND t.status IN ('ACTIVE', 'TRIAL')
           AND (t.paid_until IS NULL OR t.paid_until >= ?)`
      ).bind(tenantId, new Date().toISOString().slice(0, 10))
        .first<Omit<TenantRow, 'adminEmail' | 'adminPhone'>>();
      if (!tenant) throw new HttpError(404, 'Workspace was not found or is inactive.');
      return json({ success: true, tenant: {
        id: tenant.id,
        name: tenant.name,
        city: tenant.city || undefined,
        planId: tenant.planId,
        plan: tenant.plan,
        paidUntil: tenant.paidUntil || '',
        status: tenant.status,
        currency: tenant.currency,
        created: tenant.created.slice(0, 10),
        organizationId: tenant.organizationId,
        isMultiBranch: Boolean(tenant.isMultiBranch)
      } });
    }

    if (url.pathname === '/api/tenants' && request.method === 'GET') {
      const user = await requireSession(request, env);
      const db = requireDatabase(env);
      if (user.role === 'platform_admin') {
        const { results } = await db.prepare(`${TENANT_SELECT} ORDER BY t.created_at DESC`).all<TenantRow>();
        return json({ success: true, tenants: results.map(publicTenant) });
      }
      if (!user.tenantId) throw new HttpError(403, 'This account is not assigned to a tenant.');
      const tenant = await db.prepare(`${TENANT_SELECT} WHERE t.id = ?`).bind(user.tenantId).first<TenantRow>();
      return json({ success: true, tenants: tenant ? [publicTenant(tenant)] : [] });
    }

    if (url.pathname === '/api/tenants/register' && request.method === 'POST') {
      throw new HttpError(410, 'Use /api/auth/register to create a tenant account.');
    }

    if (url.pathname.startsWith('/api/tenants/')) {
      requireSameOrigin(request);
      const tenantId = decodeURIComponent(url.pathname.slice('/api/tenants/'.length));
      if (!tenantId || tenantId.includes('/')) throw new HttpError(404, 'Tenant was not found.');
      const actor = await requireTenantRole(request, env, tenantId, ['owner', 'admin']);
      if (request.method !== 'PUT') throw new HttpError(405, 'Method not allowed.');
      return await updateTenant(requireDatabase(env), tenantId, request, actor);
    }

    if (url.pathname === '/api/superadmin/analytics' && request.method === 'GET') {
      const user = await requireSession(request, env);
      requireRole(user, ['platform_admin']);
      const db = requireDatabase(env);
      const row = await db.prepare(
        `SELECT COUNT(*) AS totalTenants,
          SUM(CASE WHEN status IN ('ACTIVE', 'TRIAL') THEN 1 ELSE 0 END) AS activeTenants
         FROM tenants`
      ).first<{ totalTenants: number; activeTenants: number }>();
      const revenue = await db.prepare(
        `SELECT SUM(p.price_minor) AS monthlyRecurringRevenueMinor
         FROM tenants t JOIN plans p ON p.id = t.plan_id
         WHERE t.status = 'ACTIVE' AND p.billing_period = 'monthly'`
      ).first<{ monthlyRecurringRevenueMinor: number | null }>();
      return json({
        success: true,
        analytics: {
          totalTenants: row?.totalTenants || 0,
          activeTenants: row?.activeTenants || 0,
          monthlyRecurringRevenueMinor: revenue?.monthlyRecurringRevenueMinor || 0
        }
      });
    }

    if (url.pathname.startsWith('/api/plans/')) {
      requireSameOrigin(request);
      const user = await requireSession(request, env);
      requireRole(user, ['platform_admin']);
      if (request.method !== 'PUT') throw new HttpError(405, 'Method not allowed.');
      const planId = decodeURIComponent(url.pathname.slice('/api/plans/'.length));
      return await updatePlan(requireDatabase(env), planId, request, user);
    }

    if (url.pathname === '/api/plans' && request.method === 'POST') {
      requireSameOrigin(request);
      const user = await requireSession(request, env);
      requireRole(user, ['platform_admin']);
      return await createPlan(requireDatabase(env), request, user);
    }

    if (url.pathname === '/api/content' && request.method === 'PUT') {
      requireSameOrigin(request);
      const user = await requireSession(request, env);
      requireRole(user, ['platform_admin']);
      return await updateContent(requireDatabase(env), request, user);
    }

    if (url.pathname === '/api/inventory' && request.method === 'GET') {
      const tenantId = url.searchParams.get('tenantId') || '';
      const user = await requireTenantRole(request, env, tenantId, ['owner', 'admin', 'manager', 'teamlead', 'staff']);
      const { results } = await requireDatabase(env).prepare(
        'SELECT data_json AS dataJson FROM inventory_items WHERE tenant_id = ? ORDER BY name COLLATE NOCASE'
      ).bind(tenantId).all<{ dataJson: string }>();
      return json({ success: true, items: results.map(row => JSON.parse(row.dataJson)) });
    }

    if (url.pathname === '/api/inventory' && request.method === 'PUT') {
      requireSameOrigin(request);
      const body = await readJson<{ tenantId?: unknown; items?: unknown; operationIds?: unknown }>(request, 512_000);
      if (typeof body.tenantId !== 'string' || !Array.isArray(body.items) ||
          body.items.length < 1 || body.items.length > 5_000 ||
          (body.operationIds !== undefined && (!Array.isArray(body.operationIds) || body.operationIds.length > 1_000))) {
        throw new HttpError(400, 'A tenant and 1–5,000 inventory items are required.');
      }
      const operationIds = (body.operationIds || []).map(value => {
        if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(value)) {
          throw new HttpError(400, 'Invalid inventory snapshot operation ID.');
        }
        return value;
      });
      if (new Set(operationIds).size !== operationIds.length) {
        throw new HttpError(400, 'Inventory snapshot operation IDs must be unique.');
      }
      const user = await requireTenantRole(request, env, body.tenantId, ['owner', 'admin', 'manager']);
      return await saveInventory(requireDatabase(env), user.tenantId || body.tenantId, user, body.items, operationIds);
    }

    if (url.pathname === '/api/sync' && request.method === 'POST') {
      requireSameOrigin(request);
      const body = await readJson<{ cafeId?: unknown; actions?: unknown }>(request, 256_000);
      if (typeof body.cafeId !== 'string' || !Array.isArray(body.actions) ||
          body.actions.length < 1 || body.actions.length > 20) {
        throw new HttpError(400, 'A tenant and 1–20 sync operations are required.');
      }
      const user = await requireTenantRole(request, env, body.cafeId, ['owner', 'admin', 'manager', 'teamlead', 'staff']);
      return await persistSyncOperations(requireDatabase(env), body.cafeId, user, body.actions);
    }

    if (url.pathname.startsWith('/api/workforce/')) {
      return await workforceRequest(request, env, url);
    }

    throw new HttpError(404, 'API route was not found.');
  } catch (error) {
    if (error instanceof HttpError) return json({ error: error.message }, error.status);
    console.error('API request failed', {
      path: url.pathname,
      method: request.method,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    return json({ error: 'The request could not be completed.' }, 500);
  }
}

function publicPlan(row: PlanRow) {
  let features: string[];
  try {
    const parsed: unknown = JSON.parse(row.featuresJson);
    features = Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    features = [];
  }
  return {
    id: row.id,
    name: row.name,
    price: row.priceMinor / 100,
    currency: row.currency,
    billingPeriod: row.billingPeriod,
    maxTerminals: row.maxTerminals,
    maxItems: row.maxItems,
    maxBranches: row.maxBranches,
    description: row.description,
    features,
    popular: Boolean(row.popular),
    badge: row.badge || undefined,
    idealFor: row.idealFor || undefined
  };
}

function publicTenant(row: TenantRow) {
  return {
    id: row.id,
    name: row.name,
    adminEmail: row.adminEmail,
    adminPhone: row.adminPhone || undefined,
    city: row.city || undefined,
    planId: row.planId,
    plan: row.plan,
    paidUntil: row.paidUntil || '',
    status: row.status,
    currency: row.currency,
    created: row.created.slice(0, 10),
    organizationId: row.organizationId,
    isMultiBranch: Boolean(row.isMultiBranch)
  };
}

async function updateTenant(
  db: D1Database,
  tenantId: string,
  request: Request,
  actor: AuthenticatedUser
): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const allowed = actor.role === 'platform_admin'
    ? ['name', 'adminEmail', 'adminPhone', 'city', 'planId', 'paidUntil', 'status', 'currency']
    : ['name', 'adminPhone', 'city', 'currency'];
  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some(key => !allowed.includes(key))) {
    throw new HttpError(400, 'Tenant update contains unsupported fields.');
  }
  const fields: string[] = [];
  const values: unknown[] = [];
  const columnMap: Record<string, string> = {
    name: 'name', adminEmail: 'admin_email', adminPhone: 'admin_phone',
    city: 'city', planId: 'plan_id', paidUntil: 'paid_until', status: 'status', currency: 'currency'
  };
  for (const key of keys) {
    const value = body[key];
    if (typeof value !== 'string' || value.length > 254) throw new HttpError(400, `Invalid ${key}.`);
    if (key === 'name' && value.trim().length < 2) throw new HttpError(400, 'Invalid business name.');
    if (key === 'status' && !['ACTIVE', 'EXPIRED', 'TRIAL', 'SUSPENDED'].includes(value)) {
      throw new HttpError(400, 'Invalid tenant status.');
    }
    if (key === 'adminEmail' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      throw new HttpError(400, 'Invalid email address.');
    }
    if (key === 'currency' && !/^[A-Z]{3}$/.test(value)) throw new HttpError(400, 'Invalid currency code.');
    if (key === 'paidUntil' && value !== '' && !isDate(value)) throw new HttpError(400, 'Invalid subscription date.');
    if (key === 'planId') {
      const plan = await db.prepare('SELECT id FROM plans WHERE id = ?').bind(value).first<{ id: string }>();
      if (!plan) throw new HttpError(400, 'The selected subscription plan was not found.');
    }
    fields.push(`${columnMap[key]} = ?`);
    values.push(value);
  }

  const result = await db.prepare(`UPDATE tenants SET ${fields.join(', ')} WHERE id = ?`)
    .bind(...values, tenantId).run();
  const tenant = await db.prepare(`${TENANT_SELECT} WHERE t.id = ?`).bind(tenantId).first<TenantRow>();
  if (!tenant || !result) throw new HttpError(404, 'Tenant was not found.');
  await audit(db, actor.id, tenantId, 'tenant.updated', 'tenant', tenantId, { fields: keys });
  return json({ success: true, tenant: publicTenant(tenant) });
}

async function updatePlan(db: D1Database, planId: string, request: Request, actor: AuthenticatedUser): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const fields: string[] = [];
  const values: unknown[] = [];
  const updates: Record<string, string> = {
    name: 'name', price: 'price_minor', currency: 'currency', billingPeriod: 'billing_period',
    maxTerminals: 'max_terminals', maxItems: 'max_items', maxBranches: 'max_branches',
    description: 'description', published: 'published', features: 'features_json'
  };
  for (const [key, column] of Object.entries(updates)) {
    if (!(key in body)) continue;
    let value = body[key];
    if (key === 'price') {
      if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
        throw new HttpError(400, 'Invalid plan price.');
      }
      value = Math.round(value * 100);
    } else if (['maxTerminals', 'maxItems', 'maxBranches'].includes(key)) {
      if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 1_000_000) {
        throw new HttpError(400, `Invalid ${key}.`);
      }
    } else if (key === 'billingPeriod') {
      if (!['monthly', 'quarterly', 'annual', 'lifetime'].includes(String(value))) {
        throw new HttpError(400, 'Invalid billing period.');
      }
    } else if (key === 'currency') {
      if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) throw new HttpError(400, 'Invalid currency code.');
    } else if (key === 'published') {
      value = value === true ? 1 : value === false ? 0 : value;
      if (value !== 0 && value !== 1) throw new HttpError(400, 'Invalid published flag.');
    } else if (key === 'features') {
      if (!Array.isArray(value) || value.length > 30 ||
          value.some(item => typeof item !== 'string' || item.length > 120)) {
        throw new HttpError(400, 'Invalid plan features.');
      }
      value = JSON.stringify(value);
    } else if (typeof value !== 'string' || value.length > 2000) {
      throw new HttpError(400, `Invalid ${key}.`);
    }
    fields.push(`${column} = ?`);
    values.push(value);
  }
  if (!fields.length) throw new HttpError(400, 'No supported plan fields were supplied.');
  fields.push('updated_at = ?');
  values.push(new Date().toISOString(), planId);
  await db.prepare(`UPDATE plans SET ${fields.join(', ')} WHERE id = ?`).bind(...values).run();
  const plan = await db.prepare(`${PLAN_SELECT} WHERE p.id = ?`).bind(planId).first<PlanRow>();
  if (!plan) throw new HttpError(404, 'Plan was not found.');
  await audit(db, actor.id, null, 'plan.updated', 'plan', planId, body);
  return json({ success: true, plan: publicPlan(plan) });
}

async function createPlan(db: D1Database, request: Request, actor: AuthenticatedUser): Promise<Response> {
  const body = await readJson<Record<string, unknown>>(request);
  const idValue = typeof body.id === 'string' && /^[a-z0-9-]{1,64}$/.test(body.id) ? body.id : `plan-${id()}`;
  const name = boundedString(body.name, 'name', 2, 100);
  const price = body.price;
  const billingPeriod = body.billingPeriod;
  const maxTerminals = positiveInteger(body.maxTerminals, 'maxTerminals');
  const maxItems = positiveInteger(body.maxItems, 'maxItems');
  const maxBranches = positiveInteger(body.maxBranches, 'maxBranches');
  const currency = body.currency === undefined ? 'USD' : body.currency;
  if (typeof currency !== 'string' || !/^[A-Z]{3}$/.test(currency)) {
    throw new HttpError(400, 'Invalid currency code.');
  }
  if (typeof price !== 'number' || price < 0 || price > 1_000_000 || !Number.isFinite(price)) throw new HttpError(400, 'Invalid plan price.');
  if (!['monthly', 'quarterly', 'annual', 'lifetime'].includes(String(billingPeriod))) throw new HttpError(400, 'Invalid billing period.');
  const description = typeof body.description === 'string' ? body.description.slice(0, 2000) : '';
  const features = Array.isArray(body.features)
    ? body.features.filter((item): item is string => typeof item === 'string').slice(0, 30).map(item => item.slice(0, 120))
    : [];
  const now = new Date().toISOString();
  await db.prepare(
    `INSERT INTO plans (id, name, price_minor, currency, billing_period, max_terminals, max_items,
       max_branches, description, features_json, published, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`
  ).bind(
    idValue, name, Math.round(price * 100), currency, billingPeriod,
    maxTerminals, maxItems, maxBranches, description, JSON.stringify(features), now
  ).run();
  await audit(db, actor.id, null, 'plan.created', 'plan', idValue, { name });
  const plan = await db.prepare(`${PLAN_SELECT} WHERE p.id = ?`).bind(idValue).first<PlanRow>();
  return json({ success: true, plan: plan && publicPlan(plan) }, 201);
}

async function updateContent(db: D1Database, request: Request, actor: AuthenticatedUser): Promise<Response> {
  const body = await readJson<{ content?: unknown; publish?: unknown }>(request, 32_768);
  if (!body.content || typeof body.content !== 'object' || Array.isArray(body.content)) {
    throw new HttpError(400, 'Content must be an object.');
  }
  const content = body.content as Record<string, unknown>;
  const logoUrl = content.logoUrl === undefined ? '' : content.logoUrl;
  if (typeof logoUrl !== 'string' || logoUrl.length > 2_048 ||
      (logoUrl !== '' && !logoUrl.startsWith('/') && !/^https:\/\/[^\\\s]+$/i.test(logoUrl)) ||
      logoUrl.startsWith('//') || logoUrl.includes('\\') || /[\u0000-\u001f]/.test(logoUrl)) {
    throw new HttpError(400, 'Logo URL must be a same-origin path or an HTTPS URL.');
  }
  const features = Array.isArray(content.features) ? content.features : [];
  if (features.length > 20 || features.some(item => typeof item !== 'string' || item.trim().length > 120)) {
    throw new HttpError(400, 'Invalid public feature list.');
  }
  const featureCards = Array.isArray(content.featureCards) ? content.featureCards : [];
  if (featureCards.length > 12 || featureCards.some(card =>
    !card || typeof card !== 'object' || Array.isArray(card) ||
    typeof (card as Record<string, unknown>).title !== 'string' ||
    typeof (card as Record<string, unknown>).description !== 'string' ||
    ((card as Record<string, string>).title).trim().length < 2 ||
    ((card as Record<string, string>).title).trim().length > 120 ||
    ((card as Record<string, string>).description).trim().length < 2 ||
    ((card as Record<string, string>).description).trim().length > 500
  )) {
    throw new HttpError(400, 'Invalid public feature cards.');
  }
  const marketingMetrics = content.marketingMetrics;
  if (!Array.isArray(marketingMetrics) || marketingMetrics.length > 6 || marketingMetrics.some(metric =>
    !metric || typeof metric !== 'object' || Array.isArray(metric) ||
    typeof (metric as Record<string, unknown>).value !== 'string' ||
    typeof (metric as Record<string, unknown>).label !== 'string' ||
    ((metric as Record<string, string>).value).trim().length < 1 ||
    ((metric as Record<string, string>).value).trim().length > 40 ||
    ((metric as Record<string, string>).label).trim().length < 2 ||
    ((metric as Record<string, string>).label).trim().length > 120
  )) {
    throw new HttpError(400, 'Invalid public marketing metrics.');
  }
  const multiBranchBenefits = content.multiBranchBenefits;
  if (!Array.isArray(multiBranchBenefits) || multiBranchBenefits.length > 8 || multiBranchBenefits.some(benefit =>
    !benefit || typeof benefit !== 'object' || Array.isArray(benefit) ||
    typeof (benefit as Record<string, unknown>).title !== 'string' ||
    typeof (benefit as Record<string, unknown>).description !== 'string' ||
    ((benefit as Record<string, string>).title).trim().length < 2 ||
    ((benefit as Record<string, string>).title).trim().length > 120 ||
    ((benefit as Record<string, string>).description).trim().length < 2 ||
    ((benefit as Record<string, string>).description).trim().length > 500
  )) {
    throw new HttpError(400, 'Invalid multi-branch benefits.');
  }
  const branchPreview = content.branchPreview;
  if (!branchPreview || typeof branchPreview !== 'object' || Array.isArray(branchPreview)) {
    throw new HttpError(400, 'Invalid multi-branch preview content.');
  }
  const preview = branchPreview as Record<string, unknown>;
  const pageLabels = content.pageLabels;
  if (!pageLabels || typeof pageLabels !== 'object' || Array.isArray(pageLabels)) {
    throw new HttpError(400, 'Invalid public page labels.');
  }
  const labels = pageLabels as Record<string, unknown>;
  const clean = {
    brandName: boundedString(content.brandName, 'brand name', 2, 80),
    logoUrl: logoUrl.trim(),
    tagline: boundedString(content.tagline, 'tagline', 2, 160),
    heroEyebrow: boundedString(content.heroEyebrow, 'hero eyebrow', 2, 180),
    headline: boundedString(content.headline, 'headline', 2, 180),
    description: boundedString(content.description, 'description', 2, 1000),
    features: features.map(item => (item as string).trim()).filter(Boolean),
    primaryCta: boundedString(content.primaryCta, 'primary call to action', 2, 80),
    pricingEyebrow: boundedString(content.pricingEyebrow, 'pricing eyebrow', 2, 120),
    pricingHeadline: boundedString(content.pricingHeadline, 'pricing headline', 2, 180),
    pricingDescription: boundedString(content.pricingDescription, 'pricing description', 2, 1000),
    multiBranchEyebrow: boundedString(content.multiBranchEyebrow, 'branch section eyebrow', 2, 120),
    multiBranchHeadline: boundedString(content.multiBranchHeadline, 'branch section headline', 2, 180),
    multiBranchDescription: boundedString(content.multiBranchDescription, 'branch section description', 2, 1000),
    featuresEyebrow: boundedString(content.featuresEyebrow, 'features eyebrow', 2, 120),
    featuresHeadline: boundedString(content.featuresHeadline, 'features headline', 2, 180),
    featuresDescription: boundedString(content.featuresDescription, 'features description', 2, 1000),
    featureCards: featureCards.map(card => ({
      title: (card as Record<string, string>).title.trim(),
      description: (card as Record<string, string>).description.trim()
    })),
    marketingMetrics: marketingMetrics.map(metric => ({
      value: boundedString((metric as Record<string, unknown>).value, 'metric value', 1, 40),
      label: boundedString((metric as Record<string, unknown>).label, 'metric label', 2, 120)
    })),
    multiBranchBenefits: multiBranchBenefits.map(benefit => ({
      title: boundedString((benefit as Record<string, unknown>).title, 'benefit title', 2, 120),
      description: boundedString((benefit as Record<string, unknown>).description, 'benefit description', 2, 500)
    })),
    branchPreview: {
      organizationName: boundedString(preview.organizationName, 'organization name', 2, 180),
      activeBranchesLabel: boundedString(preview.activeBranchesLabel, 'active branches label', 2, 180),
      flagshipName: boundedString(preview.flagshipName, 'flagship branch name', 2, 180),
      flagshipDetails: boundedString(preview.flagshipDetails, 'flagship branch details', 2, 180),
      secondBranchName: boundedString(preview.secondBranchName, 'second branch name', 2, 180),
      secondBranchDetails: boundedString(preview.secondBranchDetails, 'second branch details', 2, 180),
      singleBranchNotice: boundedString(preview.singleBranchNotice, 'single-branch notice', 2, 180),
      singleBranchName: boundedString(preview.singleBranchName, 'single business name', 2, 180),
      singleBranchDetails: boundedString(preview.singleBranchDetails, 'single business details', 2, 180)
    },
    pageLabels: {
      navFeatures: boundedString(labels.navFeatures, 'features navigation label', 2, 80),
      navPricing: boundedString(labels.navPricing, 'pricing navigation label', 2, 80),
      navBranches: boundedString(labels.navBranches, 'branches navigation label', 2, 80),
      navHowItWorks: boundedString(labels.navHowItWorks, 'how it works navigation label', 2, 80),
      ownerSignIn: boundedString(labels.ownerSignIn, 'owner sign-in label', 2, 80),
      heroSecondaryCta: boundedString(labels.heroSecondaryCta, 'secondary hero button label', 2, 80),
      popularPlanBadge: boundedString(labels.popularPlanBadge, 'popular plan badge', 2, 120),
      branchCalculatorHeadline: boundedString(labels.branchCalculatorHeadline, 'branch calculator headline', 2, 120),
      branchCalculatorDescription: boundedString(labels.branchCalculatorDescription, 'branch calculator description', 2, 240),
      branchUnitSingular: boundedString(labels.branchUnitSingular, 'singular branch unit', 2, 40),
      branchUnitPlural: boundedString(labels.branchUnitPlural, 'plural branch unit', 2, 40),
      recommendedPlanLabel: boundedString(labels.recommendedPlanLabel, 'recommended plan label', 2, 80),
      singleBranchRecommendation: boundedString(labels.singleBranchRecommendation, 'single branch recommendation', 2, 180),
      multiBranchRecommendation: boundedString(labels.multiBranchRecommendation, 'multi-branch recommendation', 2, 180),
      provisionCta: boundedString(labels.provisionCta, 'provision button label', 2, 80)
    },
    footerTagline: boundedString(content.footerTagline, 'footer tagline', 2, 160),
    trustBadge: boundedString(content.trustBadge, 'trust badge', 2, 80)
  };
  const now = new Date().toISOString();
  const existing = await db.prepare('SELECT version FROM site_content WHERE id = ?')
    .bind('landing').first<{ version: number }>();
  const version = (existing?.version || 0) + 1;
  const publish = body.publish === true;
  await db.prepare(
    `UPDATE site_content SET draft_json = ?, published_json = CASE WHEN ? = 1 THEN ? ELSE published_json END,
       version = ?, updated_by = ?, updated_at = ? WHERE id = ?`
  ).bind(JSON.stringify(clean), publish ? 1 : 0, JSON.stringify(clean), version, actor.id, now, 'landing').run();
  await audit(db, actor.id, null, publish ? 'content.published' : 'content.drafted', 'site_content', 'landing', { version });
  return json({ success: true, content: clean, version, published: publish });
}

async function saveInventory(
  db: D1Database,
  tenantId: string,
  actor: AuthenticatedUser,
  rawItems: unknown[],
  operationIds: string[]
): Promise<Response> {
  const plan = await db.prepare(
    `SELECT p.max_items AS maxItems FROM tenants t JOIN plans p ON p.id = t.plan_id
     WHERE t.id = ?`
  ).bind(tenantId).first<{ maxItems: number }>();
  if (!plan) throw new HttpError(404, 'Tenant was not found.');

  const items = rawItems.map(validateInventoryItem);
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id) || names.has(item.name.toLocaleLowerCase())) {
      throw new HttpError(400, 'Inventory items must have unique IDs and names.');
    }
    ids.add(item.id);
    names.add(item.name.toLocaleLowerCase());
  }

  const existing = await db.prepare(
    'SELECT COUNT(*) AS count FROM inventory_items WHERE tenant_id = ?'
  ).bind(tenantId).first<{ count: number }>();
  const existingIds = new Set<string>();
  for (let index = 0; index < items.length; index += 100) {
    const batch = items.slice(index, index + 100);
    const result = await db.prepare(
      `SELECT id FROM inventory_items WHERE tenant_id = ?
       AND id IN (${batch.map(() => '?').join(',')})`
    ).bind(tenantId, ...batch.map(item => item.id)).all<{ id: string }>();
    result.results.forEach(row => existingIds.add(row.id));
  }
  const newItemCount = items.length - existingIds.size;
  if (Number(existing?.count || 0) + newItemCount > plan.maxItems) {
    throw new HttpError(409, 'This inventory exceeds the item limit for the current plan.');
  }

  const now = new Date().toISOString();
  const statements = items.map(item => db.prepare(
    `INSERT INTO inventory_items (tenant_id, id, name, current_stock, data_json, updated_at)
     SELECT ?, ?, ?, ?, ?, ?
     WHERE EXISTS (
       SELECT 1 FROM inventory_items WHERE tenant_id = ? AND id = ?
     ) OR (
       SELECT COUNT(*) FROM inventory_items WHERE tenant_id = ?
     ) < (
       SELECT p.max_items FROM tenants t JOIN plans p ON p.id = t.plan_id WHERE t.id = ?
     )
     ON CONFLICT (tenant_id, id) DO UPDATE SET
       name = excluded.name,
       current_stock = inventory_items.current_stock,
       data_json = json_set(
         excluded.data_json,
         '$.currentStock', inventory_items.current_stock,
         '$.totalIn', json_extract(inventory_items.data_json, '$.totalIn'),
         '$.totalOut', json_extract(inventory_items.data_json, '$.totalOut'),
         '$.totalWaste', json_extract(inventory_items.data_json, '$.totalWaste')
       ),
       updated_at = excluded.updated_at`
  ).bind(
    tenantId, item.id, item.name, item.currentStock, JSON.stringify(item), now,
    tenantId, item.id, tenantId, tenantId
  ));
  for (let index = 0; index < statements.length; index += 100) {
    await db.batch(statements.slice(index, index + 100));
  }
  const storedIds = new Set<string>();
  for (let index = 0; index < items.length; index += 100) {
    const batch = items.slice(index, index + 100);
    const result = await db.prepare(
      `SELECT id FROM inventory_items WHERE tenant_id = ?
       AND id IN (${batch.map(() => '?').join(',')})`
    ).bind(tenantId, ...batch.map(item => item.id)).all<{ id: string }>();
    result.results.forEach(row => storedIds.add(row.id));
  }
  if (storedIds.size !== items.length) {
    throw new HttpError(409, 'This inventory exceeds the item limit for the current plan.');
  }
  const operationStatements = operationIds.map(operationId => db.prepare(
    `INSERT OR IGNORE INTO sync_operations (tenant_id, operation_id, result_json, created_at)
     VALUES (?, ?, ?, ?)`
  ).bind(
    tenantId,
    operationId,
    JSON.stringify({ operationId, accepted: true, includedInSnapshot: true }),
    now
  ));
  if (operationStatements.length) await db.batch(operationStatements);
  await audit(db, actor.id, tenantId, 'inventory.snapshot_saved', 'inventory', tenantId, {
    itemCount: items.length,
    includedPendingOperationCount: operationIds.length
  });
  return json({ success: true, savedCount: items.length });
}

interface InventoryItemRecord {
  id: string;
  name: string;
  category: string;
  unit: string;
  openingStock: number;
  currentStock: number;
  minLevel: number;
  maxLevel: number;
  totalIn: number;
  totalOut: number;
  totalWaste: number;
  unitCost?: number;
  supplierId?: string;
  barcode?: string;
  sku?: string;
  lastUpdated: string;
}

function validateInventoryItem(value: unknown): InventoryItemRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new HttpError(400, 'Invalid inventory item.');
  }
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(item.id)) {
    throw new HttpError(400, 'Invalid inventory item ID.');
  }
  const bounded = (field: string, max: number) => boundedString(item[field], field, 1, max);
  const amount = (field: string, optional = false): number | undefined => {
    const input = item[field];
    if (optional && input === undefined) return undefined;
    if (typeof input !== 'number' || !Number.isFinite(input) || input < 0 || input > 1_000_000_000) {
      throw new HttpError(400, `Invalid inventory ${field}.`);
    }
    return input;
  };
  return {
    id: item.id,
    name: bounded('name', 160),
    category: bounded('category', 80),
    unit: bounded('unit', 40),
    openingStock: amount('openingStock')!,
    currentStock: amount('currentStock')!,
    minLevel: amount('minLevel')!,
    maxLevel: amount('maxLevel')!,
    totalIn: amount('totalIn')!,
    totalOut: amount('totalOut')!,
    totalWaste: amount('totalWaste')!,
    unitCost: amount('unitCost', true),
    supplierId: item.supplierId === undefined ? undefined : bounded('supplierId', 100),
    barcode: item.barcode === undefined ? undefined : bounded('barcode', 160),
    sku: item.sku === undefined ? undefined : bounded('sku', 100),
    lastUpdated: typeof item.lastUpdated === 'string' && !Number.isNaN(Date.parse(item.lastUpdated))
      ? new Date(item.lastUpdated).toISOString()
      : new Date().toISOString()
  };
}

async function persistSyncOperations(
  db: D1Database,
  tenantId: string,
  user: AuthenticatedUser,
  actions: unknown[]
): Promise<Response> {
  const allowedRoles: Record<string, AuthenticatedUser['role'][]> = {
    STOCK_OUT: ['platform_admin', 'owner', 'admin', 'manager', 'teamlead', 'staff'],
    STOCK_COUNT: ['platform_admin', 'owner', 'admin', 'manager', 'teamlead', 'staff'],
    STOCK_IN: ['platform_admin', 'owner', 'admin', 'manager', 'teamlead'],
    WASTE: ['platform_admin', 'owner', 'admin', 'manager', 'teamlead'],
    UPDATE_ITEM: ['platform_admin', 'owner', 'admin', 'manager'],
    ADD_ITEM: ['platform_admin', 'owner', 'admin', 'manager']
  };
  const now = new Date().toISOString();
  const accepted: string[] = [];
  const seen = new Set<string>();
  const stagedInventoryIds = new Set<string>();
  const statements = [];
  const prepared = [];
  for (const value of actions) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new HttpError(400, 'Invalid sync operation.');
    const action = value as Record<string, unknown>;
    if (typeof action.id !== 'string' || action.id.length < 1 || action.id.length > 100 ||
        typeof action.actionType !== 'string' ||
      !['STOCK_OUT', 'STOCK_IN', 'WASTE', 'STOCK_COUNT', 'UPDATE_ITEM', 'ADD_ITEM'].includes(action.actionType) ||
        !action.payload || typeof action.payload !== 'object' || Array.isArray(action.payload)) {
      throw new HttpError(400, 'Invalid sync operation.');
    }
    const operationId = action.id;
    if (!allowedRoles[action.actionType].includes(user.role)) {
      throw new HttpError(403, 'Your role is not allowed to perform this inventory operation.');
    }
    if (seen.has(operationId)) continue;
    seen.add(operationId);
    const payloadJson = JSON.stringify(action.payload);
    if (new TextEncoder().encode(payloadJson).byteLength > 8_192) {
      throw new HttpError(400, 'Sync operation payload is too large.');
    }
    const occurredAt = typeof action.timestamp === 'string' && !Number.isNaN(Date.parse(action.timestamp))
      ? new Date(action.timestamp).toISOString()
      : now;
    const recordId = id();
    const payload = action.payload as Record<string, unknown>;
    const inventoryItems = ['UPDATE_ITEM', 'ADD_ITEM'].includes(action.actionType)
      ? [validateInventoryItem(payload.item)]
      : [];
    const movements = await resolveInventoryMovements(
      db,
      tenantId,
      action.actionType,
      payload
    );

    for (const inventoryItem of inventoryItems) {
      const existing = await db.prepare(
        'SELECT data_json AS dataJson FROM inventory_items WHERE tenant_id = ? AND id = ?'
      ).bind(tenantId, inventoryItem.id).first<{ dataJson: string }>();
      if (!existing) stagedInventoryIds.add(inventoryItem.id);
    }
    if (inventoryItems.length > 0) {
      const ids = new Set<string>();
      const names = new Set<string>();
      for (const item of inventoryItems) {
        if (ids.has(item.id) || names.has(item.name.toLocaleLowerCase())) {
          throw new HttpError(400, 'Inventory import items must have unique IDs and names.');
        }
        ids.add(item.id);
        names.add(item.name.toLocaleLowerCase());
      }
      const itemCount = await db.prepare(
        `SELECT COUNT(*) AS count FROM inventory_items WHERE tenant_id = ?`
      ).bind(tenantId).first<{ count: number }>();
      const plan = await db.prepare(
        `SELECT p.max_items AS maxItems FROM tenants t JOIN plans p ON p.id = t.plan_id
         WHERE t.id = ?`
      ).bind(tenantId).first<{ maxItems: number }>();
      if (plan && Number(itemCount?.count || 0) + stagedInventoryIds.size > plan.maxItems) {
        throw new HttpError(409, 'This inventory has reached the item limit for the current plan.');
      }
    }

    prepared.push({ action, recordId, occurredAt, now, payloadJson, inventoryItems, movements });
    accepted.push(operationId);
  }
  if (prepared.length === 0) {
    return json({ success: true, durable: true, syncedCount: actions.length, processedAt: now });
  }
  for (const operation of prepared) {
    const { action, recordId, occurredAt, payloadJson, inventoryItems, movements } = operation;
    const operationId = action.id as string;
    for (const inventoryItem of inventoryItems) {
      statements.push(db.prepare(
        `INSERT INTO inventory_items (tenant_id, id, name, current_stock, data_json, updated_at)
         SELECT ?, ?, ?, ?, ?, ?
         WHERE NOT EXISTS (
           SELECT 1 FROM sync_operations WHERE tenant_id = ? AND operation_id = ?
         ) AND (
           EXISTS (SELECT 1 FROM inventory_items WHERE tenant_id = ? AND id = ?)
           OR (
             SELECT COUNT(*) FROM inventory_items WHERE tenant_id = ?
           ) < (
             SELECT p.max_items FROM tenants t JOIN plans p ON p.id = t.plan_id WHERE t.id = ?
           )
         )
         ON CONFLICT (tenant_id, id) DO UPDATE SET
           name = excluded.name,
           current_stock = inventory_items.current_stock,
           data_json = json_set(
             excluded.data_json,
             '$.currentStock', inventory_items.current_stock,
             '$.totalIn', json_extract(inventory_items.data_json, '$.totalIn'),
             '$.totalOut', json_extract(inventory_items.data_json, '$.totalOut'),
             '$.totalWaste', json_extract(inventory_items.data_json, '$.totalWaste')
           ),
           updated_at = excluded.updated_at`
      ).bind(
        tenantId, inventoryItem.id, inventoryItem.name, inventoryItem.currentStock,
        JSON.stringify(inventoryItem),
        operation.now,
        tenantId, operationId,
        tenantId, inventoryItem.id, tenantId, tenantId
      ));
    }
    for (const movement of movements) {
      const isStockIn = movement.type === 'STOCK_IN';
      const isWaste = movement.type === 'WASTE';
      statements.push(db.prepare(
        `UPDATE inventory_items
         SET current_stock = ${isStockIn ? 'current_stock + ?' : isWaste ? 'MAX(0, current_stock - ?)' : 'MAX(0, current_stock - ?)'},
             data_json = json_set(
               data_json,
               '$.currentStock', ${isStockIn ? 'current_stock + ?' : isWaste ? 'MAX(0, current_stock - ?)' : 'MAX(0, current_stock - ?)'},
               '$.${isStockIn ? 'totalIn' : isWaste ? 'totalWaste' : 'totalOut'}',
                 COALESCE(json_extract(data_json, '$.${isStockIn ? 'totalIn' : isWaste ? 'totalWaste' : 'totalOut'}'), 0) + ?,
               '$.lastUpdated', ?
             ),
             updated_at = ?
             WHERE tenant_id = ? AND id = ?
               AND NOT EXISTS (
                 SELECT 1 FROM sync_operations WHERE tenant_id = ? AND operation_id = ?
               )`
      ).bind(
        movement.quantity, movement.quantity, movement.quantity, now, now,
        tenantId, movement.itemId, tenantId, operationId
      ));
    }
    statements.push(db.prepare(
      `INSERT INTO inventory_events (id, tenant_id, actor_id, action_type, payload_json, occurred_at, created_at)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
             SELECT 1 FROM sync_operations WHERE tenant_id = ? AND operation_id = ?
       )${inventoryItems.length > 0 || movements.length > 0 ? ' AND changes() = 1' : ''}`
    ).bind(
      recordId, tenantId, user.id, action.actionType as string,
      payloadJson, occurredAt, operation.now,
      tenantId, operationId
    ));
    statements.push(db.prepare(
      `INSERT OR IGNORE INTO sync_operations (tenant_id, operation_id, result_json, created_at)
       SELECT ?, ?, ?, ? WHERE changes() = 1`
    ).bind(
      tenantId, operationId, JSON.stringify({ operationId, accepted: true }), operation.now
    ));
  }
  if (statements.length > 1_000) {
    throw new HttpError(413, 'Too many inventory changes in one sync request.');
  }
  await db.batch(statements);
  const count = await db.prepare(
    `SELECT COUNT(*) AS count FROM sync_operations WHERE tenant_id = ? AND operation_id IN (${accepted.map(() => '?').join(',')})`
  ).bind(tenantId, ...accepted).first<{ count: number }>();
  if (count?.count !== accepted.length) {
    throw new HttpError(409, 'This inventory exceeds the item limit for the current plan or could not be synchronized.');
  }
  return json({ success: true, durable: true, syncedCount: actions.length, processedAt: now });
}

interface InventoryMovement {
  itemId: string;
  quantity: number;
  type: 'STOCK_OUT' | 'STOCK_IN' | 'WASTE';
}

async function resolveInventoryMovements(
  db: D1Database,
  tenantId: string,
  actionType: string,
  payload: Record<string, unknown>
): Promise<InventoryMovement[]> {
  const inputs: Array<{ itemId?: unknown; itemName?: unknown; name?: unknown; qty?: unknown }> = [];
  if (actionType === 'STOCK_OUT') {
    if (!Array.isArray(payload.cartItems)) throw new HttpError(400, 'Invalid stock-out operation.');
    for (const value of payload.cartItems) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new HttpError(400, 'Invalid stock-out item.');
      }
      const item = value as Record<string, unknown>;
      inputs.push({ itemId: item.itemId, itemName: item.itemName, name: item.name, qty: item.qty });
    }
  } else if (actionType === 'STOCK_IN' || actionType === 'WASTE') {
    inputs.push({
      itemId: payload.itemId,
      itemName: payload.itemName,
      name: payload.itemName,
      qty: payload.qty
    });
  } else {
    return [];
  }

  const movements: InventoryMovement[] = [];
  for (const input of inputs) {
    if (typeof input.qty !== 'number' || !Number.isFinite(input.qty) || input.qty <= 0 || input.qty > 1_000_000_000) {
      throw new HttpError(400, 'Inventory movement quantity must be greater than zero.');
    }
    let itemId = typeof input.itemId === 'string' && /^[a-zA-Z0-9_-]{1,100}$/.test(input.itemId)
      ? input.itemId
      : '';
    if (itemId) {
      const item = await db.prepare(
        'SELECT id FROM inventory_items WHERE tenant_id = ? AND id = ?'
      ).bind(tenantId, itemId).first<{ id: string }>();
      if (!item) throw new HttpError(409, 'The inventory item no longer exists on the server.');
    } else {
      const itemName = boundedString(input.itemName ?? input.name, 'item name', 1, 160);
      const item = await db.prepare(
        'SELECT id FROM inventory_items WHERE tenant_id = ? AND name = ? COLLATE NOCASE'
      ).bind(tenantId, itemName).first<{ id: string }>();
      if (!item) throw new HttpError(409, `Inventory item "${itemName}" is not synchronized.`);
      itemId = item.id;
    }
    movements.push({ itemId, quantity: input.qty, type: actionType as InventoryMovement['type'] });
  }
  return movements;
}

async function workforceRequest(request: Request, env: Env, url: URL): Promise<Response> {
  const user = await requireSession(request, env);
  const db = requireDatabase(env);
  const employeePath = url.pathname.match(/^\/api\/workforce\/employees\/([^/]+)$/);
  if (url.pathname === '/api/workforce/my-time' && request.method === 'GET') {
    if (!user.tenantId || !user.employeeId || user.role === 'platform_admin') {
      throw new HttpError(403, 'An employee account is required to view personal time.');
    }
    await requireTenantRole(request, env, user.tenantId, ['owner', 'admin', 'manager', 'teamlead', 'staff']);
    const entry = await db.prepare(
      `SELECT id, clock_in AS clockIn, break_minutes AS breakMinutes,
        break_started_at AS breakStartedAt, status
       FROM time_entries WHERE tenant_id = ? AND employee_id = ? AND clock_out IS NULL`
    ).bind(user.tenantId, user.employeeId).first<Record<string, unknown>>();
    return json({ success: true, entry: entry || null });
  }
  if (url.pathname === '/api/workforce/employees' && request.method === 'GET') {
    const tenantId = url.searchParams.get('tenantId') || '';
    if (!tenantId) throw new HttpError(400, 'Tenant ID is required.');
    await requireTenantRole(request, env, tenantId, ['owner', 'admin', 'manager']);
    const { results } = await db.prepare(
      `SELECT id, branch_id AS branchId, name, role, pay_type AS payType,
        pay_period AS payPeriod, pay_rate_minor AS payRateMinor, currency, active
       FROM employees WHERE tenant_id = ? ORDER BY name LIMIT 500`
    ).bind(tenantId).all<Record<string, unknown>>();
    const mayViewPay = user.role === 'platform_admin' || user.role === 'owner' || user.role === 'admin';
    return json({
      success: true,
      employees: results.map(employee => mayViewPay ? employee : {
        id: employee.id,
        branchId: employee.branchId,
        name: employee.name,
        role: employee.role,
        active: employee.active
      })
    });
  }
  if (url.pathname === '/api/workforce/employees' && request.method === 'POST') {
    requireSameOrigin(request);
    const body = await readJson<{
      tenantId?: unknown; name?: unknown; role?: unknown; pin?: unknown;
      branchId?: unknown; payType?: unknown; payRateMinor?: unknown; payPeriod?: unknown; currency?: unknown;
    }>(request);
    if (typeof body.tenantId !== 'string') throw new HttpError(400, 'Tenant ID is required.');
    await requireTenantRole(request, env, body.tenantId, ['owner', 'admin']);
    if (!/^\d{6,8}$/.test(String(body.pin))) throw new HttpError(400, 'Employee PIN must contain 6–8 digits.');
    const name = boundedString(body.name, 'employee name', 2, 120);
    const role = body.role;
    if (!['manager', 'teamlead', 'staff'].includes(String(role))) throw new HttpError(400, 'Invalid employee role.');
    if (!['hourly', 'salary'].includes(String(body.payType))) throw new HttpError(400, 'Invalid pay type.');
    const payRateMinor = positiveIntegerOrZero(body.payRateMinor, 'pay rate');
    const payPeriod = body.payPeriod || 'monthly';
    if (!['weekly', 'biweekly', 'semimonthly', 'monthly', 'annual'].includes(String(payPeriod))) {
      throw new HttpError(400, 'Invalid pay period.');
    }
    const currency = typeof body.currency === 'string' && /^[A-Z]{3}$/.test(body.currency) ? body.currency : 'USD';
    const pinPepper = env.EMPLOYEE_PIN_PEPPER;
    if (!pinPepper || pinPepper.length < 32) throw new HttpError(503, 'Employee sign-in is not configured.');
    const employeeId = id();
    const now = new Date().toISOString();
    const pinCredentials = await hashPassword(String(body.pin));
    const pinLookupHash = await hmacSha256(pinPepper, `${body.tenantId}:${body.pin}`);
    const userEmail = `${employeeId}@employee.invalid`;
    try {
      await db.batch([
        db.prepare(
          `INSERT INTO users (id, email, name, password_hash, password_salt, role, tenant_id, active, employee_id, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        ).bind(
          employeeId, userEmail, name, pinCredentials.hash, pinCredentials.salt,
          role, body.tenantId, employeeId, now
        ),
        db.prepare(
          `INSERT INTO employees
           (id, tenant_id, branch_id, user_id, name, pin_hash, pin_salt, pin_lookup_hash,
            role, pay_type, pay_rate_minor, pay_period, currency, active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`
        ).bind(
          employeeId, body.tenantId, optionalId(body.branchId), employeeId, name,
          pinCredentials.hash, pinCredentials.salt, pinLookupHash, role, body.payType,
          payRateMinor, payPeriod, currency, now, now
        ),
        db.prepare(
          `INSERT INTO audit_events (id, tenant_id, actor_id, action, entity_type, entity_id, created_at)
           VALUES (?, ?, ?, 'employee.created', 'employee', ?, ?)`
        ).bind(id(), body.tenantId, user.id, employeeId, now)
      ]);
    } catch (error) {
      const duplicatePin = await db.prepare(
        'SELECT id FROM employees WHERE tenant_id = ? AND pin_lookup_hash = ?'
      ).bind(body.tenantId, pinLookupHash).first<{ id: string }>();
      if (duplicatePin) throw new HttpError(409, 'This PIN is already assigned to an active or inactive employee.');
      throw error;
    }
    return json({
      success: true,
      employee: {
        id: employeeId, name, role, payType: body.payType, payRateMinor, payPeriod,
        currency, active: true, branchId: optionalId(body.branchId)
      }
    }, 201);
  }
  if (employeePath && request.method === 'PATCH') {
    requireSameOrigin(request);
    const body = await readJson<Record<string, unknown>>(request);
    if (typeof body.tenantId !== 'string') throw new HttpError(400, 'Tenant ID is required.');
    const actor = await requireTenantRole(request, env, body.tenantId, ['owner', 'admin']);
    const fields: string[] = [];
    const values: unknown[] = [];
    const allowed: Record<string, string> = { name: 'name', active: 'active', branchId: 'branch_id' };
    if (actor.role === 'platform_admin' || actor.role === 'owner' || actor.role === 'admin') {
      allowed.payType = 'pay_type';
      allowed.payRateMinor = 'pay_rate_minor';
      allowed.payPeriod = 'pay_period';
      allowed.currency = 'currency';
    }
    for (const [key, column] of Object.entries(allowed)) {
      if (!(key in body)) continue;
      let value = body[key];
      if (key === 'active') {
        if (typeof value !== 'boolean') throw new HttpError(400, 'Invalid active status.');
        value = value ? 1 : 0;
      } else if (key === 'payRateMinor') {
        value = positiveIntegerOrZero(value, 'pay rate');
      } else if (key === 'payType') {
        if (!['hourly', 'salary'].includes(String(value))) throw new HttpError(400, 'Invalid pay type.');
      } else if (key === 'payPeriod') {
        if (!['weekly', 'biweekly', 'semimonthly', 'monthly', 'annual'].includes(String(value))) throw new HttpError(400, 'Invalid pay period.');
      } else if (key === 'currency') {
        if (typeof value !== 'string' || !/^[A-Z]{3}$/.test(value)) throw new HttpError(400, 'Invalid currency.');
      } else if (key === 'branchId') {
        value = optionalId(value);
      } else {
        value = boundedString(value, 'employee name', 2, 120);
      }
      fields.push(`${column} = ?`);
      values.push(value);
    }
    if (!fields.length) throw new HttpError(400, 'No supported employee fields were supplied.');
    const now = new Date().toISOString();
    fields.push('updated_at = ?');
    values.push(now, employeePath[1], body.tenantId);
    const employeeUpdate = await db.prepare(
      `UPDATE employees SET ${fields.join(', ')} WHERE id = ? AND tenant_id = ?`
    ).bind(...values).run();
    if (changedRows(employeeUpdate) === 0) throw new HttpError(404, 'Employee was not found.');
    if ('active' in body) {
      await db.prepare('UPDATE users SET active = ? WHERE id = ? AND tenant_id = ?')
        .bind(body.active ? 1 : 0, employeePath[1], body.tenantId).run();
    }
    if (typeof body.name === 'string') {
      await db.prepare('UPDATE users SET name = ? WHERE id = ? AND tenant_id = ?')
        .bind(body.name.trim(), employeePath[1], body.tenantId).run();
    }
    await audit(db, actor.id, body.tenantId, 'employee.updated', 'employee', employeePath[1], body);
    return json({ success: true });
  }
  if (url.pathname === '/api/workforce/time-entries' && request.method === 'GET') {
    const tenantId = url.searchParams.get('tenantId') || '';
    if (!tenantId) throw new HttpError(400, 'Tenant ID is required.');
    await requireTenantRole(request, env, tenantId, ['owner', 'admin', 'manager']);
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!isDate(from) || !isDate(to) || from! > to! || daysBetween(from!, to!) > 366) {
      throw new HttpError(400, 'A valid date range of at most 366 days is required.');
    }
    const { results } = await db.prepare(
      `SELECT te.id, te.employee_id AS employeeId, e.name AS employeeName, te.branch_id AS branchId, te.clock_in AS clockIn,
        te.clock_out AS clockOut, te.break_minutes AS breakMinutes, te.notes, te.status,
        te.approved_by AS approvedBy, te.approved_at AS approvedAt,
        COALESCE(te.pay_type, e.pay_type) AS payType,
        COALESCE(te.pay_rate_minor, e.pay_rate_minor) AS payRateMinor,
        COALESCE(te.pay_period, e.pay_period) AS payPeriod,
        COALESCE(te.currency, e.currency) AS currency
       FROM time_entries te JOIN employees e ON e.id = te.employee_id AND e.tenant_id = te.tenant_id
       WHERE te.tenant_id = ? AND te.clock_in >= ? AND te.clock_in < ?
       ORDER BY te.clock_in DESC LIMIT 1000`
    ).bind(tenantId, `${from}T00:00:00.000Z`, `${shiftDate(to!, 1)}T00:00:00.000Z`)
      .all<Record<string, unknown>>();
    const mayViewPay = user.role === 'platform_admin' || user.role === 'owner' || user.role === 'admin';
    return json({
      success: true,
      entries: results.map(entry => {
        const duration = typeof entry.clockOut === 'string'
          ? Math.max(0, Date.parse(entry.clockOut) - Date.parse(String(entry.clockIn)) - Number(entry.breakMinutes) * 60_000)
          : null;
        const hours = duration === null ? null : Math.round(duration / 36_000) / 100;
        return {
          ...entry,
          hours,
          grossPayMinor: mayViewPay && hours !== null && entry.payType === 'hourly'
            ? Math.round(hours * Number(entry.payRateMinor))
            : null,
          payRateMinor: mayViewPay ? entry.payRateMinor : undefined,
          currency: mayViewPay ? entry.currency : undefined,
          payType: undefined,
          payPeriod: undefined
        };
      })
    });
  }
  if (url.pathname === '/api/workforce/clock' && request.method === 'POST') {
    requireSameOrigin(request);
    const body = await readJson<{ tenantId?: unknown; action?: unknown; branchId?: unknown; breakMinutes?: unknown; notes?: unknown }>(request);
    if (user.role === 'platform_admin' || !user.tenantId || !user.employeeId || body.tenantId !== user.tenantId) {
      throw new HttpError(403, 'You are not allowed to clock time for this tenant.');
    }
    if (!['clock_in', 'clock_out', 'start_break', 'end_break'].includes(String(body.action))) {
      throw new HttpError(400, 'Invalid clock action.');
    }
    const active = await db.prepare(
      `SELECT id, clock_in AS clockIn, clock_out AS clockOut, break_started_at AS breakStartedAt,
              break_minutes AS breakMinutes, status
       FROM time_entries WHERE tenant_id = ? AND employee_id = ? AND clock_out IS NULL`
    ).bind(user.tenantId, user.employeeId).first<Record<string, unknown>>();
    const now = new Date();
    const stamp = now.toISOString();
    if (body.action === 'clock_in') {
      if (active) throw new HttpError(409, 'You already have an open shift.');
      const entryId = id();
      await db.prepare(
        `INSERT INTO time_entries
         (id, tenant_id, employee_id, branch_id, clock_in, status, created_at, updated_at,
          pay_type, pay_rate_minor, pay_period, currency)
         SELECT ?, e.tenant_id, e.id, ?, ?, 'open', ?, ?, e.pay_type, e.pay_rate_minor, e.pay_period, e.currency
         FROM employees e
         WHERE e.tenant_id = ? AND e.id = ? AND e.active = 1`
      ).bind(entryId, optionalId(body.branchId), stamp, stamp, stamp, user.tenantId, user.employeeId).run();
      const createdEntry = await db.prepare(
        'SELECT id FROM time_entries WHERE id = ? AND tenant_id = ?'
      ).bind(entryId, user.tenantId).first<{ id: string }>();
      if (!createdEntry) throw new HttpError(403, 'Active employee record was not found for this account.');
      await audit(db, user.id, user.tenantId, 'time.clock_in', 'time_entry', entryId, { at: stamp });
      return json({ success: true, action: body.action, entryId, timestamp: stamp }, 201);
    }
    if (!active) throw new HttpError(409, 'No open shift was found.');
    if (body.action === 'start_break') {
      if (active.breakStartedAt) throw new HttpError(409, 'A break is already in progress.');
      await db.prepare('UPDATE time_entries SET break_started_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?')
        .bind(stamp, stamp, active.id, user.tenantId).run();
      await audit(db, user.id, user.tenantId, 'time.break_started', 'time_entry', String(active.id), { at: stamp });
      return json({ success: true, action: body.action, timestamp: stamp });
    }
    if (body.action === 'end_break') {
      if (typeof active.breakStartedAt !== 'string') throw new HttpError(409, 'No break is in progress.');
      const minutes = Math.max(1, Math.ceil((now.getTime() - Date.parse(active.breakStartedAt)) / 60_000));
      await db.prepare(
        `UPDATE time_entries SET break_minutes = break_minutes + ?, break_started_at = NULL, updated_at = ?
         WHERE id = ? AND tenant_id = ?`
      ).bind(minutes, stamp, active.id, user.tenantId).run();
      await audit(db, user.id, user.tenantId, 'time.break_ended', 'time_entry', String(active.id), { at: stamp, minutes });
      return json({ success: true, action: body.action, breakMinutesAdded: minutes, timestamp: stamp });
    }
    if (active.breakStartedAt) throw new HttpError(409, 'End your break before clocking out.');
    const notes = typeof body.notes === 'string' ? body.notes.slice(0, 500) : '';
    await db.prepare(
      `UPDATE time_entries SET clock_out = ?, notes = ?, status = 'submitted', updated_at = ?
       WHERE id = ? AND tenant_id = ? AND clock_out IS NULL`
    ).bind(stamp, notes, stamp, active.id, user.tenantId).run();
    await audit(db, user.id, user.tenantId, 'time.clock_out', 'time_entry', String(active.id), { at: stamp });
    return json({ success: true, action: body.action, entryId: active.id, timestamp: stamp });
  }
  if (url.pathname === '/api/workforce/timesheets/approve' && request.method === 'POST') {
    requireSameOrigin(request);
    if (!user.tenantId) throw new HttpError(403, 'Tenant membership is required.');
    requireRole(user, ['owner', 'admin', 'manager']);
    const body = await readJson<{ tenantId?: unknown; entryId?: unknown; decision?: unknown }>(request);
    if (body.tenantId !== user.tenantId) throw new HttpError(403, 'Tenant scope does not match this account.');
    if (typeof body.entryId !== 'string' || !['approved', 'rejected'].includes(String(body.decision))) {
      throw new HttpError(400, 'Entry ID and approval decision are required.');
    }
    const result = await db.prepare(
      `UPDATE time_entries SET status = ?, approved_by = ?, approved_at = ?, updated_at = ?
       WHERE id = ? AND tenant_id = ? AND status = 'submitted'`
    ).bind(body.decision, user.id, new Date().toISOString(), new Date().toISOString(), body.entryId, user.tenantId).run();
    if (changedRows(result) === 0) throw new HttpError(404, 'Submitted time entry was not found.');
    await audit(db, user.id, user.tenantId, `time.${body.decision}`, 'time_entry', body.entryId, {});
    return json({ success: true });
  }
  const entryMatch = url.pathname.match(/^\/api\/workforce\/time-entries\/([^/]+)$/);
  if (entryMatch && request.method === 'PATCH') {
    requireSameOrigin(request);
    const body = await readJson<{ tenantId?: unknown; clockIn?: unknown; clockOut?: unknown; breakMinutes?: unknown; reason?: unknown }>(request);
    if (typeof body.tenantId !== 'string') throw new HttpError(400, 'Tenant ID is required.');
    const actor = await requireTenantRole(request, env, body.tenantId, ['owner', 'admin', 'manager']);
    const reason = boundedString(body.reason, 'correction reason', 5, 500);
    const existing = await db.prepare(
      `SELECT clock_in AS clockIn, clock_out AS clockOut, break_minutes AS breakMinutes, status
       FROM time_entries WHERE id = ? AND tenant_id = ?`
    ).bind(entryMatch[1], body.tenantId).first<Record<string, unknown>>();
    if (!existing || !['submitted', 'rejected'].includes(String(existing.status))) {
      throw new HttpError(404, 'Editable time entry was not found.');
    }
    const clockIn = typeof body.clockIn === 'string' ? new Date(body.clockIn) : new Date(String(existing.clockIn));
    const clockOut = body.clockOut === null ? null
      : typeof body.clockOut === 'string' ? new Date(body.clockOut)
      : existing.clockOut ? new Date(String(existing.clockOut)) : null;
    if (Number.isNaN(clockIn.getTime()) || (clockOut && Number.isNaN(clockOut.getTime())) ||
        (clockOut && clockOut <= clockIn)) throw new HttpError(400, 'Invalid time entry interval.');
    const breakMinutes = body.breakMinutes === undefined ? Number(existing.breakMinutes) : positiveIntegerOrZero(body.breakMinutes, 'break minutes');
    if (clockOut && breakMinutes > Math.floor((clockOut.getTime() - clockIn.getTime()) / 60_000)) {
      throw new HttpError(400, 'Break time cannot exceed the shift duration.');
    }
    const updated = {
      clockIn: clockIn.toISOString(), clockOut: clockOut?.toISOString() || null, breakMinutes
    };
    const now = new Date().toISOString();
    const results = await db.batch([
      db.prepare(
        `UPDATE time_entries SET clock_in = ?, clock_out = ?, break_minutes = ?, status = ?, updated_at = ?
         WHERE id = ? AND tenant_id = ? AND status IN ('submitted', 'rejected')`
      ).bind(updated.clockIn, updated.clockOut, updated.breakMinutes, updated.clockOut ? 'submitted' : 'open', now, entryMatch[1], body.tenantId),
      db.prepare(
        `INSERT INTO employee_time_audit
         (id, tenant_id, entry_id, actor_id, action, previous_json, current_json, reason, created_at)
         SELECT ?, ?, ?, ?, 'time.corrected', ?, ?, ?, ?
         WHERE changes() = 1`
      ).bind(id(), body.tenantId, entryMatch[1], actor.id, JSON.stringify(existing), JSON.stringify(updated), reason, now)
    ]);
    if (changedRows(results[0]) === 0) throw new HttpError(409, 'The time entry changed before this correction could be saved.');
    return json({ success: true });
  }
  if (url.pathname === '/api/workforce/payroll/export' && request.method === 'GET') {
    const tenantId = url.searchParams.get('tenantId') || '';
    const from = url.searchParams.get('from');
    const to = url.searchParams.get('to');
    if (!tenantId || !isDate(from) || !isDate(to) || from > to || daysBetween(from, to) > 366) {
      throw new HttpError(400, 'Tenant and a valid date range of at most 366 days are required.');
    }
    await requireTenantRole(request, env, tenantId, ['owner', 'admin']);
    const { results } = await db.prepare(
      `SELECT e.name, e.role, COALESCE(te.pay_type, e.pay_type) AS payType,
        COALESCE(te.pay_rate_minor, e.pay_rate_minor) AS payRateMinor,
        COALESCE(te.pay_period, e.pay_period) AS payPeriod, COALESCE(te.currency, e.currency) AS currency,
        te.clock_in AS clockIn, te.clock_out AS clockOut,
        te.break_minutes AS breakMinutes, te.status
       FROM time_entries te JOIN employees e ON e.id = te.employee_id AND e.tenant_id = te.tenant_id
       WHERE te.tenant_id = ? AND te.clock_in >= ? AND te.clock_in < ? AND te.status = 'approved'
       ORDER BY e.name, te.clock_in LIMIT 5000`
    ).bind(tenantId, `${from}T00:00:00.000Z`, `${shiftDate(to, 1)}T00:00:00.000Z`)
      .all<Record<string, unknown>>();
    const rows: (string | number | null)[][] = [['Employee', 'Role', 'Clock in (UTC)', 'Clock out (UTC)', 'Break minutes', 'Hours', 'Pay type', 'Configured rate (minor units)', 'Gross pay (minor units)', 'Currency']];
    for (const entry of results) {
      const duration = entry.clockOut
        ? Math.max(0, Date.parse(String(entry.clockOut)) - Date.parse(String(entry.clockIn)) - Number(entry.breakMinutes) * 60_000)
        : 0;
      const hours = Math.round(duration / 36_000) / 100;
      const grossMinor = entry.payType === 'hourly' ? Math.round(hours * Number(entry.payRateMinor)) : '';
      rows.push([
        String(entry.name || ''), String(entry.role || ''), String(entry.clockIn || ''),
        entry.clockOut === null ? '' : String(entry.clockOut || ''), Number(entry.breakMinutes || 0),
        hours, String(entry.payType || ''), Number(entry.payRateMinor || 0), grossMinor, String(entry.currency || '')
      ]);
    }
    const csv = rows.map(row => row.map(csvCell).join(',')).join('\r\n');
    return new Response(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="time-export-${from}-${to}.csv"`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      }
    });
  }
  throw new HttpError(404, 'Workforce route was not found.');
}

async function audit(
  db: D1Database,
  actorId: string,
  tenantId: string | null,
  action: string,
  entityType: string,
  entityId: string,
  details: unknown
): Promise<void> {
  await db.prepare(
    `INSERT INTO audit_events (id, tenant_id, actor_id, action, entity_type, entity_id, details_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id(), tenantId, actorId, action, entityType, entityId, JSON.stringify(details), new Date().toISOString()).run();
}

function boundedString(value: unknown, field: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.trim().length < min || value.trim().length > max) {
    throw new HttpError(400, `Invalid ${field}.`);
  }
  return value.trim();
}

function positiveInteger(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 1 || (value as number) > 1_000_000) {
    throw new HttpError(400, `Invalid ${field}.`);
  }
  return value as number;
}

function positiveIntegerOrZero(value: unknown, field: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0 || (value as number) > 1_000_000_000) {
    throw new HttpError(400, `Invalid ${field}.`);
  }
  return value as number;
}

function optionalId(value: unknown): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.length > 64 || !/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new HttpError(400, 'Invalid branch ID.');
  }
  return value;
}

function isDate(value: string | null): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function daysBetween(from: string, to: string): number {
  return Math.floor((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

function csvCell(value: string | number | null): string {
  let text = String(value ?? '');
  if (typeof value === 'string' && /^[\u0000-\u0020\uFEFF]*[=+\-@]/.test(value)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function changedRows(result: unknown): number {
  if (!result || typeof result !== 'object' || !('meta' in result)) return 0;
  const meta = result.meta;
  if (!meta || typeof meta !== 'object' || !('changes' in meta) || typeof meta.changes !== 'number') return 0;
  return meta.changes;
}
