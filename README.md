# KKPS PMO

Foundation for the KKPS Project Management Office application. Phase 0 provides a minimal Next.js App Router application with TypeScript, Tailwind CSS, ESLint, and Supabase client helpers. Authentication and PMO business modules are intentionally out of scope.

## Prerequisites

- Node.js 20.9 or newer (as required by Next.js 16)
- npm
- An existing Supabase project

## Installation

```bash
npm install
```

Copy the environment template and replace its placeholders with the Project URL and publishable key from the Supabase project Connect panel:

```bash
cp .env.example .env.local
```

Required variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Never place a Supabase secret or legacy service-role key in a `NEXT_PUBLIC_` variable.

## Demo Mode

Local development uses the existing browser-local mock repositories when `NEXT_PUBLIC_LOCAL_MOCK_DATA=true`. To enable the same Demo Mode on Vercel Preview deployments, set `NEXT_PUBLIC_DEMO_MODE=true` only for the Preview environment. The preview gate also requires Vercel's server-side `VERCEL_ENV=preview`; Production always uses authenticated Supabase Mode even if the public flag is mistakenly present.

Demo data is stored under `kkps-pmo:local-mock-data:v1` in the current browser. It is not shared between users or devices, is not synchronized to Supabase, and may be lost when browser storage is cleared. Existing stored mock data and unrelated legacy localStorage keys are left unchanged. To disable Demo Mode later, remove or set the applicable demo variable to `false`; no authentication code or database policy needs to change.

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm test
npm run test:browser
npm run lint
npm run build
```

Planning Phase 0–1 local database setup, security posture, browser-data backup, and optional sprint seeding are documented in [`docs/PLANNING_PHASE_0_1.md`](docs/PLANNING_PHASE_0_1.md).

The homepage does not query Supabase, so builds do not depend on live database records. Supabase helpers validate the required configuration when a client is created and report a clear error when it is missing.

## Deployment

Deploy with Vercel's standard Next.js settings. Configure both required Supabase variables for each Vercel environment before deploying. No custom Vercel configuration is required.
