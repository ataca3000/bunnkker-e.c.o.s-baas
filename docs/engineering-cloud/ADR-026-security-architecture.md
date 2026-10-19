# ADR-026 — Security Architecture

**Status:** Approved
**Date:** 2026-07-22
**Authors:** Engineering Platform Team
**Supersedes:** None
**Related:** ADR-011 (Event-Driven Architecture), ADR-024 (Single Source of Truth)

---

## Context

The Engineering Cloud platform operates a distributed agent network where EngineeringWorker instances connect from arbitrary runtime environments, execute privileged tasks inside Workspace containers, access code repositories, upload PipelineArtifact objects, and emit domain events that drive downstream automation. This threat surface is qualitatively different from a conventional user-facing web application:

- Agents are non-human actors that authenticate without user interaction.
- Workspace execution grants ephemeral access to secrets and source trees.
- ReleaseCandidates and ReleaseBundle objects have direct production impact.
- Company isolation (multi-tenancy) must be enforced at every layer.
- The system is designed to run autonomously for extended periods.

This ADR records the approved security architecture, threat model, and operational controls for Engineering Cloud. All subsystems must comply.

---

## Decision

Engineering Cloud adopts a Zero Trust, defence-in-depth security model with three independent authentication paths (API Key, JWT, Sanctum), resource-level authorization enforced at every API boundary, cryptographic replay protection, comprehensive audit logging, and documented incident response procedures.

---

## 1. Security Principles

### 1.1 Zero Trust Model

Engineering Cloud treats every request as potentially hostile regardless of network origin. Zero Trust is applied through five pillars:

**Pillar 1 — Verify Explicitly**
Every API call must present a valid credential. No implicit trust is granted based on network location, IP address, or prior successful calls. JWT tokens are validated on every request including signature, expiry, issuer, audience, and jti blocklist membership.

**Pillar 2 — Least Privilege Access**
Every component — agent, worker, human user, internal service — is granted the minimum permissions required to perform its declared function. Permissions are not additive across sessions; each session carries only the capabilities registered for that worker.

**Pillar 3 — Assume Breach**
System design assumes that individual components will be compromised. Blast radius is minimised through Workspace isolation, company_id-scoped data access, short-lived credentials, and immediate revocation capability. Audit trails are append-only and cannot be modified by compromised application accounts.

**Pillar 4 — Continuous Validation**
Authentication is not a one-time gate. JWT tokens expire in 24 hours and must be refreshed. WorkerHeartbeat signals are validated for authenticity. Anomalous behaviour patterns (unusual task volume, unexpected capability claims, geographic impossibility) trigger automatic rate-limiting and alerting.

**Pillar 5 — Micro-Segmentation**
Workspaces are isolated execution environments. An agent operating in one Workspace cannot access secrets, artifacts, or events from another Workspace or from a different company_id. Service-to-service calls use dedicated shared secrets that are never exposed through agent-facing APIs.

### 1.2 Defence in Depth

Security controls are layered so that the failure of any single control does not result in a successful attack:

- **Layer 1 — Network:** TLS 1.3 termination, HSTS, firewall rules
- **Layer 2 — Authentication:** Credential validation (API Key / JWT / Sanctum)
- **Layer 3 — Replay Protection:** Nonce validation, timestamp window enforcement
- **Layer 4 — Authorization:** Role check, resource ownership check, company_id isolation
- **Layer 5 — Rate Limiting:** Per-endpoint throttling with escalating penalties
- **Layer 6 — Input Validation:** Request schema enforcement, payload size limits
- **Layer 7 — Audit:** Immutable security event log, anomaly detection hooks
- **Layer 8 — Encryption:** TLS in transit, AES-256-GCM at rest for sensitive artifacts

No layer alone is sufficient. Each layer is independently tested and independently monitored.

### 1.3 Least Privilege

Every component is granted the minimum permissions required:

