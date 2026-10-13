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

The Cloudflare Pages Functions backend provides D1-backed account registration, owner and Super Admin authentication, plan/content administration, employee records, and timekeeping. `wrangler.toml` deliberately contains a placeholder database ID: this checkout is **not deploy-ready**. Do not deploy it as a live SaaS until the remaining production work is completed and verified.

The D1 schema is in `migrations/0001_core.sql`. After creating the Cloudflare D1 database, replace the placeholder ID in `wrangler.toml` and apply migrations with Wrangler. Configure the `DB` binding and the required server-side secrets (`BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_TOKEN`, `BOOTSTRAP_ADMIN_TOTP_SECRET`, `EMPLOYEE_PIN_PEPPER`, `TURNSTILE_SECRET_KEY`, and `TURNSTILE_SITE_KEY`) in the Pages environment before enabling account creation or administration. Never put secret values in Vite variables or source control. Bootstrap the platform administrator once through `/api/auth/setup` using the configured email, a random one-time token of at least 32 characters, a strong password, and the authenticator code; the endpoint rejects subsequent setup attempts.

Inventory screens still use browser storage; `/api/sync` persists idempotent audit events but does not provide an authoritative inventory snapshot or cross-device recovery. Some onboarding selections (branch zones and starter stock) are local-only and are not provisioned in D1. Workforce screens support clock-in/out, breaks, manager review, and hourly gross estimates; configured salary rates are not prorated or included in payroll exports, and this is not statutory payroll. Cloudflare resource/secret provisioning, live D1 integration and end-to-end tests, backups/restore validation, and deployment smoke tests remain outstanding. Run `npm test`, `npm run lint`, and `npm run build` before further review; these local checks do not replace staging tests against Cloudflare.
