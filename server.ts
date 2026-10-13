import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { DEFAULT_SUBSCRIPTION_PLANS } from './src/data/initialData';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json());

if (isProd) {
  app.use('/api', (_req, res) => {
    res.status(503).json({ error: 'The Express API is development-only. Use the Cloudflare Pages Functions backend.' });
  });
}

// In-Memory Database for backend persistence (mirrors / stores tenants and plans)
let tenantsDb = [
  {
    id: 'nile-flagship',
    name: 'Demo Specialty Roastery',
    adminEmail: 'management@example.com',
    adminPhone: '+1 202-555-0101',
    city: 'Flagship Roastery',
    plan: 'Multi-Branch & Chain Enterprise',
    planId: 'plan-enterprise',
    accessCode: 'DEMO-ENTERPRISE-01',
    paidUntil: '2026-12-31',
    status: 'ACTIVE',
    currency: '$',
    created: '2026-01-15',
    organizationId: 'org-nile',
    isMultiBranch: true
  },
  {
    id: 'nile-branch-01',
    name: 'Demo Bistro & Coffee - Branch 2',
    adminEmail: 'branch2@example.com',
    adminPhone: '+1 202-555-0102',
    city: 'Downtown Plaza',
    plan: 'Multi-Branch & Chain Enterprise',
    planId: 'plan-enterprise',
    accessCode: 'DEMO-ENTERPRISE-02',
    paidUntil: '2026-12-31',
    status: 'ACTIVE',
    currency: '$',
    created: '2026-03-01',
    organizationId: 'org-nile',
    isMultiBranch: true
  },
  {
    id: 'artisan-single-01',
    name: 'Example Artisan Espresso',
    adminEmail: 'owner@example.com',
    adminPhone: '+1 202-555-0103',
    city: 'Harbor Marina',
    plan: 'Espresso Solo / Starter',
    planId: 'plan-starter',
    accessCode: 'DEMO-STARTER-01',
    paidUntil: '2026-11-30',
    status: 'ACTIVE',
    currency: '$',
    created: '2026-02-10',
    organizationId: 'org-apex',
    isMultiBranch: false
  }
];

let plansDb = DEFAULT_SUBSCRIPTION_PLANS.map(plan => ({ ...plan, features: [...plan.features] }));
let contentDb = {
  headline: 'Smarter stock management for hospitality teams',
  description: 'Control inventory, reduce waste, and coordinate every location from one place.',
  features: ['Stock tracking', 'Branch transfers', 'Waste insights', 'Offline workflows']
};

// --- REST API ENDPOINTS ---

// 1. Health check & Cloudflare edge metadata
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    platform: 'BarStock SaaS OS',
    edgeCompatible: true,
    cloudflarePagesReady: false,
    timestamp: new Date().toISOString(),
    tenantsCount: tenantsDb.length
  });
});

// 2. Tenants API (List and Register)
app.get('/api/tenants', (req, res) => {
  res.json({ success: true, tenants: tenantsDb });
});

app.post('/api/tenants/register', (req, res) => {
  const { name, adminEmail, adminPhone, city, planId, branchesCount = 1, currency = '$' } = req.body;

  if (!name || !adminEmail) {
    return res.status(400).json({ success: false, message: 'Name and email are required' });
  }

  const plan = plansDb.find(p => p.id === planId) || plansDb[0];
  const slug = name.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
  const code = `NL-${Math.floor(1000 + Math.random() * 9000)}-${slug}`;

  const expiry = new Date();
  expiry.setDate(expiry.getDate() + 14); // 14-day trial

  const newTenant = {
    id: `tenant-${Date.now()}`,
    name,
    adminEmail,
    adminPhone,
    city,
    plan: plan.name,
    planId: plan.id,
    accessCode: code,
    paidUntil: expiry.toISOString().slice(0, 10),
    status: 'TRIAL',
    currency,
    created: new Date().toISOString().slice(0, 10),
    organizationId: `org-${Date.now()}`,
    isMultiBranch: Number(branchesCount) > 1
  };

  tenantsDb.unshift(newTenant);
  res.status(201).json({ success: true, tenant: newTenant });
});

// 3. Update Tenant License & Status
app.put('/api/tenants/:id', (req, res) => {
  const { id } = req.params;
  const index = tenantsDb.findIndex(t => t.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Tenant not found' });
  }

  tenantsDb[index] = { ...tenantsDb[index], ...req.body };
  res.json({ success: true, tenant: tenantsDb[index] });
});

// 4. Plans API
app.get('/api/plans', (req, res) => {
  res.json({ success: true, plans: plansDb });
});

app.put('/api/plans/:id', (req, res) => {
  const { id } = req.params;
  const index = plansDb.findIndex(p => p.id === id);

  if (index === -1) {
    return res.status(404).json({ success: false, message: 'Plan not found' });
  }

  plansDb[index] = { ...plansDb[index], ...req.body };
  res.json({ success: true, plan: plansDb[index] });
});

app.get('/api/content', (_req, res) => {
  res.json({ success: true, content: contentDb });
});

app.put('/api/content', (req, res) => {
  const { content } = req.body || {};
  if (!content || typeof content.headline !== 'string' || typeof content.description !== 'string' ||
      !Array.isArray(content.features) || !content.features.every((feature: unknown) => typeof feature === 'string')) {
    return res.status(400).json({ error: 'Invalid public website content.' });
  }
  contentDb = {
    headline: content.headline,
    description: content.description,
    features: content.features
  };
  res.json({ success: true, content: contentDb, published: true });
});

// 5. Super Admin SaaS Analytics
app.get('/api/superadmin/analytics', (req, res) => {
  const activeCount = tenantsDb.filter(t => t.status === 'ACTIVE' || t.status === 'TRIAL').length;
  const mrr = tenantsDb.reduce((sum, t) => {
    const plan = plansDb.find(p => p.id === t.planId);
    return sum + (plan ? plan.price : 49);
  }, 0);

  const expiringCount = tenantsDb.filter(t => {
    const diff = new Date(t.paidUntil).getTime() - Date.now();
    const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
    return days <= 7 && days >= 0;
  }).length;

  res.json({
    success: true,
    analytics: {
      totalTenants: tenantsDb.length,
      activeTenants: activeCount,
      mrr,
      arr: mrr * 12,
      expiringWithin7Days: expiringCount,
      multiBranchChains: tenantsDb.filter(t => t.isMultiBranch).length
    }
  });
});

// 6. Central Database Pending Sync Batch
app.post('/api/sync', (req, res) => {
  const { cafeId, actions = [] } = req.body;
  res.json({
    success: true,
    syncedCount: actions.length,
    processedAt: new Date().toISOString()
  });
});

// --- SERVER SETUP & VITE MIDDLEWARE ---
async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    // Serve static files in production
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(Number(PORT), '127.0.0.1', () => {
    console.log(`BarStock local preview server running at http://127.0.0.1:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