- An EngineeringWorker in Idle state cannot read task payloads until it has accepted an assignment.
- A Worker registered with capability `php-test` cannot be assigned tasks requiring capability `docker-build`.
- An Observer role user can read task data but cannot create, update, approve, or delete any resource.
- GitHub tokens issued for a PipelineRun are scoped to the specific repository and expire when the run ends.
- Workspace secrets are injected as environment variables at session start and are cleared when the ExecutionSession terminates — they are never written to disk or stored in the database.

---

## 2. Authentication Architecture

### 2.1 API Key Authentication — Agent Registration

API Keys authenticate EngineeringWorker instances during the registration flow and for any request that occurs before a JWT session is established.

| Property | Value |
|---|---|
| Header | `X-Agent-Key` |
| Format | `eak_` prefix followed by 32 lowercase hex characters (128 bits of entropy) |
| Storage | bcrypt hash only — the plaintext key is shown once at registration and never stored |
| Transmission | HTTPS only; key must never appear in query strings, logs, or error messages |
| Rotation period | 90 days maximum; rotation is enforced by the platform |
| Revocation | Immediate — bcrypt hash is deleted; all in-flight requests using the key are rejected on next validation |
| Binding | One API key per registered EngineeringWorker; keys are not shared between workers |
| Audit | Every use of an API key is logged with outcome, ip_address, and user_agent |

Key generation algorithm: `eak_` + `bin2hex(random_bytes(32))`. Keys are generated server-side and delivered to the agent over TLS. The registration endpoint is rate-limited to 10 requests per hour per company_id.

### 2.2 JWT Authentication — Agent Sessions

After successful API key validation, the platform issues a short-lived JWT for subsequent authenticated requests within a session.

| Property | Value |
|---|---|
| Algorithm | RS256 (RSA 2048-bit private key; public key published at `/.well-known/jwks.json`) |
| Expiry (`exp`) | 24 hours from issuance |
| Refresh window | Token may be refreshed starting at 23 hours (1 hour before expiry) |
| Revocation | jti blocklist stored in Redis with TTL matching remaining token lifetime |

**Standard Claims:**

| Claim | Type | Description |
|---|---|---|
| `sub` | UUID | `agent_id` of the registered EngineeringWorker |
| `iss` | string | Platform issuer URI (environment-specific) |
| `aud` | string | `engineering-cloud` |
| `exp` | Unix epoch | Expiry timestamp |
| `iat` | Unix epoch | Issued-at timestamp |
| `jti` | UUID | Unique token identifier for replay protection and revocation |
| `company_id` | UUID | Tenant scope; enforced on every resource access |
| `capabilities` | string[] | Array of WorkerCapability identifiers registered for this worker |

**Validation sequence (every request):**
1. Signature verification against the current RS256 public key
2. `iss` matches expected issuer
3. `aud` matches `engineering-cloud`
4. `exp` has not passed
5. `jti` is not present in the Redis blocklist
6. `company_id` matches the resource being accessed

Any validation failure returns HTTP 401 with a generic error message. Specific failure reasons are written to the security audit log but not exposed to the caller.

### 2.3 Laravel Sanctum — UI Authentication

Human users access Engineering Cloud through the standard Laravel Sanctum token mechanism integrated with the broader ECOS-ERP authentication system.

**Roles available to UI users:**

| Role | Description |
|---|---|
| `EngineeringLead` | Full read/write access including release approval and worker management |
| `Developer` | Read/write access to tasks, runs, and findings; cannot approve releases or manage workers |
| `Observer` | Read-only access to all Engineering Cloud resources within their company_id |

Sanctum tokens are scoped by company_id. A user cannot access resources belonging to a different company even if they possess a valid token. Session expiry follows the platform-wide Sanctum configuration.

### 2.4 Service-to-Service Authentication

Internal services (PipelineRun executor, webhook dispatcher, artifact store) authenticate to each other using shared secrets stored as environment variables on the application server.

