# NileLink Stock

BarStock Pro is a mobile-first inventory and stock management app for cafes and restaurants. It includes stock tracking, branch transfers, supplier orders, waste reporting, inventory insights, and offline-friendly PWA support.

## Getting started

Requirements: Node.js 22 or newer and npm.

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
