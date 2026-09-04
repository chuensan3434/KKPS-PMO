# KKPS-PMO Engineering Standards

This file is the persistent source of truth for how KKPS-PMO is built. Read it before every implementation task and keep changes small enough to review, verify, and deploy independently.

## Project Standards

Before implementing:

1. Read `docs/ENGINEERING_STANDARDS.md`.
2. Read relevant entries in `docs/DECISIONS.md`.
3. Inspect the existing implementation and related modules.
4. Reuse established project patterns.
5. Keep changes limited to the requested scope.
6. Preserve existing data and behavior.
7. If the task requires a cross-module, destructive, or project-wide architectural change, stop and report the impact before implementing it.
8. If the task introduces a potentially reusable engineering convention, report it as a proposed standards update. Do not make it a project-wide rule until approved.
9. Run and report the required verification checks.

## Core Development Principle

```text
Inspect existing implementation
        ↓
Reuse established patterns
        ↓
Implement one scoped change
        ↓
Preserve existing data/behavior
        ↓
Run verification
        ↓
Deploy/verify when applicable
        ↓
Only then continue
```

Prefer small, reviewable, deployable changes over large multi-module rewrites.

## Repository Architecture

The Phase 0 application currently uses:

- `src/app/` for App Router pages, layouts, and global styles.
- `src/lib/supabase/` for environment validation and browser/server Supabase clients.
- `public/` for static assets when assets are introduced.

Use these responsibility boundaries as the application grows:

- `src/components/` for reusable, shared UI.
- `src/features/` for feature and business modules such as Projects, Resources, Manday, Dashboard, Reports, and Settings.
- `src/lib/` for shared integrations and utilities.
- `src/hooks/` for reusable React hooks.
- `src/types/` for shared TypeScript types.

Do not create duplicate locations for the same responsibility. Keep feature-specific logic inside its feature module where practical. Avoid catch-all files such as `utils.ts`, `helpers.ts`, `supabase.ts`, or oversized `page.tsx` files containing unrelated application logic.

## Module Boundary Rules

1. Modify only the requested module and genuinely required shared code.
2. Do not silently refactor unrelated modules.
3. Create shared abstractions only when reuse is real or clearly imminent.
4. Inspect and reuse existing shared components and helpers instead of duplicating them.
5. If a change requires significant cross-module work, stop and report its impact before implementation.
6. Use an accepted, completed module as the reference pattern for similar later modules where appropriate.

Authentication is a future module and must not be introduced implicitly.

## Naming and TypeScript Conventions

- Use descriptive names and avoid unexplained abbreviations.
- Write application source in TypeScript (`.ts`/`.tsx`), not JavaScript.
- Use explicit domain types where they improve clarity.
- Avoid `any`; if unavoidable, document why at the usage site.
- Reuse established domain models instead of duplicating them.
- Use PascalCase for React component names and descriptive lowercase route/directory names.
- Follow the existing `createClient` naming used by the Supabase client helpers where that pattern applies.
- Remove dead code introduced by a task.
- Do not retain commented-out implementations as permanent code.

## React and Next.js Conventions

- Use App Router conventions.
- Prefer Server Components when browser state, events, or hooks are not required.
- Add `"use client"` only at the lowest boundary that needs browser behavior.
- Separate data and business concerns from large presentation components.
- Place reusable UI in established shared components.
- Keep route and page files focused on route composition rather than entire feature implementations.
- Preserve clean existing patterns instead of inventing parallel architecture.

## Supabase and Data Access Rules

1. Read Supabase configuration from environment variables.
2. Never hardcode credentials.
3. Never expose a secret or legacy service-role credential to browser code. Only intentionally public publishable values may use `NEXT_PUBLIC_`.
4. Preserve existing records and schema by default.
5. Do not run destructive migrations without explicit approval.
6. Never reset a database to solve an implementation problem.
7. Never replace real records with mock or seed data.
8. Make schema changes intentional and report them.
9. Prefer feature-specific data-access boundaries over one giant Supabase query file.
10. Do not make builds unnecessarily depend on live production records.

Authentication remains postponed and may be introduced only by an explicit later requirement.

## Database Migration Rules

- Use version-controlled migrations rather than undocumented manual schema edits where the project supports them.
- Keep migrations incremental and document their purpose.
- Preserve existing data.
- Avoid destructive table or column changes unless explicitly approved.
- Report every schema and data change in the implementation summary.
- Never silently reset Supabase.

If a task appears to require a destructive migration, stop and request approval.

## UI and Design Consistency

- Inspect existing sibling pages and components before implementing UI.
- Reuse the existing layout and shared components.
- Preserve typography, spacing, colors, borders, shadows, responsive behavior, and interaction patterns.
- Do not create a separate design system for one feature.
- Support reasonable desktop and mobile states.
- Include relevant loading, empty, error, and disabled states.

Once an application shell and design language are accepted, they become the reference for future screens.

## Error, Loading, and Empty States

User-facing data features must handle relevant loading, empty, error, success, and disabled/submitting states. Do not silently swallow operational errors. User-facing messages must be understandable and must not expose secrets or sensitive internal details.

## Environment Variables

- Never commit real secrets.
- Keep only variable names and safe placeholders in `.env.example`.
- Document every new environment variable.
- Treat browser-exposed variables as intentionally public.
- Report environment-variable changes in the final implementation summary.

The current Supabase variables are `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

## Verification Standard

Run checks relevant to every implementation. At minimum, when available:

```bash
npm run lint
npm run build
```

Also run configured type checks and relevant tests. Fix errors introduced by the task. Report actual command results, distinguish existing warnings from new problems, and never claim a check or Vercel deployment passed unless it was performed and observed.

## Deployment Discipline

```text
small scoped change
→ local verification
→ commit
→ Vercel deployment
→ verify
→ next change
```

Keep major features in separate implementation and deployment cycles when reasonable.

## Dependency Rules

Before adding a dependency:

1. Check whether the existing stack already solves the problem.
2. Avoid packages for trivial utilities.
3. Choose maintained packages compatible with the current stack.
4. Do not replace major libraries without an explicit reason and approval.
5. Report every dependency added or removed.

## Data Preservation Rule

> Existing Supabase records, project data, profiles, settings, fields, and valid configuration are preserved by default. Implementation tasks must not delete, reset, overwrite, or replace existing data unless the requirement explicitly authorizes it.

## New Engineering Decisions and Updating the Way of Work

When a task reveals a reusable convention:

1. Do not silently turn a one-off implementation choice into a project-wide standard.
2. Report the proposed convention.
3. After explicit agreement or approval, update this file.
4. If the decision is architecturally meaningful, also record it in `docs/DECISIONS.md`.
5. Apply the approved standard to future implementation requests.

This process applies to conventions such as module structure, CRUD and Supabase query patterns, shared forms, error handling, dashboard calculations, date/time handling, and testing.