- Shared secrets are 256-bit random values generated at deployment.
- They are never returned by any API endpoint.
- They are never logged.
- They are never accessible to EngineeringWorker agents through any code path.
- Rotation requires a coordinated deployment; rotation schedule is quarterly or on suspected compromise.

---

## 3. Authorization Architecture

### 3.1 Role Definitions

| Role | Actor Type | Assigned To | Description |
|---|---|---|---|
| `EngineeringLead` | Human | Senior engineers, team leads | Full platform access including destructive operations and release approval |
| `Developer` | Human | Engineers | Task management, pipeline operations, findings review; no release approval |
| `Observer` | Human | Stakeholders, auditors | Read-only across all resources |
| `Agent` | Non-human | Registered EngineeringWorker | Accepts and executes tasks; scoped to declared capabilities; cannot approve releases |
| `System` | Non-human | Internal services | Unrestricted internal access; never exposed to external callers |

### 3.2 Resource-Level Authorization

Every API endpoint enforces authorization in this exact sequence:

1. **Authentication check** — credential is valid and not revoked
2. **Role check** — caller's role permits the requested action on this resource type
3. **Ownership check** — resource's `company_id` matches caller's `company_id`
4. **State check** — resource is in a state that permits the requested transition (where applicable)

Failure at any step returns HTTP 403. The reason for denial is written to the security audit log but not exposed to the caller.

No endpoint bypasses any of these checks. Middleware enforces company_id isolation globally; individual controllers do not re-implement it.

### 3.3 Authorization Matrix

| Resource | Create | Read | Update | Delete | Approve |
|---|---|---|---|---|---|
| EngineeringTask | Lead, Dev | Lead, Dev, Observer, Agent* | Lead, Dev | Lead | — |
| EngineeringAgent | Lead | Lead, Dev, Observer | Lead | Lead | — |
| EngineeringWorker | Agent (self-register) | Lead, Dev, Observer | Lead, Agent (self) | Lead | — |
| ExecutionSession | System, Agent | Lead, Dev, Observer, Agent (own) | System, Agent (own) | — | — |
| ExecutionQueue | System | Lead, Dev, Observer | Lead | — | — |
| Workspace | System | Lead, Dev, Observer, Agent (own) | System | Lead | — |
| WorkspaceLock | System, Agent (own) | Lead, Dev, Observer | System | System | — |
| ReleaseCandidate | Lead, Dev | Lead, Dev, Observer | Lead | Lead | Lead |
| ReleaseBundle | System | Lead, Dev, Observer | — | — | Lead |
| TaskDependency | Lead, Dev | Lead, Dev, Observer, Agent | Lead, Dev | Lead, Dev | — |
| TaskComment | Lead, Dev, Agent | Lead, Dev, Observer, Agent | Own author | Own author | — |
| TaskAttachment | Lead, Dev, Agent | Lead, Dev, Observer | — | Lead | — |
| ExecutionLog | System, Agent (own session) | Lead, Dev, Observer, Agent (own) | — | — | — |
| PipelineRun | Lead, Dev, System | Lead, Dev, Observer, Agent (own) | System | — | — |
| PipelineArtifact | Agent (own run), System | Lead, Dev, Observer, Agent (own) | — | Lead | — |
| WorkerCapability | Lead | Lead, Dev, Observer | Lead | Lead | — |
| WorkerResource | Agent (own), System | Lead, Dev, Observer | Agent (own), System | — | — |
| WorkerHeartbeat | Agent (own) | Lead, System | — | System (TTL) | — |
| TaskArtifact | Agent (own task), Dev, Lead | Lead, Dev, Observer | — | Lead | — |
| TaskLock | System, Agent (own) | Lead, Dev, Observer | System | System | — |

*Agent read access to EngineeringTask is restricted to tasks assigned to that agent or in Queued state and matching the agent's capabilities.

---

## 4. Replay Protection

All agent-facing API requests (JWT-authenticated) must include two additional headers:

