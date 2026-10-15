# N3-Protocol & Persistent Memory Layer for AI Assistants

## Master System Instructions (N3 Protocol)

1. First-Principles Protocol (N3)
- Phase A — Understand (No Code Modification): A15.1 Declare Objective, A13 Recursive Deconstruction, A01 Infeasibility Discard, A03 Bounding Box, A02 Execution Map.
- Phase B — Diagnose: A08 Forensic Autopsy, A07 Flags & Care Zones, A10 Security Checklist (Fail-Closed), A12 Scaling & Technical Debt.
- Phase C — Design: A06 Prior Art, A05 Algorithmic Core, A14 What-If Mutations, A15.2 Synchronicity & Dependencies, A09 Smoke-Free Plan.
- Phase D — Execute & Test: Git Checkpoints, A11 Senior-Grade Testing (Happy path, Failures, Invalid input, Idempotency).

2. Invariants of the Domain (BUNKKER E.C.O.S.)
- Local-first architecture (100% operative offline LAN via SQLite WAL).
- Single source of truth (SQLite WAL in local, PostgreSQL in Cloud).
- Lock-claim pattern for concurrent sales & stock.
- Append-only OrderEvent history.
- Idempotent writes.
- Strict tenant isolation (`getTenantId`).
- Zero float precision drift in money.
