# Security Architecture
## ECOS AI Operations Platform

**Document ID:** AIOP-SA-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## 1. Security Perimeter Overview

AIOP introduces three security surfaces not present in other ECOS modules:

1. **Worker Identity** — Untrusted machines connecting to the control plane
2. **AI Execution** — Arbitrary code run by an AI agent inside the platform
3. **Secret Injection** — Credentials passed to executions without exposure to the AI agent itself

Standard ECOS surfaces (user auth, API authorization, tenant isolation) are covered by the platform-level security model and extended here for AIOP.

---

## 2. Identity and Authentication

### 2.1 User Authentication

Inherited from ECOS platform: Laravel Sanctum with session tokens. No AIOP-specific changes.

### 2.2 Worker Identity

Workers are not users. They authenticate via a dedicated long-lived JWT issued at registration.

**Token properties:**
- Signed with HMAC-SHA256 using a workspace-specific secret
- Claims: `sub` (worker_id), `workspace_id`, `token_type: "worker"`, `iat`, `exp`
- Default expiry: 1 year (configurable per workspace)
- Rotation: Administrator-triggered or worker self-triggered

**Token validation on every request:**
1. Verify signature against workspace signing key
2. Check `token_type == "worker"`
3. Confirm `worker_id` exists in DB and is not deregistered
4. Confirm `workspace_id` matches URL context (when present)
5. Confirm worker's last token rotation timestamp matches the issued-at claim (prevents replay of rotated tokens)

**Token storage on worker:** Stored in `~/.aiop/config.json` with OS-level file permissions (`chmod 600`). Workers running as a system service use OS keychain integration when available.

---

## 3. Authorization Model

### 3.1 User Authorization

AIOP inherits ECOS RBAC. Roles and permissions:

| Role | Permissions |
|---|---|
| `aiop:viewer` | Read tasks, executions, artifacts, reports |
| `aiop:operator` | Create/queue/cancel tasks |
| `aiop:reviewer` | All operator + submit review decisions |
| `aiop:admin` | All reviewer + manage workers, workspaces, secrets, policies |
| `aiop:cto` | All admin + CTO-stage approvals |

All role checks are enforced at the controller level via ECOS Policy gates.

### 3.2 Workspace Isolation

Users can only access workspaces they are members of. Workspace membership is enforced via a `workspace_users` pivot table. Every API query is scoped to `company_id` (tenant) and then filtered by workspace membership.

Workers can only access tasks belonging to their registered workspace. Cross-workspace access is rejected at the token validation layer.

### 3.3 Worker Authorization Scope

A worker token grants access to exactly:
- Its own heartbeat and lifecycle endpoints
- Task acquisition within its workspace (capability-filtered)
- Execution updates for executions it was assigned
- Artifact upload for tasks it is executing

A worker cannot:
- Read other workers' executions
- Access tasks in other workspaces
- Read secrets it was not given in the task assignment
- Access user management or configuration endpoints

---

## 4. Secret Management

### 4.1 Secret Storage

All secrets are encrypted before storage using AES-256-GCM:

```
Encryption flow:
  plaintext secret
  → AES-256-GCM encrypt with data encryption key (DEK)
  → DEK is itself encrypted with key encryption key (KEK) from KMS
  → ciphertext + encrypted DEK stored in aiop_secrets table
  → encryption_key_id references the KEK in KMS

Decryption flow (at task dispatch):
  Control plane retrieves KEK from KMS
  → Decrypts DEK
  → Decrypts secret ciphertext
  → Decrypted value is bundled in task assignment payload (TLS only)
  → Worker receives and holds in memory
  → Injected as container env var at execution start
  → Cleared from memory at execution end
```

### 4.2 Secret Lifecycle

| Phase | State | Location |
|---|---|---|
| Creation | Encrypted at rest | `aiop_secrets.encrypted_value` |
| Task Assignment | Encrypted in transit | TLS (task assignment payload) |
| Worker Memory | Decrypted in memory | Worker process RAM only |
| Container Execution | Environment variable | Container memory (not on disk) |
| Post-Execution | Cleared | No trace remains on disk |

**Never persisted:**
- Decrypted secrets are never written to any file
- Never included in execution logs
- Never included in artifacts
- Never sent back to the control plane in any response

### 4.3 Secret Rotation

When a secret is rotated:
1. New encrypted value replaces old in `aiop_secrets`
2. The `last_rotated_at` timestamp updates
3. An `AiopSecretRotated` event is logged to the audit trail
4. Any running executions using the old secret are not interrupted (they have already decrypted in memory)
5. The next execution will receive the new secret