| Header | Format | Description |
|---|---|---|
| `X-Request-ID` | UUID v4 | Unique identifier for this request |
| `X-Timestamp` | Unix epoch (integer seconds) | Time at which the request was generated |

**Validation rules:**

1. `X-Timestamp` must be within ±300 seconds of the server's current time. Requests outside this window are rejected with HTTP 400.
2. `X-Request-ID` is stored in Redis with a TTL of 600 seconds (10 minutes). If the same ID appears again within the TTL window it is rejected with HTTP 409 (Conflict).
3. The combination of `sub` (from JWT) + `X-Request-ID` forms the cache key to prevent cross-agent ID collisions.

Clock skew tolerance of 300 seconds is a deliberate trade-off between usability for distributed agents and replay window exposure. Agents must synchronise their clocks with NTP.

Redis key format: `replay:{company_id}:{agent_id}:{request_id}` with TTL 600.

---

## 5. Encryption

### 5.1 In Transit

- TLS 1.3 is the minimum acceptable protocol version. TLS 1.2 is disabled.
- HSTS (HTTP Strict Transport Security) is enforced with `max-age=31536000; includeSubDomains; preload`.
- Certificate pinning is available as an optional configuration for high-security deployments where agents operate in a controlled environment.
- Cipher suites are restricted to forward-secret variants (ECDHE key exchange).
- Internal service-to-service calls on the same private network use TLS with self-signed certificates validated by a private CA.

### 5.2 At Rest

- PostgreSQL data is protected by encrypted storage volumes (AES-256) at the infrastructure level.
- PipelineArtifact and TaskAttachment blobs stored in the artifact store are encrypted with AES-256-GCM. Encryption keys are managed by the application key management layer, not stored alongside the data.
- Sensitive configuration values (GitHub tokens, third-party API credentials) are encrypted at the application level before database persistence using Laravel's `encrypt()` / `decrypt()` helpers (AES-256-CBC with MAC).
- Database backups inherit the volume encryption and are additionally password-protected.

### 5.3 Workspace Secrets Injection

Secrets required by an ExecutionSession (repository tokens, signing keys, environment-specific credentials) are handled as follows:

1. The platform retrieves the encrypted secret from the secrets store at session initialisation.
2. The secret is decrypted in memory and injected into the Workspace environment as a standard environment variable.
3. The plaintext secret is never written to disk, never persisted to the database, and never included in ExecutionLog output.
4. When the ExecutionSession reaches a terminal state (Completed, Failed, Aborted), the environment is cleared and the Workspace is archived or destroyed.
5. Audit events record which secret identifiers (not values) were injected and when.

---

## 6. Secrets Management

| Secret Type | Storage | Form at Rest | Rotation |
|---|---|---|---|
| Application encryption key | Environment variable | Plaintext in env (not DB) | On compromise or annually |
| Agent API keys | Database (`agent_keys` table) | bcrypt hash only | 90-day enforced rotation |
| JWT RS256 private key | Environment variable / key file | Plaintext in env | On compromise or annually; public key update via JWKS |
| GitHub repository tokens | Database | Application-encrypted (AES-256-CBC) | Per-run where possible; otherwise 30 days |
| Service-to-service shared secrets | Environment variable | Plaintext in env | Quarterly or on compromise |
| Database credentials | Environment variable | Plaintext in env | Quarterly |
| Worker registration tokens (one-time) | Redis | Plaintext (TTL 15 minutes) | Single use; auto-expired |

No secret value is ever returned by an API response, included in a log entry, or transmitted in a URL query string.

---

## 7. Rate Limiting

Rate limits are enforced at the application layer using Redis counters. Limits apply per caller identity (agent_id or user_id) and per company_id independently; hitting a per-agent limit does not affect other agents from the same company.

