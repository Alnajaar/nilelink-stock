import assert from 'node:assert/strict';
import test from 'node:test';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import { onRequest } from '../functions/api/[[route]].ts';
import { D1Database, D1Statement } from '../functions/api/_lib/security.ts';
import { DEFAULT_PUBLIC_SITE_CONTENT } from '../src/types/content.ts';

class SqliteStatement implements D1Statement {
  private parameters: unknown[] = [];

  constructor(private readonly database: DatabaseSync, private readonly sql: string) {}

  bind(...values: unknown[]): D1Statement {
    this.parameters = values;
    return this;
  }

  async first<T>(): Promise<T | null> {
    return (this.database.prepare(this.sql).get(...this.sqlValues()) as T | undefined) || null;
  }

  async all<T>(): Promise<{ results: T[]; success: boolean }> {
    return { results: this.database.prepare(this.sql).all(...this.sqlValues()) as T[], success: true };
  }

  async run(): Promise<unknown> {
    const result = this.database.prepare(this.sql).run(...this.sqlValues());
    return { success: true, meta: { changes: result.changes } };
  }

  execute(): unknown {
    const result = this.database.prepare(this.sql).run(...this.sqlValues());
    return { success: true, meta: { changes: result.changes } };
  }

  private sqlValues(): SQLInputValue[] {
    return this.parameters.map(value => {
      if (value === null || typeof value === 'string' || typeof value === 'number' ||
          typeof value === 'bigint' || value instanceof Uint8Array) return value;
      throw new TypeError('Unsupported SQLite test binding.');
    });
  }
}

class SqliteD1 implements D1Database {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string): D1Statement {
    return new SqliteStatement(this.database, sql);
  }

  async batch(statements: D1Statement[]): Promise<unknown[]> {
    this.database.exec('BEGIN');
    try {
      const results = statements.map(statement => (statement as SqliteStatement).execute());
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

async function currentTotp(secret: string): Promise<string> {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const character of secret) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  }
  const secretBytes: number[] = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    secretBytes.push(parseInt(bits.slice(index, index + 8), 2));
  }
  const secretBuffer = new Uint8Array(secretBytes);
  const key = await crypto.subtle.importKey(
    'raw',
    secretBuffer,
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign']
  );
  const counter = new ArrayBuffer(8);
  new DataView(counter).setBigUint64(0, BigInt(Math.floor(Date.now() / 30_000)));
  const digest = new Uint8Array(await crypto.subtle.sign('HMAC', key, counter));
  const offset = digest[digest.length - 1] & 0x0f;
  const number = ((digest[offset] & 0x7f) << 24) |
    (digest[offset + 1] << 16) | (digest[offset + 2] << 8) | digest[offset + 3];
  return String(number % 1_000_000).padStart(6, '0');
}

