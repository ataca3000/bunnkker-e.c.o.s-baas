# ADR-AIOP-004: Security Model
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

AIOP coordinates AI agents that write code and interact with software repositories. This is a high-risk activity:
- AI agents must not access production systems
- AI agents must not have unrestricted filesystem access
- Secrets (API keys, credentials) must never persist in insecure locations
- The system must maintain a tamper-proof audit trail

---

## Decision

### Security Model: Defense in Depth with Structural Isolation

Security is enforced structurally at multiple independent layers. No single layer failure compromises the entire system.

### Layer 1: Worker Identity and Authentication

Every worker has a unique identity established at registration:
- **Worker Token:** A 256-bit cryptographically random bearer token issued on registration
- **Token Scope:** Tokens are scoped to specific actions and a single worker identity
- **Token Rotation:** Tokens can be rotated from the control plane without worker downtime
- **Token Revocation:** Instant revocation; revoked tokens fail immediately at the next request

Optional Phase 2: **mTLS (Mutual TLS)** — workers present a client certificate. Control plane only accepts connections from workers with certificates issued by the AIOP CA. Provides stronger identity guarantees than bearer tokens alone.

### Layer 2: API Authorization (Control Plane)

Worker API endpoints are separate from the management API:
```
/api/aiop/worker/*    →  Worker token required (machine-to-machine)
/api/aiop/manage/*    →  User session required (human UI)
/api/aiop/admin/*     →  Admin role required (system configuration)
```

Workers cannot call management endpoints, even with a valid worker token. This is enforced at the middleware layer.

### Layer 3: Task Scoping

Workers are scoped to specific workspaces:
- A worker registered to Workspace A cannot acquire tasks from Workspace B
- Repository access is scoped per-task: the worker receives a single-use deploy key valid only for the task's target repository
- Task-scoped deploy keys expire after the execution completes

### Layer 4: Execution Sandbox

Workers run AI agents inside an isolation boundary:
- **Recommended:** Docker container with a minimal base image, no network access (or restricted egress only), read-only host mounts except for the workspace directory
- **Alternative:** Separate OS user with restricted filesystem permissions (`chroot` or `firejail`)
- AI agents can only write to the designated workspace directory
- AI agents cannot spawn processes outside the sandbox
- AI agents cannot access the host network, other processes, or the worker daemon's secrets

### Layer 5: Secret Management

Secrets required for execution (API keys, repository credentials) are:
1. Stored encrypted in the AIOP control plane (AES-256-GCM, key from HSM or AWS KMS)
2. Decrypted and injected into the execution environment as environment variables at task start
3. Held in worker memory only for the duration of the execution
4. Cleared from memory when the execution completes
5. Never written to disk, never included in logs, never included in artifacts

Workers cannot request secrets independently — secrets are pushed by the control plane with the task assignment.

### Layer 6: Artifact Integrity

Every artifact uploaded to the vault is:
- SHA-256 checksummed on the worker before upload
- Re-checksummed by the control plane on receipt
- Stored with the checksum as metadata
- Verified before being displayed in the review UI

Artifact tampering between worker and control plane is detectable.

### Layer 7: Audit Trail

Every security-relevant action is recorded in the immutable audit log:
- Worker registration and revocation
- Task assignment and unassignment
- Secret access events
- Artifact uploads and downloads
- Review decisions (approvals and rejections)
- Policy changes

Audit records are append-only. No delete operation exists on the audit log table. Retention is minimum 2 years.

---

## Threat Model

| Threat | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Compromised worker token | Medium | High | Instant revocation, token rotation, mTLS option |
| AI agent escaping sandbox | Low | Critical | Docker isolation, read-only mounts, no network |
| Secret exfiltration via logs | Medium | Critical | Log scrubbing, secrets never logged |
| Artifact tampering in transit | Low | High | HTTPS, SHA-256 checksum verification |
| Unauthorized task acquisition | Low | Medium | Workspace scoping, token authentication |
| Audit log tampering | Very Low | Critical | Append-only schema, no delete permission |
| Supply chain attack on AI agent | Low | High | Pinned agent versions, hash verification |
| SSRF via AI agent | Medium | High | No network egress from sandbox |

---

## Consequences

### Positive
- Structural security: compromised worker cannot escape its workspace
- Secrets are never at rest on worker machines
- Complete audit trail enables forensic investigation of any incident

### Negative
- Docker requirement for sandbox adds operational complexity
- Secret injection adds latency to task start (decrypt, transmit, inject)
- Token management adds operational overhead (rotation, revocation tracking)
