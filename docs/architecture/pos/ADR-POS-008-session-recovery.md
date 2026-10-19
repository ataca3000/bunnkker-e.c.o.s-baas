# ADR-POS-008 — POS Session Recovery Policy

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

If a POS session is interrupted (browser crash, device restart, network loss), the cashier may attempt to resume on the same device or on a different device. The system must decide whether to automatically recover the session or require supervisor intervention.

## Decision

Session recovery follows a **device-identity policy**:

**Same device (matching `terminal_id` + `device_fingerprint`):**  
Automatic recovery. The session state is restored from the local encrypted IndexedDB store. Any queued offline operations are synced. The cashier is prompted to confirm their identity (PIN or biometric) but no supervisor is needed.

**Different device (same `terminal_id`, different `device_fingerprint`):**  
**Supervisor review required.** The session is placed in `RecoveryPending` state. A supervisor must approve the recovery on the new device before the cashier can continue. The supervisor sees the open cart, last known cash drawer state, and any queued offline operations.

The rationale: a different device could indicate a stolen terminal or a deliberate attempt to circumvent the shift's cash accountability.

**Session timeout (no activity for > shift max duration):**  
The session is automatically closed (treated as an abandoned shift) and a supervisor review is triggered regardless of device.

## Consequences

**Positive:**
- Same-device recovery is seamless — minimal cashier friction for the common case (browser refresh, quick restart).
- Different-device recovery has a security gate — prevents session hijacking.

**Negative / Watch-outs:**
- The `device_fingerprint` must be stable across browser refreshes on the same device. Canvas fingerprinting + user-agent hash is used; persistent storage is preferred if available.
- If a device is replaced urgently mid-shift, the supervisor approval step adds latency. This is acceptable for the security benefit.

## Alternatives Considered

- **Always require supervisor** — rejected. Unnecessary friction for simple browser refreshes.
- **Always auto-recover regardless of device** — rejected. Security risk.
