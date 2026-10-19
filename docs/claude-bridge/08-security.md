# Security Architecture
## ECOS Claude Bridge v1.0

**Document ID:** CB-SEC-001  
**Version:** 1.0  
**Date:** 2026-07-18  

---

## Threat Model

The Claude Bridge has a narrow threat surface. It is a single-tenant, single-machine integration used by one developer. The threats to design against are:

1. An authenticated ECOS user who should not see Claude tasks (another company's tenant leaks through)
2. A compromised worker token that could poll tasks from the queue
3. Plaintext secrets sitting in ECOS database
4. An artifact being served to the wrong tenant
5. Log manipulation or audit deletion after the fact

This is not a public-internet product with anonymous users. Everything runs behind ECOS authentication. The security goal is: **sensible defaults, no secret storage in ECOS, complete audit trail.**

---

## API Token Design

### Worker Token

The worker authenticates with a Bearer token format: `cb_tok_` followed by 32 random hex characters.

```
Token generated: cb_tok_a3f9d2e0b8c1...
ECOS stores:     bcrypt(token, cost=12) in cb_workers.token_hash
ECOS discards:   the plaintext token immediately after returning it once
Worker stores:   plaintext token in encrypted config.json on disk
```

**Verification on every request:**
1. Extract token from `Authorization: Bearer cb_tok_xxx` header
2. Hash the incoming token with bcrypt
3. Compare to stored `token_hash`
4. If not equal: 401

This is identical to how Laravel's Sanctum personal access tokens work internally. No JWT. No expiry in Phase 1 (the worker is a single, manually-managed machine).

### Token Regeneration

When a user regenerates the worker token from ECOS Settings:
1. New token generated, bcrypt hash written to `cb_workers.token_hash`
2. Old hash overwritten — immediately invalidates the old token
3. New plaintext shown in UI once, then discarded
4. Audit log entry written: `worker.token_regenerated`
5. Worker stops receiving 200 heartbeat responses; next heartbeat returns 401; worker PM2 log shows "API token invalid or revoked — update config.json"

---

## ANTHROPIC_API_KEY

**The key never enters ECOS.** It is never transmitted over the network. It never appears in the database. It never appears in API responses.

It lives in one of two places on the worker machine:
- System environment variable (`ANTHROPIC_API_KEY`)
- `%APPDATA%\claude-bridge\.env` (loaded by the worker at startup)

The worker process inherits the environment and passes it to the Claude Code subprocess. ECOS has no knowledge of this key at any point.

If the key is absent when the worker starts Claude Code, the subprocess fails immediately. The worker reports `failure_code: claude_crash` with a message indicating missing credentials. The key itself never appears in the failure message.

---

## ECOS Worker Config (Encrypted at Rest)

The worker config at `C:\claude-bridge\config.json` contains the ECOS API token and URL. It is encrypted with AES-256-GCM.

**Key derivation:**

```
key_material = sha256(hostname + ":" + windows_product_id)
key = PBKDF2(key_material, salt="claude-bridge-v1", iterations=100000, length=32)
```

The encryption key is derived from machine-specific identifiers. Moving `config.json` to another machine renders it unreadable. The key is never stored; it is re-derived on every startup.

This protects against: laptop stolen with files intact; backup containing config extracted to a different machine.

This does not protect against: an attacker with live access to the running machine (the decryption key can be re-derived from the same machine identifiers). That threat is out of scope for Phase 1.

---

## Tenant Isolation

All `cb_` tables include a `company_id` column. Every Laravel query appends `WHERE company_id = auth()->user()->company_id`.

The worker token is scoped to a single company. When the worker sends a request:
1. Token is verified → resolves to `cb_workers.id`
2. `cb_workers.company_id` is extracted
3. All subsequent queries are scoped to that company_id

A token belonging to Company A cannot retrieve tasks belonging to Company B. There is no way to enumerate workers or tasks without a valid token scoped to a specific company.

---

## Artifact Security

Artifacts (diff, report, log) are stored in Laravel local file storage. The storage path is not guessable — it includes the artifact UUID.

Download endpoint: `GET /api/cb/artifacts/{id}/download`

Before serving the file:
1. Verify Sanctum auth (ECOS user)
2. Load artifact by `id`
3. Confirm `artifact.task.company_id === auth()->user()->company_id`
4. Verify file exists at `storage_path`
5. Stream file with `Content-Disposition: attachment`

Artifacts are never served via direct storage URL. They always pass through the controller auth check.

---

## Audit Log Integrity

The `cb_audit_log` table is append-only at the application layer:
- No `UPDATE` is ever issued on this table
- No `DELETE` is ever issued on this table
- The DB user used by the Laravel app does not have `DELETE` or `UPDATE` privileges on `cb_audit_log`

This is the same pattern used for ECOS's main audit trail. Privilege separation is enforced at the database user level, not just in application code.

Every significant action writes an audit entry:

| Action | Who Writes It |
|---|---|
| `worker.registered` | ECOS after POST /cb/workers |
| `worker.token_regenerated` | ECOS after token regen |
| `worker.deactivated` | ECOS after DELETE /cb/workers/{id} |
| `task.created` | ECOS after POST /cb/tasks |
| `task.queued` | ECOS after POST /cb/tasks/{id}/queue |
| `task.started` | ECOS after POST /cb/worker/tasks/{id}/start |
| `task.done` | ECOS after POST /cb/worker/tasks/{id}/complete |
| `task.failed` | ECOS after POST /cb/worker/tasks/{id}/fail |
| `task.approved` | ECOS after POST /cb/tasks/{id}/approve |
| `task.changes_requested` | ECOS after POST /cb/tasks/{id}/request-changes |
| `task.merged` | ECOS after POST /cb/tasks/{id}/mark-merged |
| `task.cancelled` | ECOS after POST /cb/tasks/{id}/cancel |
| `worker.token_regenerated` | ECOS after regenerate action |

---

## HTTPS

All communication between the Worker and ECOS goes over HTTPS. The worker does not accept `http://` URLs in config. If the `ecos_url` field starts with `http://` on startup, the worker logs an error and exits.

The worker uses the system Node.js TLS stack (trusts the system certificate store). Self-signed certs require the developer to add the certificate to Windows' trusted root store — the worker does not offer an option to skip TLS verification.

---

## ECOS Platform Auth (UI)

The Bridge UI uses ECOS's existing Sanctum session authentication. There is no separate auth system. A user must be authenticated with ECOS to access any `/api/cb/` endpoint from the browser.

RBAC is deferred to Phase 2. In Phase 1, any authenticated ECOS user with access to the company can view and create tasks. The company_id scope prevents cross-company access; within a company, all users share the same access level.

---

## What Is Not in Scope

| Concern | Decision |
|---|---|
| Role-based access within a company | Phase 2 (all authenticated users can read/write tasks in Phase 1) |
| OAuth or SSO for the worker | Not needed (single machine, single token) |
| End-to-end encryption of log content | Not needed (ECOS HTTPS + DB access control is sufficient) |
| Artifact virus scanning | Not needed (artifacts are diffs and markdown from a known machine) |
| Rate limiting on worker endpoints | Phase 2 |
| IP allowlisting for the worker | Phase 2 |
| Secret rotation schedule | Phase 2 (token is regenerated manually when needed) |
