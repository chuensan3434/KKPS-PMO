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

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Verification

```bash
npm run lint
npm run build
```

The homepage does not query Supabase, so builds do not depend on live database records. Supabase helpers validate the required configuration when a client is created and report a clear error when it is missing.

## Deployment

Deploy with Vercel's standard Next.js settings. Configure both required Supabase variables for each Vercel environment before deploying. No custom Vercel configuration is required.