| Endpoint Category | Limit | Window | Burst | Penalty on Breach |
|---|---|---|---|---|
| WorkerHeartbeat | 120 requests | 60 seconds | 10 above limit | 429; exponential backoff hint in `Retry-After` |
| Task pull (Queued → Assigned) | 30 requests | 60 seconds | 5 above limit | 429; 60-second block |
| PipelineArtifact upload | 20 requests | 60 seconds | 3 above limit | 429; 120-second block |
| Agent registration (API key use) | 10 requests | 3600 seconds (per company) | 0 | 429; 1-hour block; security alert |
| UI authentication (Sanctum) | 5 failed attempts | 300 seconds (per IP) | 0 | 429; 15-minute IP block; security alert |
| Report generation | 10 requests | 600 seconds | 2 above limit | 429; queue position returned |
| Release approval | 5 requests | 300 seconds | 0 | 429; security alert logged |
| JWT refresh | 10 requests | 3600 seconds | 3 above limit | 429; force re-authentication |

Penalty escalation: a caller that repeatedly hits rate limits within a 24-hour window has their limits halved for the remainder of that window. Persistent abuse triggers automatic Draining state for the worker and an alert to the EngineeringLead role.

---

## 8. Audit Trail Design

The security audit log is a dedicated, append-only table. Application accounts have INSERT permission only; UPDATE and DELETE are revoked at the database level.

### 8.1 Log Record Schema

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Immutable record identifier |
| `event_type` | string | Canonical event name from the catalogue below |
| `actor_id` | UUID | Identifier of the actor (agent_id, user_id, or system) |
| `actor_type` | enum | `agent`, `user`, `system` |
| `resource_type` | string | Entity type being acted upon |
| `resource_id` | UUID | Identifier of the specific resource |
| `company_id` | UUID | Tenant scope of the event |
| `ip_address` | string | Source IP of the request |
| `user_agent` | string | HTTP User-Agent header value |
| `timestamp` | timestamp with timezone | Server time at event occurrence (not client-supplied) |
| `outcome` | enum | `success`, `failure`, `blocked` |
| `metadata` | JSONB | Additional context (error codes, changed fields, previous state) — no secret values |

### 8.2 Audited Event Catalogue

| Event Type | Trigger |
|---|---|
| `agent.registered` | EngineeringWorker completes registration |
| `agent.registration_failed` | Registration attempt rejected (invalid key, quota exceeded) |
| `auth.jwt_issued` | JWT issued after successful API key validation |
| `auth.jwt_refreshed` | JWT renewed within the refresh window |
| `auth.jwt_rejected` | JWT validation failed (expired, revoked, invalid signature) |
| `auth.api_key_used` | API key presented for registration or pre-session call |
| `auth.api_key_revoked` | API key explicitly revoked |
| `auth.sanctum_login` | Human user authenticated via Sanctum |
| `auth.sanctum_failed` | Sanctum authentication attempt failed |
| `auth.rate_limit_breach` | Caller exceeded a rate limit threshold |
| `task.assigned` | EngineeringTask moved to Assigned state |
| `task.state_transition` | Any EngineeringTask state change |
| `task.lock_acquired` | TaskLock created for an EngineeringTask |
| `task.lock_released` | TaskLock released |
| `workspace.accessed` | Agent connected to a Workspace |
| `workspace.secret_injected` | Secret identifier injected into Workspace environment (value not logged) |
| `workspace.archived` | Workspace moved to Archived state |
| `artifact.accessed` | PipelineArtifact or TaskArtifact read by any caller |
| `artifact.uploaded` | Artifact stored by an agent or system |
| `release.approval_requested` | ReleaseCandidate submitted for review |
| `release.approved` | ReleaseCandidate approved by EngineeringLead |
| `release.rejected` | ReleaseCandidate rejected |
| `release.rolled_back` | Released bundle rolled back |
| `permission.changed` | Role assignment or capability modified |
| `security.anomaly_detected` | Automated anomaly detection rule triggered |

---

## 9. Threat Model

### 9.1 Threat Actors

