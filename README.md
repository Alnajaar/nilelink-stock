# NileLink Stock

BarStock Pro is a mobile-first inventory and stock management app for cafes and restaurants. It includes stock tracking, branch transfers, supplier orders, waste reporting, inventory insights, and offline-friendly PWA support.

## Getting started

Requirements: Node.js 22.12 or newer and npm.

```sh
npm ci
npm run dev
```

The local Express server starts on port `3000` by default. Set `PORT` to use a different port.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm run build` | Build the production frontend |
| `npm run preview` | Preview the production frontend |
| `npm run lint` | Run the TypeScript check |

## Demo data

The app includes synthetic tenant, supplier, access-code, and staff PIN data for demonstration. These values are not production credentials. The local Express API stores tenant and plan changes in memory, so they are reset when the server restarts.

## Cloudflare backend status

The Cloudflare Pages Functions backend provides D1-backed account registration, owner and Super Admin authentication, plan/content administration, employee records, and timekeeping. Wrangler binds the production Pages environment to `nilelink-stock-production` and the preview environment to `nilelink-stock-staging`; apply and verify migrations in each environment before deployment.

The D1 schema is in `migrations/`. Configure the required server-side secrets (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_TOKEN`, `BOOTSTRAP_ADMIN_TOTP_SECRET`, `EMPLOYEE_PIN_PEPPER`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_SITE_KEY`) separately for preview and production before enabling account creation or administration. Never put secret values in Vite variables or source control. Bootstrap the platform administrator once through `/api/auth/setup` using the configured email, a random one-time token of at least 32 characters, a strong password, and the authenticator code; the endpoint rejects subsequent setup attempts. The public site has no Super Admin button: open `/?mode=superadmin` to reach the MFA-protected sign-in page. After signing in, change the password from the Super Admin dashboard's **Security** tab.

Authenticated cloud accounts load their inventory from D1 through `/api/inventory`; the browser remains an offline cache/outbox. Idempotent `/api/sync` operations now apply stock-in, stock-out, and waste quantities to the D1 inventory snapshot, and clients refresh the snapshot after confirmed sync. Inventory imports are persisted to D1 and checked against the plan's item limit. The Super Admin can edit and publish the public brand/logo, home and pricing-page copy, feature cards, marketing metrics, multi-branch benefits and showcase details, and plan prices/limits from the dashboard. Private CMS drafts are saved in D1 and reload only through the authenticated platform-admin endpoint. Interactive demo-role launchers are restricted to development builds. Branch transfers and branch/zone setup are still local-only and must not be treated as durable cross-branch workflows. Workforce screens support clock-in/out, breaks, manager review, and hourly gross estimates; configured salary rates are not prorated or included in payroll exports, and this is not statutory payroll. Real Cloudflare secret setup, authenticated live end-to-end tests, backups/restore validation, monitoring/rollback, and final deployment smoke tests remain outstanding. The production environment must remain disabled until these gates pass. Run `npm test`, `npm run lint`, and `npm run build` before further review; these local checks do not replace staging tests against Cloudflare.
