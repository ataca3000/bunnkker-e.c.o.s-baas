# ADR-AIOP-002: AI Worker Communication Protocol
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

AI workers run on machines outside the ECOS ERP server (developer laptops, CI servers, cloud VMs). The control plane and workers must exchange:
- Task assignments (control plane → worker)
- Execution status updates (worker → control plane)
- Artifact uploads (worker → control plane)
- Heartbeats (worker → control plane)

We must choose a communication protocol that balances reliability, simplicity, firewall friendliness, and operational resilience.

---

## Options Evaluated

### Option A: Worker pulls via HTTP polling
- Worker calls `GET /api/aiop/worker/tasks/next` on a configured interval
- All communication is outbound from worker (firewall-friendly)
- Simple implementation; no persistent connection required
- Latency = poll interval (10–30 seconds acceptable for engineering tasks)

### Option B: Control plane pushes via WebSocket
- Persistent WebSocket from worker to control plane
- Near-zero latency for task assignment
- Requires persistent connection management, reconnect logic
- More complex; WebSocket is less common in developer tooling

### Option C: Message queue (Redis / SQS) shared between worker and control plane
- Worker subscribes to a queue channel
- Requires workers to have direct Redis/SQS access
- Introduces network exposure of internal infrastructure
- Operational complexity for external cloud workers

### Option D: Hybrid — polling for tasks, HTTP POST for updates
- Worker polls for task acquisition (simple, reliable)
- Worker pushes updates via HTTP POST as they occur (no persistent connection)
- Best of both worlds for Phase 1

---

## Decision

**Adopt Option D: Polling for task acquisition + HTTP POST for updates.**

Workers poll the control plane for tasks every 10 seconds. Workers push updates (progress, logs, artifacts) via HTTP POST. All communication is outbound-initiated from the worker.

### Rationale for polling (not push) for task acquisition:
1. **Firewall friendly:** Workers are on developer machines behind corporate firewalls. Outbound HTTPS works universally. Inbound connections from the control plane may be blocked.
2. **Simplicity:** HTTP polling is simpler to implement, debug, and operate than WebSockets.
3. **Resilience:** If the control plane is temporarily unreachable, workers queue locally and retry. No reconnect logic required.
4. **Acceptable latency:** Engineering tasks take minutes to hours. A 10-second polling lag is imperceptible.

### Long-Poll as Phase 2 Enhancement
In Phase 2, if polling latency becomes a concern, replace short polling with long polling (server holds request open for up to 30 seconds until a task arrives). This changes zero worker code — only the server endpoint changes.

### WebSocket Reconsideration in Phase 3
If AIOP operates in environments where workers are on the same internal network as the control plane, revisit WebSocket for real-time task push. The connector abstraction makes this a transport-layer change only.

---

## Protocol Specification

### Worker → Control Plane (Outbound)
```
POST /api/aiop/worker/heartbeat           Every 30 seconds
GET  /api/aiop/worker/tasks/next          Every 10 seconds (poll)
POST /api/aiop/worker/executions/{id}/start
POST /api/aiop/worker/executions/{id}/log
POST /api/aiop/worker/executions/{id}/progress
POST /api/aiop/worker/artifacts/upload
POST /api/aiop/worker/executions/{id}/complete
POST /api/aiop/worker/executions/{id}/fail
```

### Authentication
All worker API calls carry a `Bearer {worker_token}` header. Worker tokens are issued at registration and can be revoked from the control plane UI.

---

## Consequences

### Positive
- Simple, proven, firewall-transparent protocol
- Workers can be deployed anywhere without network configuration
- Easy to debug (all traffic is standard HTTPS)

### Negative
- 10-second polling latency for task acquisition
- Polling generates constant low-level traffic from all workers
- If 100 workers poll every 10 seconds, that is 10 requests/second minimum load

### Mitigation
- Implement exponential backoff when no tasks are available
- Workers sleep 30 seconds after receiving no tasks, reducing idle load
