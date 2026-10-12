# Planning Phase 0–1 Foundation

## Architecture and data flow

The existing `/planning` page remains the active Planning application. Its Roadmap and Effort Estimation state continues to load from and save to the existing browser keys:

- `kkps-pmo:roadmap-planning:v1`
- `kkps-pmo:effort-estimation:v1`

No Planning, Estimation, or Dashboard data source has been switched to Supabase.

```text
Existing Planning UI → existing React state → existing localStorage keys
                                      (unchanged)

Future shared UI/server boundary → validated resource-capacity models
                                 → existing Supabase client factory
                                 → RLS-protected master tables
```

The `src/features/resource-capacity` module is a shared domain boundary, not another Planning application. Its repositories validate inputs and returned records. With the Phase 1 migration alone, Data API roles cannot read or write these tables because authentication and ownership rules are not approved yet.

## Local verification

Prerequisites:

- Node.js 20.9 or newer.
- npm.
- Docker-compatible container runtime for the local Supabase stack.

Install and verify application behavior:

```bash
npm install
npm test
npm run test:browser
npm run lint
npm run build
```

The browser suite starts the Next.js development server. Install its browser once if needed:

```bash
npx playwright install chromium
```

Verify the additive migration in an isolated local database:

```bash
npx supabase start
npx supabase db reset
npx supabase test db
```

These commands operate on the local Supabase stack. Do not run `supabase db push`, link a production project, or paste this migration into a production SQL editor without a separately approved release plan.

## Optional 2027 development seed

The agreed baseline seed lives at `supabase/seeds/2027_sprints.sql`. It is deliberately outside the automatic seed path. It represents 14-day coverage from Monday through Sunday and preserves the existing UI display end on the second Friday.

Apply it only to an isolated local database after reviewing the dates:

```bash
psql "$LOCAL_DATABASE_URL" --set ON_ERROR_STOP=1 --file supabase/seeds/2027_sprints.sql
```

The seed is idempotent by calendar code and sprint sequence. It inserts no squads, people, memberships, or projects.

## Security boundary

All Phase 1 tables have RLS enabled. `anon` and `authenticated` privileges are revoked, and there are no client access policies. This intentional deny-all posture means the typed repositories will return authorization errors when called through a browser publishable client.

Before enabling shared reads or edits, approve and implement:

1. Authentication provider and sign-in lifecycle.
2. PMO viewer/editor/admin ownership rules.
3. Row-level access predicates for every operation.
4. Database policy tests for allowed and denied identities.

Never add a service-role or secret key to a `NEXT_PUBLIC_*` variable.

## Existing localStorage backup and future mapping

Before any later cutover, export the two values from browser developer tools without deleting them:

```js
const backup = {
  exportedAt: new Date().toISOString(),
  planning: localStorage.getItem("kkps-pmo:roadmap-planning:v1"),
  estimation: localStorage.getItem("kkps-pmo:effort-estimation:v1"),
};
copy(JSON.stringify(backup, null, 2));
```

Future import must be explicit and reviewed:

| Legacy field | Mapping rule |
|---|---|
| `squadId` | Map to a stable `squads.id` through an import mapping table/file. |
| `squadName` | Preserve as evidence; match to a reviewed alias, never automatically to an editable display name. |
| year + sprint index | Resolve against an approved `sprint_calendars` record and stable `sprints.id`. |
| `testMd` | Map explicitly to future QA demand while retaining the original payload. |
| local project ID | Map to a new stable project UUID; never overwrite a shared project solely by matching its name. |

Phase 1 does not import, overwrite, or erase browser-local records.

## Schema guarantees

- At most 15 active squads. An atomically updated singleton counter row serializes concurrent activation checks and rejects the sixteenth activation.
- Inactive squads and foreign-key references are retained.
- Aliases are unique by source and normalized external name and survive squad renaming.
- A person has no overlapping primary squad membership periods.
- Sprint IDs are stable; calendars may coexist across years.
- Sprint sequence, code, and start date are unique within a calendar.
- Projects are independent of squads, leaving later project/squad/sprint effort tables additive.

## Deferred by design

- Planning UI changes and Supabase cutover.
- Authentication and client access policies.
- Project/squad effort and sprint-demand tables.
- Person sprint allocations and capacity calculations.
- Dashboard alias cutover.
- Person-level project assignments.
