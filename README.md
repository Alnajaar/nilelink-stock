# NileLink Stock

BarStock Pro is a mobile-first inventory and stock management app for cafes and restaurants. It includes stock tracking, branch transfers, supplier orders, waste reporting, inventory insights, and offline-friendly PWA support.

## Getting started

Requirements: Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

The local Express server starts on port `3000` by default. Set `PORT` to use a different port.

GitHub Actions runs the API/security tests, TypeScript check, and production build on pushes and pull requests. CI does not deploy to Cloudflare or replace authenticated staging and release checks.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production frontend |
| `npm run preview` | Preview the production frontend |
| `npm run lint` | Run the TypeScript check |
| `npm test` | Run API and security tests |
| `npm audit --audit-level=high` | Fail on high or critical dependency advisories |

## Demo data

The app includes synthetic tenant, supplier, access-code, and staff PIN data for demonstration. These values are not production credentials. The local Express API stores tenant and plan changes in memory, so they are reset when the server restarts.

## Cloudflare backend status

The Cloudflare Pages Functions backend provides D1-backed account registration, owner and Super Admin authentication, plan/content administration, employee records, and timekeeping. Wrangler binds the production Pages environment to `nilelink-stock-production` and the preview environment to `nilelink-stock-staging`; apply and verify migrations in each environment before deployment.

The D1 schema is in `migrations/`. Configure the required server-side secrets (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_TOKEN`, `BOOTSTRAP_ADMIN_TOTP_SECRET`, `EMPLOYEE_PIN_PEPPER`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_SITE_KEY`) separately for preview and production before enabling account creation or administration. Never put secret values in Vite variables, source control, or chat. In the Cloudflare dashboard, open **Workers & Pages → nilelink-stock → Settings → Variables and Secrets**, select the Preview or Production environment, and add the six values there. `TURNSTILE_SECRET_KEY` and `TURNSTILE_SITE_KEY` must come from a Turnstile widget configured for the app's hostnames. Generate a random one-time bootstrap token and a separate random PIN pepper, each at least 32 characters; keep the bootstrap token only until the one-time setup succeeds. Set the bootstrap email to the administrator's email and generate/store the TOTP secret in an authenticator before setup.

Bootstrap the platform administrator once through `/api/auth/setup` using the configured email, one-time token, a strong password, and the authenticator code; the endpoint rejects subsequent setup attempts. The public site has no Super Admin button: open `/?mode=superadmin` to reach the MFA-protected sign-in page. After signing in, change the password from the Super Admin dashboard's **Security** tab. Do not put the one-time token, password, TOTP secret, PIN pepper, or Turnstile secret in a terminal command, issue, log, or chat message.

### Cloudflare release checklist

Run these checks from a clean checkout of the commit intended for release:

```powershell
git status --short
git switch main
git pull --ff-only origin main
npm ci
npm audit --audit-level=high
npm test
npm run lint
npm run build
```

Deploy and verify Preview before Production. Set all six secrets for Preview in the dashboard, and inspect the staging migration state:

```powershell
npx wrangler d1 migrations list nilelink-stock-staging --remote --env preview
```

If migrations are pending, export a backup to a secure location outside the repository and verify that it can be restored into a separate disposable D1 database before applying them:

```powershell
npx wrangler d1 export nilelink-stock-staging --remote --env preview --output "$env:USERPROFILE\nilelink-stock-staging-backup.sql"
npx wrangler d1 migrations apply nilelink-stock-staging --remote --env preview
npx wrangler d1 migrations list nilelink-stock-staging --remote --env preview
npx wrangler pages deploy dist --project-name nilelink-stock --branch preview
```

The backup contains business data: protect it, do not commit or upload it, and remove it only according to the organization's retention policy. Confirm the Preview deployment URL and verify `/api/health` reports HTTP 200 with `databaseReady` and `authConfigured` true. Complete authenticated owner and Super Admin login/MFA checks, registration and Turnstile checks, tenant/role isolation, inventory writes and refresh, timekeeping and manager review, CMS draft/publish, and browser reload/offline checks. Do not proceed if a check fails.

Production must stay blocked until the Preview acceptance checks pass, the production secrets are configured, and a production D1 backup has been exported and its restore verified against a separate disposable database. Confirm in Cloudflare Pages settings that `main` is the configured production branch; this project is Direct Upload and GitHub pushes do not deploy it. Review the exact production migrations and pending list before applying:

```powershell
npx wrangler d1 export nilelink-stock-production --remote --output "$env:USERPROFILE\nilelink-stock-production-backup.sql"
npx wrangler d1 migrations list nilelink-stock-production --remote
```

Only after reviewing the backup and migration results, apply pending production migrations and verify they are all applied:

```powershell
npx wrangler d1 migrations apply nilelink-stock-production --remote
npx wrangler d1 migrations list nilelink-stock-production --remote
```

Then, with `main` checked out and clean and all checks above passing, build and deploy the exact main commit. The `main` branch must already be configured as the Pages production branch; otherwise stop and resolve the Cloudflare project configuration first.

```powershell
npm run build
$commit = git rev-parse HEAD
npx wrangler pages deploy dist --project-name nilelink-stock --branch main --commit-hash $commit
```

After deployment, verify the production URL and custom domain, `/api/health` returning HTTP 200 with `databaseReady` and `authConfigured` true, and the authenticated smoke checks listed above. Keep the verified backup and a tested rollback procedure available. A healthy frontend response alone is not a release pass.

Authenticated cloud accounts load their inventory from D1 through `/api/inventory`; the browser remains an offline cache/outbox. Idempotent `/api/sync` operations now apply stock-in, stock-out, and waste quantities to the D1 inventory snapshot, and clients refresh the snapshot after confirmed sync. Inventory imports are persisted to D1 and checked against the plan's item limit. The Super Admin can edit and publish the public brand/logo, home and pricing-page copy, navigation and calculator labels, feature cards, marketing metrics, multi-branch benefits and showcase details, and plan prices/limits from the dashboard. Private CMS drafts are saved in D1 and reload only through the authenticated platform-admin endpoint. Interactive demo-role launchers are restricted to development builds. Branch transfers and branch/zone setup are still local-only and must not be treated as durable cross-branch workflows. Workforce screens support clock-in/out, breaks, manager review and corrections with audit reasons, configurable hourly or salary compensation, and compensation updates from the team roster; time entries snapshot configured compensation at clock-in so later rate changes do not rewrite prior hourly gross estimates. Salary-period proration, payroll taxes, and statutory deductions are not calculated. Production must remain disabled until the release checklist above passes, including authenticated staging tests, verified backups/restores, monitoring/rollback, and final deployment smoke tests.