---

## 5. Execution Sandbox Security

Details covered in ADR-AIOP-008. Security summary:

| Control | Mechanism |
|---|---|
| Process isolation | Docker container per execution |
| Network isolation | `--network none` (default); restricted egress list allowed per policy |
| Filesystem isolation | Read-only system mounts; only `/workspace` is writable |
| Privilege restriction | `--cap-drop ALL`; non-root user (uid 1000) |
| Resource limits | CPU: 2 cores; Memory: 4 GB; Disk: 20 GB; Time: configurable |
| Secret exposure | Env vars only; not written to `/workspace` |
| Post-execution | Container stopped and removed; workspace purged |

### 5.1 What the AI Agent Can Access

Within the execution sandbox, the AI agent can:
- Read and modify files in `/workspace` (the cloned repository)
- Execute shell commands (as the non-root container user)
- Make network calls (if execution policy permits egress)
- Read environment variables containing injected secrets

The AI agent cannot:
- Access the host filesystem
- Access other task workspaces
- Access the Docker socket
- Escalate privileges
- Persist anything beyond the workspace (which is purged post-execution)

---

## 6. Transport Security

- All control plane API endpoints: HTTPS only (TLS 1.2 minimum, TLS 1.3 preferred)
- Workers refuse to connect to non-HTTPS endpoints (configurable `allow_insecure: false`)
- Internal service-to-service calls (within Docker Compose): HTTP on Docker network (acceptable for single-host; mTLS for multi-host deployments)
- S3 presigned URLs: HTTPS only; 15-minute expiry for upload URLs, 1-hour for download URLs

---

## 7. Audit Trail

Every security-relevant action is recorded in `aiop_audit_log` with the actor identity, affected resource, before/after state snapshot, IP address, and user agent.

Events that are always audited:
- Worker registration / deregistration
- Secret creation / rotation / access
- Task creation / queue / cancel
- Review decisions (approve / reject / changes_requested)
- CTO approvals
- Merge operations
- Role changes
- Failed authentication attempts (worker tokens)
- Token rotation

The audit log is append-only at the application layer. The database user powering the application does not have `DELETE` or `UPDATE` permissions on `aiop_audit_log`. Periodic exports go to cold storage (S3 Glacier) for 7-year retention.

---

## 8. Threat Model

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Worker token theft | Medium | High | Token rotation, short-lived where possible, OS file permissions, anomaly detection on token reuse from unexpected IPs |
| Malicious task description (prompt injection) | High | Medium | AI agent runs in isolated container; output is a code diff reviewed by a human before merge; no direct system access |
| Secret leakage via execution logs | Medium | Critical | Log sanitization: control plane scans log chunks for patterns matching secret values and redacts before storage |
| Cross-workspace data access | Low | Critical | Enforced at token validation + DB query scoping |
| Artifact tampering in transit | Low | High | SHA-256 checksum verified by control plane after upload |
| Container escape | Very Low | Critical | Defense-in-depth: cap-drop, non-root, no host-pid, no host-network, Docker version management |
| Unauthorized merge (bypassing review) | Low | Critical | Merge endpoint validates task in APPROVED state; merge token issued only after approval |
| SLA manipulation (reviewer approval pressure) | Low | Medium | Review actions are immutable; escalation path enforced by policy, not individual override |

---

## 9. Rate Limiting and Abuse Prevention

Worker-level rate limits prevent a rogue or compromised worker from flooding the control plane:

| Endpoint | Limit |
|---|---|
| `POST /api/aiop/worker/heartbeat` | 10 per minute per worker |
| `GET /api/aiop/worker/tasks/next` | 20 per minute per worker |
| `POST /api/aiop/worker/executions/{id}/log` | 120 per minute per execution |
| `POST /api/aiop/worker/artifacts/presign` | 30 per minute per worker |

Exceeding rate limits returns `429 Too Many Requests`. Workers are designed to respect backoff; a worker ignoring `429` responses will have its token flagged for investigation.

---

## 10. Security Incident Response

In the event of a suspected security incident:

1. **Revoke worker token immediately:** `DELETE /api/aiop/workers/{id}` or admin UI
2. **Audit log review:** Query `aiop_audit_log` for all actions by the suspect worker in the past 30 days
3. **Artifact review:** Check all executions from the worker for unexpected changes
4. **Secret rotation:** Rotate all secrets the worker had access to
5. **Forensic workspace:** If `keep_workspace_on_failure: true` was set, the workspace directory may be preserved for analysis
6. **Execution abort:** Any in-progress execution by the worker is terminated immediately on deregistration