| Actor | Description | Motivation |
|---|---|---|
| External attacker | No credentials; network access only | Data exfiltration, service disruption, credential theft |
| Rogue agent | Holds a valid API key and JWT; seeks to exceed declared scope | Lateral movement to other tasks, companies, or workspaces |
| Compromised developer | Holds a valid Sanctum token; insider with legitimate access | Privilege escalation, data theft, sabotage of releases |
| Insider threat | Current or former employee with knowledge of system internals | Targeted sabotage, IP theft |
| Supply chain attacker | Malicious dependency or compromised CI pipeline | Code injection, backdoor insertion into release artifacts |

### 9.2 Threat Table

| # | Threat | Attack Vector | Impact | Likelihood | Mitigation | Residual Risk |
|---|---|---|---|---|---|---|
| T-01 | API key theft via log exposure | Key appears in application or access logs | Full agent impersonation | Medium | Keys never logged; `eak_` prefix pattern matched by log scrubbers; log output reviewed in audit | Low |
| T-02 | JWT replay attack | Captured JWT reused before expiry | Authenticated requests as victim agent | Medium | jti blocklist in Redis; X-Request-ID nonce per request; 24-hour expiry limits window | Low |
| T-03 | Cross-tenant data access | Manipulated resource_id in request targeting another company | Full data breach of victim tenant | High | company_id middleware enforced globally; resource ownership check in every controller | Very Low |
| T-04 | Rogue agent capability escalation | Agent claims capabilities it was not registered with | Execution of unauthorised task types | Medium | Capabilities embedded in JWT at issuance; not caller-supplied per request; JWT signature prevents modification | Low |
| T-05 | Workspace secret exfiltration | Agent reads secrets from Workspace environment and transmits them | Credential compromise | High | Secrets not written to disk; ExecutionLog output filtered for secret patterns; Workspace network egress restricted | Medium |
| T-06 | Brute-force API key registration | Repeated registration attempts to enumerate valid keys | Valid key discovery | Low | bcrypt comparison prevents timing attacks; 10 req/hour/company rate limit; alert on breach | Very Low |
| T-07 | Unauthorised release approval | Compromised EngineeringLead account approves malicious release | Production code execution | Critical | MFA required for EngineeringLead; approval rate-limited; two-lead approval option available; audit trail | Low |
| T-08 | Artifact tampering | PipelineArtifact content replaced before deployment | Malicious code in production | High | SHA-256 hash recorded at upload; verified before deployment; AES-256-GCM encryption detects tampering | Low |
| T-09 | Denial of service via task flooding | Agent or user submits unlimited tasks | Resource exhaustion; queue starvation | Medium | Per-company task creation rate limits; queue depth monitoring; Draining state for abusive workers | Low |
| T-10 | JWT private key compromise | Key file exfiltrated from server | Arbitrary JWT generation for any agent | Critical | Key stored in environment only; host-level access controls; key rotation revokes all existing tokens via forced re-auth | Medium |
| T-11 | Supply chain injection | Malicious PHP or npm package introduces backdoor | Arbitrary code in application | High | Composer/npm lock files; dependency vulnerability scanning (weekly); no direct GitHub → production deploy without PipelineRun | Medium |
| T-12 | Compromised internal service | Service-to-service shared secret stolen | Unrestricted internal API access | Medium | Shared secrets not in codebase; environment-variable only; rotation on compromise; internal calls logged | Low |
| T-13 | Log injection / SIEM poisoning | Attacker crafts input that falsifies audit log entries | Concealment of attack; false attribution | Medium | All log fields sanitised; structured JSON format; no free-text interpolation into log messages | Low |
| T-14 | Workspace container escape | Exploit allows agent to break out of isolated execution environment | Access to host or other Workspaces | High | Container hardening (no privileged mode, read-only root FS, seccomp profiles); Workspace network micro-segmentation | Medium |
| T-15 | Stale worker token after termination | Terminated worker's JWT still valid for remainder of 24-hour window | Continued unauthorised access | Medium | Worker termination triggers jti blocklist entry for all active tokens; Draining state prevents new assignments | Low |

