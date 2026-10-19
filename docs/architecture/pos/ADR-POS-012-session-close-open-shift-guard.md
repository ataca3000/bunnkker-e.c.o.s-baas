# ADR-POS-012: Session Cannot Be Closed While a Shift Is Open

**Status:** Accepted  
**Date:** 2026-07-01  
**Package:** PKG-POS-019 (Architecture Hardening)

---

## Context

A POS session represents the cashier's workday boundary. Shifts are nested inside sessions and represent individual counting periods within that day. Closing a session while a shift is still open would leave the shift in an orphaned state: the session is closed, but no supervisor has approved the cashier's count.

The original `CloseSessionService` did not check for open shifts before closing the session.

---

## Decision

`CloseSessionService` now checks for an open shift before allowing session closure:

```php
if ($this->shiftRepo->findOpenBySession($command->sessionId) !== null) {
    throw ShiftStillOpenException::forSession($command->sessionId);
}
```

`ShiftStillOpenException` returns HTTP 422 (Unprocessable Entity) with a human-readable message identifying the session.

The correct flow is:
1. Cashier submits shift for closure (`DELETE /api/pos/shifts/{shift}`)
2. Supervisor approves or rejects the count (`PUT /api/pos/shifts/{shift}/approve` or `/reject`)
3. Once the shift is `Closed`, the cashier can close the session (`DELETE /api/pos/sessions/{session}`)

---

## Consequences

**Good:**
- Prevents orphaned open shifts; every shift lifecycle must be completed before the session ends.
- Enforces the correct operational sequence (shift close → session close).

**Rejected Alternatives:**
- *Auto-close open shifts on session close*: Rejected because it bypasses supervisor approval of the cashier's count, which is a financial control requirement.
- *Ignore open shifts*: Rejected because orphaned shifts break reporting (shift duration, variance, etc.) and create audit gaps.
