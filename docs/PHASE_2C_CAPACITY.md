# Phase 2C Capacity Period Integrity

Capacity Period ranges and Sprint removal or renumbering serialize through a
transaction-level PostgreSQL advisory lock derived from the Calendar UUID.

- A Capacity Period insert or active-range update locks its Calendar key, then
  verifies that the number of Sprint rows in the inclusive sequence range is
  exactly `end_sprint - start_sprint + 1`.
- Sprint deletion or sequence/calendar reassignment locks the same Calendar key
  before checking active Capacity Period references.
- Moving a Sprint between Calendars locks both Calendar keys in UUID order to
  avoid inconsistent lock ordering and deadlocks.
- Locks last until transaction completion. They do not require granting browser
  roles UPDATE access to `sprint_calendars`. Normal browser writes hold them for
  one short statement; bulk Calendar maintenance should use short transactions
  because Capacity writes for that Calendar wait behind the lock.
- The 64-bit key uses `hashtextextended(calendar_id::text, 0)`. A hash collision
  can only add serialization; it cannot allow an invalid range.
- Sprint insertions and date-only corrections do not invalidate sequence
  continuity and do not acquire this guard lock.

Archived periods are excluded from overlap and Sprint-protection checks. They
are fully immutable and cannot be restored. Reusing their former range requires
inserting a new active period.