### 9.3 Security Assumptions

The following conditions are assumed to hold. A violation of any assumption may invalidate the security properties of the system and must be treated as an incident:

1. **Trusted hypervisor:** The underlying virtualisation platform is not compromised. Container isolation relies on kernel namespaces whose integrity requires a non-hostile host kernel.
2. **Trusted internal network for service-to-service:** Private network traffic between application instances and Redis/PostgreSQL is not intercepted. TLS is still used but certificate validation may be relaxed for loopback-equivalent paths.
3. **Trusted NTP:** Agents synchronise clocks with a reliable NTP source. Clock manipulation of more than 300 seconds is treated as a hostile condition.
4. **Trusted deployment pipeline:** The CI/CD pipeline that produces the application build is not itself compromised. This assumption is partially mitigated by supply chain scanning (T-11) but cannot be fully eliminated.
5. **Trusted operator:** Personnel with host-level server access (infrastructure operators) are vetted and trusted. Their actions are outside the scope of application-layer controls and are governed by separate HR and access management policies.
6. **Redis availability:** The jti blocklist and nonce cache depend on Redis availability. Redis outage is treated as a security-degraded state; JWT validation falls back to signature and expiry checks only, and an alert is raised.

---

## 10. Incident Response

### 10.1 Compromised Agent API Key

A compromised API key means an external party can register agents or authenticate as the victim worker.

**Immediate actions (within 15 minutes):**
1. Revoke the API key: delete the bcrypt hash from the `agent_keys` table. All future validation attempts will fail immediately.
2. Blocklist all JWTs issued using that API key: query the audit log for all `auth.jwt_issued` events associated with the agent_id, extract all jti values, and insert them into the Redis blocklist.
3. Set the EngineeringWorker state to Draining, then Offline, to prevent new task assignments.
4. Terminate any active ExecutionSession associated with that worker.

**Investigation actions (within 4 hours):**
5. Review the security audit log for all actions taken by the compromised agent_id from the estimated compromise time.
6. Identify any Workspace the agent accessed; review workspace audit events for abnormal secret access or artifact operations.
7. Check for lateral movement: did the agent access resources outside its registered company_id (should be impossible but verify).
8. Determine root cause of key exposure (log scraping, network interception, developer error).

**Recovery actions:**
9. Issue a new API key for the legitimate worker if the worker identity is still valid.
10. Brief the EngineeringLead on findings.
11. Update runbooks if a procedural gap was identified.

### 10.2 Unauthorised Access Attempt

An unauthorised access attempt is defined as: repeated authentication failures, rate limit breaches on sensitive endpoints, or anomaly detection alerts.

**Automated response (system-initiated):**
1. Rate limit enforcement blocks the source (IP and/or agent_id) for the escalating penalty window.
2. Security audit log records the attempt with full metadata.
3. If the threshold for `security.anomaly_detected` is crossed, an alert is sent to the EngineeringLead role.

**Manual response (EngineeringLead-initiated):**
4. Review the audit log to distinguish automated scanning/probe from targeted attack.
5. For targeted attacks: permanently block the source IP at the network layer; escalate to infrastructure team.
6. If a valid credential was involved (failed MFA, expired token, wrong company): notify the credential owner and force re-authentication.
7. Document the incident in the security register.

### 10.3 Workspace Data Breach

A Workspace breach means an agent or external party has accessed secrets, source code, or artifacts they are not authorised to access within a Workspace environment.

**Containment (within 30 minutes):**
1. Terminate the affected ExecutionSession immediately.
2. Archive the Workspace to prevent further access.
3. Rotate all secrets that were injected into the breached Workspace.
4. If a GitHub token was exposed: revoke it immediately via the GitHub API.
5. Block the agent_id involved (if the breach originated from a rogue agent).