test('Cloudflare API registration, PIN timekeeping, approval, and CSV export work on SQLite', async () => {
  const sqlite = new DatabaseSync(':memory:');
  sqlite.exec('PRAGMA foreign_keys = ON;');
  const migration = await import('node:fs').then(fs => fs.readFileSync('migrations/0001_core.sql', 'utf8'));
  sqlite.exec(migration);
  sqlite.exec(await import('node:fs').then(fs => fs.readFileSync('migrations/0002_public_site_controls.sql', 'utf8')));
  sqlite.exec(await import('node:fs').then(fs => fs.readFileSync('migrations/0003_editable_landing_details.sql', 'utf8')));
  sqlite.exec(await import('node:fs').then(fs => fs.readFileSync('migrations/0004_editable_public_page_labels.sql', 'utf8')));
  const migratedContentRow = sqlite.prepare(
    'SELECT published_json FROM site_content WHERE id = ?'
  ).get('landing') as { published_json: string };
  const migratedContent = JSON.parse(migratedContentRow.published_json) as typeof DEFAULT_PUBLIC_SITE_CONTENT;
  assert.equal(migratedContent.marketingMetrics[0].value, 'Inventory');
  assert.equal(migratedContent.features[1], 'Team time tracking');
  assert.equal(migratedContent.multiBranchHeadline, 'Inventory and workforce tools for hospitality teams.');
  assert.equal(migratedContent.pageLabels.ownerSignIn, 'Owner Sign In');

  const db = new SqliteD1(sqlite);
  const env = {
    DB: db,
    BOOTSTRAP_ADMIN_EMAIL: 'platform@example.com',
    BOOTSTRAP_ADMIN_TOKEN: 'test-bootstrap-token-that-is-long-enough-32',
    BOOTSTRAP_ADMIN_TOTP_SECRET: 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ',
    EMPLOYEE_PIN_PEPPER: 'test-pin-pepper-that-is-at-least-32-characters',
    TURNSTILE_SECRET_KEY: 'test-turnstile-secret',
    TURNSTILE_SITE_KEY: 'test-turnstile-site'
  };
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    hostname: 'app.example',
    action: 'register'
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });

  const call = (path: string, method = 'GET', body?: unknown, cookie?: string) => {
    const headers = new Headers();
    if (method !== 'GET') {
      headers.set('origin', 'https://app.example');
      headers.set('content-type', 'application/json');
    }
    if (cookie) headers.set('cookie', cookie);
    const request = new Request(`https://app.example${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    return onRequest({ request, env, params: {} });
  };

  try {
    const registration = await call('/api/auth/register', 'POST', {
      name: 'Test Cafe',
      ownerName: '=SUM(1,1)',
      email: 'owner@example.com',
      password: 'a sufficiently long password',
      pin: '123456',
      turnstileToken: 'test-turnstile-token',
      planId: 'plan-starter',
      adminPhone: '+1 555 0100',
      city: 'Test City',
      currency: 'USD'
    });
    assert.equal(registration.status, 200, await registration.clone().text());
    const registrationData = await registration.json() as {
      user: { tenantId: string };
      tenant: { id: string; adminPhone: string; city: string; paidUntil: string };
    };
    assert.equal(registrationData.tenant.adminPhone, '+1 555 0100');
    assert.equal(registrationData.tenant.city, 'Test City');
    const cookie = registration.headers.get('set-cookie')?.split(';')[0];
    assert.ok(cookie);

    const session = await call('/api/auth/me', 'GET', undefined, cookie);
    assert.equal(session.status, 200);

    const otherRegistration = await call('/api/auth/register', 'POST', {
      name: 'Other Cafe',
      ownerName: 'Other Owner',
      email: 'other-owner@example.com',
      password: 'another sufficiently long password',
      pin: '654321',
      turnstileToken: 'test-turnstile-token',
      planId: 'plan-starter',
      currency: 'USD'
    });
    assert.equal(otherRegistration.status, 200);
    const otherTenant = await otherRegistration.json() as { tenant: { id: string } };
    const otherCookie = otherRegistration.headers.get('set-cookie')?.split(';')[0];
    assert.ok(otherCookie);

    const initialInventory = [{
      id: 'milk-item-1',
      name: 'Whole Milk',
      category: 'Dairy',
      unit: 'litre',
      openingStock: 10,
      currentStock: 10,
      minLevel: 2,
      maxLevel: 20,
      totalIn: 0,
      totalOut: 0,
      totalWaste: 0,
      lastUpdated: new Date().toISOString()
    }];
    const inventorySave = await call('/api/inventory', 'PUT', {
      tenantId: registrationData.tenant.id,
      items: initialInventory,
      operationIds: ['operation-included-in-snapshot']
    }, cookie);
    assert.equal(inventorySave.status, 200, await inventorySave.clone().text());
    const inventoryLoad = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      cookie
    );
    assert.equal(inventoryLoad.status, 200);
    assert.equal(((await inventoryLoad.json()) as { items: unknown[] }).items.length, 1);
    const crossTenantInventory = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      otherCookie
    );
    assert.equal(crossTenantInventory.status, 403);

    const includedOperationReplay = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [{
        id: 'operation-included-in-snapshot',
        actionType: 'STOCK_OUT',
        payload: { cartItems: [{ itemId: 'milk-item-1', name: 'Whole Milk', qty: 3 }] }
      }]
    }, cookie);
    assert.equal(includedOperationReplay.status, 200);
    const inventoryAfterReplay = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      cookie
    );
    assert.equal(
      ((await inventoryAfterReplay.json()) as { items: Array<{ currentStock: number }> }).items[0].currentStock,
      10
    );

    const stockOutAction = {
      id: 'operation-stock-out-1',
      cafeId: registrationData.tenant.id,
      actionType: 'STOCK_OUT',
      payload: { cartItems: [{ itemId: 'milk-item-1', name: 'Whole Milk', qty: 3 }] },
      timestamp: new Date().toISOString()
    };
    const stockOut = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [stockOutAction]
    }, cookie);
    assert.equal(stockOut.status, 200, await stockOut.clone().text());
    const repeatedStockOut = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [stockOutAction]
    }, cookie);
    assert.equal(repeatedStockOut.status, 200);
    const inventoryAfterSync = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      cookie
    );
    const afterStockOut = (await inventoryAfterSync.json()) as { items: Array<{ currentStock: number; totalOut: number }> };
    assert.equal(afterStockOut.items[0].currentStock, 7);
    assert.equal(afterStockOut.items[0].totalOut, 3);

    const stockIn = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [{
        id: 'operation-stock-in-1',
        actionType: 'STOCK_IN',
        payload: { itemId: 'milk-item-1', itemName: 'Whole Milk', qty: 2 }
      }]
    }, cookie);
    assert.equal(stockIn.status, 200, await stockIn.clone().text());
    const waste = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [{
        id: 'operation-waste-1',
        actionType: 'WASTE',
        payload: { itemId: 'milk-item-1', itemName: 'Whole Milk', qty: 1 }
      }]
    }, cookie);
    assert.equal(waste.status, 200, await waste.clone().text());
    const inventoryAfterMovements = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      cookie
    );
    const movementTotals = (await inventoryAfterMovements.json()) as {
      items: Array<{ currentStock: number; totalIn: number; totalOut: number; totalWaste: number }>;
    };
    assert.deepEqual(
      [
        movementTotals.items[0].currentStock,
        movementTotals.items[0].totalIn,
        movementTotals.items[0].totalOut,
        movementTotals.items[0].totalWaste
      ],
      [8, 2, 3, 1]
    );

    const unsupportedBranchTransfer = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [{
        id: 'operation-branch-transfer-1',
        actionType: 'BRANCH_TRANSFER',
        payload: { newTransfer: { id: 'transfer-1' } }
      }]
    }, cookie);
    assert.equal(unsupportedBranchTransfer.status, 400);

    const metadataUpdate = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [{
        id: 'operation-item-metadata-1',
        actionType: 'UPDATE_ITEM',
        payload: { item: { ...initialInventory[0], category: 'Chilled Dairy' } }
      }]
    }, cookie);
    assert.equal(metadataUpdate.status, 200, await metadataUpdate.clone().text());
    const inventoryAfterMetadata = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      cookie
    );
    const preservedStock = (await inventoryAfterMetadata.json()) as {
      items: Array<{ currentStock: number; totalOut: number; category: string }>;
    };
    assert.deepEqual(
      [preservedStock.items[0].currentStock, preservedStock.items[0].totalOut, preservedStock.items[0].category],
      [8, 3, 'Chilled Dairy']
    );

    const crossTenantEntries = await call(
      `/api/workforce/time-entries?tenantId=${otherTenant.tenant.id}&from=${new Date().toISOString().slice(0, 10)}&to=${new Date().toISOString().slice(0, 10)}`,
      'GET',
      undefined,
      cookie
    );
    assert.equal(crossTenantEntries.status, 403);

    const employeeCreate = await call('/api/workforce/employees', 'POST', {
      tenantId: registrationData.tenant.id,
      name: 'Manager User',
      role: 'manager',
      pin: '789012',
      payType: 'salary',
      payRateMinor: 420000,
      payPeriod: 'monthly',
      currency: 'USD'
    }, cookie);
    assert.equal(employeeCreate.status, 201);
    const managerLogin = await call('/api/auth/pin', 'POST', {
      tenantId: registrationData.tenant.id,
      pin: '789012'
    });
    assert.equal(managerLogin.status, 200, await managerLogin.clone().text());
    const managerCookie = managerLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(managerCookie);
    const managerRoster = await call(
      `/api/workforce/employees?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      managerCookie
    );
    const roster = await managerRoster.json() as { employees: Array<Record<string, unknown>> };
    assert.equal(managerRoster.status, 200);
    assert.equal(roster.employees.length, 2);
    assert.equal('payRateMinor' in roster.employees.find(employee => employee.name === 'Manager User')!, false);

    const pinLogin = await call('/api/auth/pin', 'POST', {
      tenantId: registrationData.tenant.id,
      pin: '123456'
    });
    assert.equal(pinLogin.status, 200);
    const pinCookie = pinLogin.headers.get('set-cookie')?.split(';')[0];
    assert.ok(pinCookie);

    const clockIn = await call('/api/workforce/clock', 'POST', {
      tenantId: registrationData.tenant.id,
      action: 'clock_in'
    }, pinCookie);
    assert.equal(clockIn.status, 201);
    const duplicateClockIn = await call('/api/workforce/clock', 'POST', {
      tenantId: registrationData.tenant.id,
      action: 'clock_in'
    }, pinCookie);
    assert.equal(duplicateClockIn.status, 409);

    assert.equal((await call('/api/workforce/clock', 'POST', {
      tenantId: registrationData.tenant.id,
      action: 'start_break'
    }, pinCookie)).status, 200);
    assert.equal((await call('/api/workforce/clock', 'POST', {
      tenantId: registrationData.tenant.id,
      action: 'end_break'
    }, pinCookie)).status, 200);
    assert.equal((await call('/api/workforce/clock', 'POST', {
      tenantId: registrationData.tenant.id,
      action: 'clock_out'
    }, pinCookie)).status, 200);

    const today = new Date().toISOString().slice(0, 10);
    const entriesResponse = await call(
      `/api/workforce/time-entries?tenantId=${registrationData.tenant.id}&from=${today}&to=${today}`,
      'GET',
      undefined,
      cookie
    );
    const entries = await entriesResponse.json() as { entries: Array<{ id: string; status: string }> };
    assert.equal(entriesResponse.status, 200);
    assert.equal(entries.entries.length, 1);
    assert.equal(entries.entries[0].status, 'submitted');

    const approval = await call('/api/workforce/timesheets/approve', 'POST', {
      tenantId: registrationData.tenant.id,
      entryId: entries.entries[0].id,
      decision: 'approved'
    }, cookie);
    assert.equal(approval.status, 200);
    const duplicateApproval = await call('/api/workforce/timesheets/approve', 'POST', {
      tenantId: registrationData.tenant.id,
      entryId: entries.entries[0].id,
      decision: 'approved'
    }, cookie);
    assert.equal(duplicateApproval.status, 404);

    const exportResponse = await call(
      `/api/workforce/payroll/export?tenantId=${registrationData.tenant.id}&from=${today}&to=${today}`,
      'GET',
      undefined,
      cookie
    );
    const csv = await exportResponse.text();
    assert.equal(exportResponse.status, 200);
    assert.match(csv, /"'=SUM\(1,1\)"/);
    assert.equal((await call('/api/tenants', 'GET', undefined, pinCookie)).status, 200);

    const totp = await currentTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET);
    const setup = await call('/api/auth/setup', 'POST', {
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      password: 'platform admin password is sufficiently long',
      token: env.BOOTSTRAP_ADMIN_TOKEN,
      totp
    });
    assert.equal(setup.status, 200, await setup.clone().text());
    const adminCookie = setup.headers.get('set-cookie')?.split(';')[0];
    assert.ok(adminCookie);
    const repeatSetup = await call('/api/auth/setup', 'POST', {
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      password: 'platform admin password is sufficiently long',
      token: env.BOOTSTRAP_ADMIN_TOKEN,
      totp: await currentTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET)
    });
    assert.equal(repeatSetup.status, 409);

    const adminTenants = await call('/api/tenants', 'GET', undefined, adminCookie);
    const managed = await adminTenants.json() as { tenants: unknown[] };
    assert.equal(managed.tenants.length, 2);
    const planUpdate = await call('/api/plans/plan-starter', 'PUT', { price: 35, maxItems: 1 }, adminCookie);
    assert.equal(planUpdate.status, 200);
    const overPlanInventory = await call('/api/sync', 'POST', {
      cafeId: registrationData.tenant.id,
      actions: [{
        id: 'operation-over-plan-item-limit',
        actionType: 'ADD_ITEM',
        payload: {
          item: {
            id: 'second-item',
            name: 'Oat Milk',
            category: 'Dairy',
            unit: 'litre',
            openingStock: 3,
            currentStock: 3,
            minLevel: 1,
            maxLevel: 8,
            totalIn: 0,
            totalOut: 0,
            totalWaste: 0,
            lastUpdated: new Date().toISOString()
          }
        }
      }]
    }, cookie);
    assert.equal(overPlanInventory.status, 409);
    const cappedInventory = await call(
      `/api/inventory?tenantId=${registrationData.tenant.id}`,
      'GET',
      undefined,
      cookie
    );
    assert.equal(((await cappedInventory.json()) as { items: unknown[] }).items.length, 1);
    const draftSave = await call('/api/content', 'PUT', {
      publish: false,
      content: {
        ...DEFAULT_PUBLIC_SITE_CONTENT,
        headline: 'Private draft headline'
      }
    }, adminCookie);
    assert.equal(draftSave.status, 200);
    const adminDraft = await call('/api/content/draft', 'GET', undefined, adminCookie);
    assert.equal(adminDraft.status, 200);
    assert.equal(((await adminDraft.json()) as { content: { headline: string } }).content.headline, 'Private draft headline');
    const publicContentBeforePublish = await call('/api/content');
    assert.notEqual(
      ((await publicContentBeforePublish.json()) as { content: { headline: string } }).content.headline,
      'Private draft headline'
    );
    assert.equal((await call('/api/content/draft')).status, 401);
    assert.equal((await call('/api/content/draft', 'GET', undefined, cookie)).status, 403);
    const largeContent = {
      ...DEFAULT_PUBLIC_SITE_CONTENT,
      featureCards: Array.from({ length: 12 }, (_, index) => ({
        title: `Feature ${index} `.padEnd(120, 'x'),
        description: 'd'.repeat(500)
      })),
      marketingMetrics: Array.from({ length: 6 }, () => ({ value: 'v'.repeat(40), label: 'l'.repeat(120) })),
      multiBranchBenefits: Array.from({ length: 8 }, () => ({ title: 't'.repeat(120), description: 'd'.repeat(500) })),
      branchPreview: {
        organizationName: 'x'.repeat(180),
        activeBranchesLabel: 'x'.repeat(180),
        flagshipName: 'x'.repeat(180),
        flagshipDetails: 'x'.repeat(180),
        secondBranchName: 'x'.repeat(180),
        secondBranchDetails: 'x'.repeat(180),
        singleBranchNotice: 'x'.repeat(180),
        singleBranchName: 'x'.repeat(180),
        singleBranchDetails: 'x'.repeat(180)
      }
    };
    assert.ok(Buffer.byteLength(JSON.stringify({ content: largeContent, publish: false })) > 16_384);
    assert.ok(Buffer.byteLength(JSON.stringify({ content: largeContent, publish: false })) < 32_768);
    const largeDraftSave = await call('/api/content', 'PUT', {
      publish: false,
      content: largeContent
    }, adminCookie);
    assert.equal(largeDraftSave.status, 200, await largeDraftSave.clone().text());
    const contentUpdate = await call('/api/content', 'PUT', {
      publish: true,
      content: {
        ...DEFAULT_PUBLIC_SITE_CONTENT,
        brandName: 'NileLink Stock',
        logoUrl: 'https://assets.example.com/logo.png',
        headline: 'A new public headline',
        pricingHeadline: 'Plans that fit your business',
        marketingMetrics: [{ value: 'Tenant-ready', label: 'Content controlled by the owner' }],
        multiBranchBenefits: [{ title: 'Custom benefit', description: 'Updated by the platform administrator.' }],
        branchPreview: {
          ...DEFAULT_PUBLIC_SITE_CONTENT.branchPreview,
          organizationName: 'Updated illustrative organization'
        },
        pageLabels: {
          ...DEFAULT_PUBLIC_SITE_CONTENT.pageLabels,
          ownerSignIn: 'Business account login'
        }
      }
    }, adminCookie);
    assert.equal(contentUpdate.status, 200);
    const publicContent = await call('/api/content');
    const published = await publicContent.json() as {
      content: {
        brandName: string;
        logoUrl: string;
        headline: string;
        pricingHeadline: string;
        marketingMetrics: { value: string; label: string }[];
        multiBranchBenefits: { title: string; description: string }[];
        branchPreview: { organizationName: string };
        pageLabels: { ownerSignIn: string };
      };
    };
    assert.equal(published.content.brandName, 'NileLink Stock');
    assert.equal(published.content.logoUrl, 'https://assets.example.com/logo.png');
    assert.equal(published.content.headline, 'A new public headline');
    assert.equal(published.content.pricingHeadline, 'Plans that fit your business');
    assert.equal(published.content.marketingMetrics[0].value, 'Tenant-ready');
    assert.equal(published.content.multiBranchBenefits[0].title, 'Custom benefit');
    assert.equal(published.content.branchPreview.organizationName, 'Updated illustrative organization');
    assert.equal(published.content.pageLabels.ownerSignIn, 'Business account login');
    const invalidLogo = await call('/api/content', 'PUT', {
      publish: true,
      content: { ...DEFAULT_PUBLIC_SITE_CONTENT, logoUrl: 'javascript:alert(1)' }
    }, adminCookie);
    assert.equal(invalidLogo.status, 400);
    const invalidMetric = await call('/api/content', 'PUT', {
      publish: true,
      content: {
        ...DEFAULT_PUBLIC_SITE_CONTENT,
        marketingMetrics: [{ value: 'x'.repeat(41), label: 'Invalid metric' }]
      }
    }, adminCookie);
    assert.equal(invalidMetric.status, 400);
    const unauthenticatedContentUpdate = await call('/api/content', 'PUT', {
      publish: true,
      content: DEFAULT_PUBLIC_SITE_CONTENT
    });
    assert.equal(unauthenticatedContentUpdate.status, 401);

    const ownerSubscriptionChange = await call(
      `/api/tenants/${registrationData.tenant.id}`,
      'PUT',
      { status: 'SUSPENDED' },
      cookie
    );
    assert.equal(ownerSubscriptionChange.status, 400);
    const adminSuspension = await call(
      `/api/tenants/${registrationData.tenant.id}`,
      'PUT',
      { status: 'SUSPENDED' },
      adminCookie
    );
    assert.equal(adminSuspension.status, 200);
    assert.equal((await call('/api/tenants', 'GET', undefined, cookie)).status, 401);

    const adminReactivation = await call(
      `/api/tenants/${registrationData.tenant.id}`,
      'PUT',
      { status: 'ACTIVE', paidUntil: registrationData.tenant.paidUntil },
      adminCookie
    );
    assert.equal(adminReactivation.status, 200);

    const passwordChange = await call('/api/auth/change-password', 'POST', {
      password: 'platform admin password is sufficiently long',
      newPassword: 'a different platform administrator password',
      totp: await currentTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET)
    }, adminCookie);
    assert.equal(passwordChange.status, 200);
    const refreshedAdminCookie = passwordChange.headers.get('set-cookie')?.split(';')[0];
    assert.ok(refreshedAdminCookie);
    assert.equal((await call('/api/tenants', 'GET', undefined, adminCookie)).status, 401);
    assert.equal((await call('/api/auth/login', 'POST', {
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      password: 'platform admin password is sufficiently long',
      totp: await currentTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET)
    })).status, 401);
    const updatedPasswordLogin = await call('/api/auth/login', 'POST', {
      email: env.BOOTSTRAP_ADMIN_EMAIL,
      password: 'a different platform administrator password',
      totp: await currentTotp(env.BOOTSTRAP_ADMIN_TOTP_SECRET)
    });
    assert.equal(updatedPasswordLogin.status, 200);
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
  }
});
