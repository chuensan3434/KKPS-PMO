# KKPS-PMO Engineering Decisions

This file records why architecturally meaningful decisions were made. Add entries only for decisions that have been explicitly agreed.

## ADR Template

```md
## ADR-XXX — Decision title

**Status:** Proposed | Accepted | Superseded

**Date:** YYYY-MM-DD

### Context

Why was a decision required?

### Decision

What was agreed?

### Reason

Why was this approach chosen?

### Consequences

What should future implementation know?
```

## ADR-001 — Incremental Rebuild

**Status:** Accepted

**Date:** 2026-09-04

### Context

KKPS-PMO needs to be rebuilt while keeping each stage understandable and stable.

### Decision

KKPS-PMO will be rebuilt incrementally using small, scoped, verifiable phases rather than implementing the entire system at once.

### Reason

Incremental delivery limits risk and makes changes easier to review and validate.

### Consequences

Each major phase must build successfully and be deployable before the next major phase begins.

## ADR-002 — Repository as Engineering Source of Truth

**Status:** Accepted

**Date:** 2026-09-04

### Context

Engineering practices must persist independently of individual conversations or coding sessions.

### Decision

`docs/ENGINEERING_STANDARDS.md` is the persistent source of truth for how KKPS-PMO is implemented. Important architectural decisions are recorded in `docs/DECISIONS.md`.

### Reason

Version-controlled guidance is visible, reviewable, and available to every contributor and coding agent.

### Consequences

Future Codex and Claude implementation requirements must instruct the coding agent to inspect and follow these files before implementation.

## ADR-003 — Authentication Postponed

**Status:** Accepted

**Date:** 2026-09-04

### Context

The core PMO workflows need to be established before authentication and authorization add access-control complexity.

### Decision

Authentication and authorization will be implemented after the core PMO functionality is working.

### Reason

This keeps the initial functional rebuild focused on validating the core domain behavior.

### Consequences

Projects, Resources, Manday, Dashboard, and related core functionality must not unnecessarily depend on authentication during the initial rebuild. Authentication must not be added implicitly by another task.

## ADR-004 — Supabase Data Preservation

**Status:** Accepted

**Date:** 2026-09-04

### Context

The connected Supabase project may contain valuable existing data and valid configuration.

### Decision

Existing Supabase data and valid configuration must be preserved during the rebuild.

### Reason

Implementation convenience must not put existing project information at risk.

### Consequences

No destructive resets, migrations, schema replacements, or data deletion may be used as implementation shortcuts without explicit approval.

## ADR-005 — Reference-Pattern Development

**Status:** Accepted

**Date:** 2026-09-04

### Context

Similar modules can drift into competing structures when implemented independently.

### Decision

Once a module or shared implementation pattern is completed and accepted, later similar modules must inspect and reuse that pattern where appropriate rather than inventing parallel architecture.

### Reason

Reference patterns improve consistency and reduce unnecessary design decisions.

### Consequences

For example, once Projects establishes the approved CRUD, data-access, and form pattern, Resources should reuse that pattern where appropriate.
