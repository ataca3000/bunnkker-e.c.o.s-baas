# ADR-POS-011: PostgreSQL Advisory Locks for Session and Shift Open Serialization

**Status:** Accepted  
**Date:** 2026-07-01  
**Package:** PKG-POS-019 (Architecture Hardening)

---

## Context

`OpenSessionService` and `OpenShiftService` both had a TOCTOU (Time-Of-Check-Time-Of-Use) race:

```
Thread A: hasOpenSession() → false
Thread B: hasOpenSession() → false   ← race window
Thread A: save(session)
Thread B: save(session)              ← duplicate
```

Because the duplicate-check and the insert happen in separate statements, two concurrent requests can both pass the check and both insert — creating two open sessions for the same terminal, or two open shifts for the same session.

---

## Decision

Wrap the entire open operation (check + create + save) in a `DB::transaction()` and acquire a **PostgreSQL advisory exclusive lock** at the start of the transaction:

```php
DB::transaction(function () use ($command, &$session): void {
    DB::statement('SELECT pg_advisory_xact_lock(hashtext(?))', [$command->terminalId]);
    // check + create + save are now atomic
});
```

- `pg_advisory_xact_lock(bigint)` acquires a session-level exclusive lock that is automatically **released at transaction end**, making it safe without any manual cleanup.
- `hashtext()` maps an arbitrary string to a 32-bit PostgreSQL integer, which is required by the advisory lock API. Hash collisions across different terminal/session IDs are statistically negligible for the scale of POS operations.
- For session opens: the lock key is `hashtext($terminalId)`.
- For shift opens: the lock key is `hashtext($sessionId . '-shift')`, isolating it from session locks.

---

## Consequences

**Good:**
- The duplicate-check, numbering query, and insert are now fully atomic — no gap can be exploited between them.
- Advisory locks are in-memory and do not acquire row locks on non-existent rows, avoiding deadlocks with unrelated operations.
- Locks release automatically on transaction commit or rollback — no cleanup burden.
- No schema changes required.

**Neutral:**
- Serialises concurrent open attempts for the same terminal/session, which is the correct behaviour (only one open session per terminal at a time).
- `hashtext()` is a PostgreSQL-specific function; this ties the implementation to PostgreSQL, which is already the required database per ADR-POS-001.

**Mitigation for hash collisions:**
- `hashtext()` produces a 32-bit integer. For the POS domain, the number of distinct terminal and session IDs active at the same time is small (dozens to hundreds). The probability of a collision causing a false serialisation is negligible.