**Assessment (within 4 hours):**
6. Determine the scope: which secrets were injected; which artifacts were present; what network connections were made from the Workspace.
7. Review ExecutionLog for evidence of exfiltration.
8. Assess whether any other Workspaces share the same secrets (secret reuse across Workspaces is a finding in itself).

**Notification:**
9. If customer data was potentially exposed: notify the affected company_id account owner within 24 hours in accordance with applicable data protection obligations.
10. If the breach involved source code: notify the repository owner.

**Post-incident:**
11. Workspace isolation controls review: determine whether the container escape assumption (T-14) was violated.
12. Update threat model if a new attack vector was discovered.

---

## 11. Security Testing Requirements

### 11.1 Penetration Testing

**Scope:** External penetration testing covers all agent-facing APIs (API key registration, JWT issuance, task endpoints, artifact upload), the UI authentication flow, and Workspace network boundaries.

**Frequency:** Annual external penetration test by an independent qualified firm; targeted re-test after any significant authentication or authorisation change.

**Internal red team:** Quarterly internal security exercises targeting the top-5 threats from the threat table (T-03, T-04, T-07, T-08, T-14).

**Out of scope:** Host-level infrastructure (covered by separate infrastructure security programme), third-party SaaS dependencies.

**Acceptance criteria:** No Critical or High findings unresolved at go-live. All findings tracked to resolution with a maximum 30-day remediation window for High, 90 days for Medium.

### 11.2 Code Review Requirements

All code changes affecting authentication, authorisation, cryptographic operations, secrets handling, or audit logging require:

1. Review by at least one senior engineer with security background (EngineeringLead or designated security reviewer).
2. Explicit checklist verification: credential not logged, company_id check present, input validated, error message does not leak internals.
3. Static analysis (SAST) scan with no new High or Critical findings introduced.
4. Changes to the authorization matrix (Section 3.3) require ADR amendment and explicit approval.

### 11.3 Dependency Vulnerability Scanning

| Layer | Tool | Schedule | Action on Finding |
|---|---|---|---|
| PHP (Composer) | `composer audit` | Weekly automated + every PR | High/Critical: block merge; Medium: remediate within 30 days |
| JavaScript/TypeScript (npm) | `npm audit` | Weekly automated + every PR | High/Critical: block merge; Medium: remediate within 30 days |
| Docker base images | Image vulnerability scanner | Weekly | High/Critical: patch within 14 days |
| PostgreSQL | Version CVE monitoring | On CVE publication | Assess and patch within vendor SLA |

Dependency scan results are stored as PipelineArtifact objects and linked to the EngineeringTask that triggered the scan. EngineeringLead is notified of any Critical finding within 1 hour of detection.

---

## Consequences

**Positive:**
- Clearly bounded security responsibilities for each component type.
- Company_id isolation enforced at every layer reduces blast radius of any single compromise.
- Short-lived credentials (24-hour JWT, 15-minute registration tokens) minimise the exposure window for stolen credentials.
- Comprehensive audit trail supports forensic investigation and compliance requirements.
- Layered controls mean no single failure produces a breach.

**Negative / Trade-offs:**
- RS256 JWT validation adds ~1ms latency per request compared to symmetric algorithms; accepted given security benefit.
- Replay protection headers (X-Request-ID, X-Timestamp) require agents to implement additional logic and maintain clock synchronisation.
- Redis dependency for jti blocklist means a Redis outage degrades security posture (fallback behaviour documented in Section 9.3, Assumption 6).
- 90-day mandatory API key rotation adds operational overhead for worker management.
- Audit log volume will be significant at scale; log retention and archival policy must be defined separately.

---

## Review Schedule

This ADR is reviewed:
- Annually as part of the scheduled security review cycle.
- Following any security incident classified Medium severity or above.
- When a new authentication mechanism or major feature is added to Engineering Cloud.
- When the threat landscape changes materially (new attack class discovered relevant to the system).

Amendments require approval from EngineeringLead and must be recorded as a new version of this document with a dated changelog entry.
