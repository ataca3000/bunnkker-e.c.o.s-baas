# ADR-007 — Production Standards

**Date:** 2026-06-26
**Status:** Accepted
**Author:** ECOS Architecture Team

---

## Context

ECOS ERP is being prepared for its first production deployment and future multi-customer rollouts.
The codebase, Docker infrastructure, deployment pipeline, and nginx configuration have been established.
What has not been formally codified is **what it means to be production-ready**.

During pre-production audits, the following classes of risk were identified:

- Development-only configuration values (`APP_DEBUG=true`, `MAIL_HOST=mailpit`) present in the
  deployment environment.
- Secrets committed to the git repository inside `docker-compose.yml`.
- No formal separation between what is acceptable in Local, Staging, and Production environments.
- No declared policy for HTTPS, logging, backups, rollback, or health monitoring.
- No checklist to verify readiness before a production deployment.

Without a ratified standard, each deployment is made on individual judgment, creating inconsistent
and potentially insecure production environments — particularly as the system is deployed for
additional customers.

This ADR establishes the mandatory operational standards that every Production, Staging, and future
customer deployment of ECOS ERP must satisfy.

---

## Decision

### 1. Environment Strategy

ECOS ERP recognizes three deployment environments. Each has a distinct purpose and a distinct set
of permissible configuration values.

| Property | Local | Staging | Production |
|---|---|---|---|
| Purpose | Developer workflow | Pre-release validation | Customer business operations |
| `APP_ENV` | `local` | `production` | `production` |
| `APP_DEBUG` | `true` | `false` | `false` |
| HTTPS | Optional | Required | Required |
| SMTP | Mailpit | Real SMTP | Real SMTP |
| Integrations | Mocked / sandbox | Sandbox | Live |
| Automated deployment | No | Yes | Yes |
| Health endpoints | Optional | Required | Required |
| Monitoring | No | Optional | Required |
| Database | Local or ephemeral | Dedicated staging DB | Dedicated production DB |

**A Staging environment must be production-equivalent in configuration.** The only permissible
differences between Staging and Production are the data set and the integration endpoints
(sandbox vs. live). If a configuration difference exists, Staging is not serving its validation purpose.

No environment variable that is marked Production-only in Section 2 may be present in Local
with a development-permissible value and also be present in Production with the same value.

---

### 2. Environment Variable Policy

The following variables are mandatory. The table defines the rule for each environment — not
the value, which belongs in the environment's `.env` file and is never committed to the repository.

| Variable | Local Rule | Staging Rule | Production Rule |
|---|---|---|---|
| `APP_ENV` | `local` | `production` | `production` |
| `APP_DEBUG` | `true` permitted | Must be `false` | Must be `false` |
| `APP_URL` | Any local URL | Full HTTPS URL of staging | Full HTTPS URL of production |
| `APP_KEY` | Any key | Unique key, not shared with Local | Unique key, not shared with any other env |
| `SESSION_DRIVER` | Any | `redis` | `redis` |
| `SESSION_SECURE_COOKIE` | Omitted or `false` | `true` | `true` |
| `SESSION_DOMAIN` | Omitted or `null` | Production domain with leading dot | Production domain with leading dot |
| `SESSION_ENCRYPT` | Omitted or `false` | `true` | `true` |
| `CACHE_STORE` | Any | `redis` | `redis` |
| `QUEUE_CONNECTION` | Any | `redis` | `redis` |
| `LOG_LEVEL` | `debug` | `warning` | `error` |
| `MAIL_MAILER` | Any | `smtp` (real provider) | `smtp` (real provider) |
| `MAIL_HOST` | `mailpit` | Real SMTP host | Real SMTP host |
| `DB_PASSWORD` | Any (dev convenience) | Strong unique password | Strong unique password |
| `REDIS_PASSWORD` | Omitted or `null` | Must be set | Must be set |

**No value may be the same between Local and Production** for `APP_KEY`, `DB_PASSWORD`,
`REDIS_PASSWORD`, or any secret credential. Shared secrets between environments mean a
compromised developer machine can expose the production environment.

---

### 3. Secret Management

**Secrets must never exist outside of designated secret stores.**

The following locations are prohibited for secrets:

| Prohibited Location | Reason |
|---|---|
| `docker-compose.yml` | Committed to the git repository — visible to everyone with repo access |
| Application source code | Same exposure surface as the repository; no rotation path |
| Git repository (any file) | Permanent history; rotation does not remove exposure |
| CI/CD logs | May be visible to all repository members and third parties |

The following are the only permissible locations for secrets:

| Permitted Location | Scope | Used for |
|---|---|---|
| `backend/.env` | Host filesystem, not in git | Runtime environment for all containers via Docker Compose `env_file` |
| GitHub Secrets / Environment Secrets | CI/CD pipeline | SSH private keys, DEPLOY_HOST, DEPLOY_PATH |
| Secret Manager (future) | Cloud-managed | Customer deployments at scale |

**`docker-compose.yml` must use variable substitution for all secret values**, not hardcoded
strings. MySQL credentials, Redis passwords, and any other secret referenced in Compose service
definitions must read from the environment:

```yaml
# Correct
MYSQL_PASSWORD: ${MYSQL_PASSWORD}
MYSQL_ROOT_PASSWORD: ${MYSQL_ROOT_PASSWORD}

# Prohibited
MYSQL_PASSWORD: secret
MYSQL_ROOT_PASSWORD: root
```

The values of `${MYSQL_PASSWORD}` and `${MYSQL_ROOT_PASSWORD}` belong in `backend/.env` and
are applied to both the `app` container (via `env_file`) and available to Docker Compose
variable substitution at `docker compose up` time.

**Secret Rotation Policy:**

- `APP_KEY`: Rotate whenever a key is suspected compromised. Rotation invalidates all existing
  sessions and encrypted data — schedule for a maintenance window.
- `DB_PASSWORD` / `MYSQL_ROOT_PASSWORD`: Rotate at minimum annually or after any personnel change
  that had server access.
- `REDIS_PASSWORD`: Same rotation cadence as database passwords.
- SSH deploy keys: Rotate annually or immediately on personnel change.
- After rotation: update the `.env` on the server, update GitHub Secrets, and run a health check.

---

### 4. Deployment Standards

Every deployment to Staging or Production must be executed through the automated pipeline.

**Manual deployments to Production are prohibited.**

A deployment that skips the pipeline bypasses the test gate, the health check, and the audit log.
It leaves the system in an unverifiable state with no rollback anchor.

The minimum required steps in every automated deployment are:

| Step | Purpose |
|---|---|
| 1. Pull latest commit | Synchronize source code |
| 2. `composer install --no-dev` | Install PHP dependencies without development packages |
| 3. `php artisan migrate --force` | Apply pending schema migrations |
| 4. Frontend build (`npm ci && vite build`) | Produce content-hashed production assets |
| 5. `docker compose up -d --wait` | Start or recreate containers; block until healthchecks pass |
| 6. `php artisan optimize` | Build config, route, and view caches after container startup |
| 7. `php artisan queue:restart` | Signal queue workers to reload new code |
| 8. Health check | Verify the three application layers are responding |
| 9. Deployment report | Record SHA, timestamp, actor, and outcome in the deployment log |

**No step may be skipped.** If a step fails, the deployment stops and the on-call engineer
is responsible for executing rollback (see Section 9).

---

### 5. HTTPS Policy

**Production requires HTTPS. No exceptions.**

HTTP-only production deployments are prohibited because:

- Session cookies without `Secure` attribute are transmitted in plaintext.
- Without HTTPS, `SESSION_SECURE_COOKIE=true` cannot be set, which violates Section 2.
- HTTP traffic can be intercepted on any network segment between the client and the server.
- HSTS cannot be enforced without TLS.

**TLS requirements:**

- TLS 1.2 minimum; TLS 1.3 preferred.
- Certificates must be from a trusted CA. Self-signed certificates are prohibited in Production.
- Let's Encrypt certificates are acceptable and are the default choice for server deployments.
- Certificate expiry must be monitored; automated renewal is required.

**HSTS (HTTP Strict Transport Security):**

HSTS must be enabled after TLS is confirmed operational. The nginx directive is:

```nginx
add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
```

HSTS must NOT be enabled before TLS is confirmed on the domain. A misconfigured HSTS header
on an HTTP-only server bricks the domain for the duration of `max-age`.

**Secure Cookies:**

Once HTTPS is live, `SESSION_SECURE_COOKIE=true` must be set in the production `.env`. This
ensures the session cookie is never transmitted over an unencrypted connection. `SESSION_ENCRYPT=true`
must also be set to encrypt the session payload stored in Redis.

---

### 6. Email Policy

**Mailpit is a development-only mail sink. It is prohibited in Staging and Production.**

Mailpit silently discards all outbound email. If the production server is configured with
`MAIL_HOST=mailpit`, no transactional email (password resets, notifications, order confirmations)
will ever reach a customer. This is a silent failure — the application will log a successful
send while the customer receives nothing.

**Production mail requirements:**

- The mail provider must accept SMTP over TLS (port 587 with STARTTLS or port 465 with TLS).
- The provider must support volume appropriate for the deployment (transactional, not bulk).
- SPF, DKIM, and DMARC must be configured for the sending domain to prevent deliverability failures.

**Provider independence:**

The ECOS ERP application layer must remain independent of any specific mail provider. Configuration
is via standard Laravel SMTP variables (`MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`,
`MAIL_ENCRYPTION`). No provider SDK may be introduced into the application layer.

Future providers may include Amazon SES (via SMTP endpoint), Postmark, Mailgun, or Brevo.
Switching providers requires only an `.env` change — no code change.

---

### 7. Health Monitoring

Three distinct tiers of health information must be available in Staging and Production.

#### Infrastructure Health

Answers: *Are the containers running and reachable?*

| Endpoint | Expected Response | Owner |
|---|---|---|
| `GET /healthz` | `200 OK` with body `ok` | Nginx (no PHP, no database) |
| Docker healthcheck `app` | `healthy` status | PHP-FPM socket check |
| Docker healthcheck `nginx` | `healthy` status | Internal wget to `/healthz` |

`/healthz` is served entirely by nginx with a static `return 200` directive. It requires no PHP
and no database connection. If `/healthz` fails, the problem is at the web server layer.

#### Application Health

Answers: *Is the application stack (PHP + database + Redis) functional?*

| Endpoint | Expected Response | Meaning |
|---|---|---|
| `GET /api/auth/me` | `200` or `401` | PHP, database, and session layer are responding |

A `401` is a correct response — it means the authentication layer is functioning. A `500` or a
connection timeout indicates an application-layer failure.

#### Business Health

Answers: *Are core business operations processing?*

Business health is not a single endpoint — it is derived from monitoring:

- Queue depth and worker status (jobs pending, failed jobs count)
- WooCommerce sync lag (time since last successful sync per channel)
- Inventory movement activity (absence of ledger entries may indicate a stuck queue worker)

Business health monitoring is a future integration target (see Section 11).

---

### 8. Version Endpoint

Every Production and Staging deployment must serve a version endpoint:

```
GET /version
```

The endpoint returns a JSON object identifying the running deployment:

```json
{
  "version":     "1.4.2",
  "commit":      "a3f9c21",
  "branch":      "main",
  "build_time":  "2026-06-26T08:31:00Z",
  "environment": "production"
}
```

| Field | Source | Purpose |
|---|---|---|
| `version` | `composer.json` or git tag | Human-readable release identifier |
| `commit` | `git rev-parse --short HEAD` at build time | Exact code version; used in deployment verification |
| `branch` | `git rev-parse --abbrev-ref HEAD` at build time | Confirms the correct branch is deployed |
| `build_time` | UTC timestamp at build time | Confirms the build is recent; detects stale deploys |
| `environment` | `APP_ENV` | Confirms the correct environment config is active |

**Purpose:** The version endpoint is read by `healthcheck.sh` after every deployment to confirm
that the expected commit SHA is live. A deployment that completes all steps but serves the wrong
commit is caught here.

**Access control:** The version endpoint is publicly readable. It must not include secret values,
internal hostnames, or database connection strings.

---

### 9. Logging Policy

#### Log Levels by Environment

| Level | Local | Staging | Production |
|---|---|---|---|
| `debug` | Permitted | Prohibited | Prohibited |
| `info` | Permitted | Permitted | Prohibited |
| `warning` | Permitted | Permitted | Permitted |
| `error` | Permitted | Permitted | Permitted |

`LOG_LEVEL=debug` in Production is prohibited. Debug logs expose:
- SQL queries and bindings (including sensitive values)
- Internal service call chains
- Stack traces with file paths
- Configuration values

In Production, `LOG_LEVEL=error` is the standard. `warning` may be used when a temporary
diagnostic period is authorized, with a defined end date.

#### Log Format

Production logs must be structured JSON to enable machine parsing and log aggregation. The
Laravel `LOG_CHANNEL=stack` with a JSON formatter is the production standard.

#### Correlation IDs

Every inbound HTTP request must receive a correlation ID (`X-Correlation-ID` header). Every
log entry emitted during that request must include the correlation ID. Every domain event
published during that request must include the correlation ID (see ADR-006).

This allows a single failed request to be traced across nginx, PHP, queue workers, and external
integrations using a single identifier.

#### Deployment IDs

Every deployment generates a unique deployment ID recorded in the deployment log. Log entries
emitted immediately after a deployment may be tagged with the deployment ID to identify
post-deploy regressions.

#### Retention

| Environment | Minimum Retention |
|---|---|
| Local | No requirement |
| Staging | 30 days |
| Production | 90 days minimum; 1 year where regulatory requirements apply |

Log files must be rotated to prevent unbounded disk growth. Laravel's `daily` log channel
with a retention count satisfies this requirement.

---

### 10. Backup Strategy

#### Database Backups

| Property | Requirement |
|---|---|
| Frequency | Daily minimum; hourly for production with active orders |
| Scope | Full database dump (`mysqldump --single-transaction`) |
| Storage | Off-server — a server failure must not destroy the backup |
| Retention | 30 days minimum; last 7 daily, last 4 weekly |
| Encryption | Backups must be encrypted at rest before transfer to backup storage |

#### File Backups

The following directories contain runtime-generated files that must be backed up:

| Path | Contents |
|---|---|
| `backend/storage/app/` | User-uploaded files, generated documents |
| `backend/storage/logs/` | Application logs (if not forwarded to external aggregator) |

The `backend/public/app/` directory (Vite build output) is **not** backed up — it is
regenerated from source on every deployment.

Named Docker volumes (`mysql-data`, `redis-data`) are not backed up at the volume level.
The MySQL named volume is backed up via `mysqldump`, not volume snapshot.

#### Restore Verification

A backup that has never been tested is not a backup — it is a hope.

Restore verification must be performed:
- After the first backup of a new production environment.
- Quarterly thereafter.
- Any time the backup tooling or storage destination changes.

Verification procedure: restore the backup to an isolated environment and confirm that the
application starts, data is present, and a sample of records is correct.

---

### 11. Rollback Strategy

#### Principles

1. **Application rollback is fast and safe.** The deployment pipeline stores the previous commit
   SHA before every deployment. Reverting code requires a single command.
2. **Database rollback is dangerous and may be irreversible.** Schema changes that drop columns,
   rename tables, or remove data cannot be automatically reversed without data loss.
3. **Rollback and migration reversal are separate decisions.** A code rollback does not
   automatically reverse migrations. The two are decoupled.

#### Application Rollback

| Scenario | Action | Safe? |
|---|---|---|
| Bad code, no schema change | `rollback.sh` | Yes — always safe |
| Bad code + additive migration | `rollback.sh` | Yes — old code ignores new columns |
| Bad code + breaking migration | `rollback.sh` + `migrate:rollback` | Conditional — data-safe only |
| Bad code + destructive migration | Restore from database backup first | No automatic path |

#### Migration Policy

- Migrations must be **backward-compatible by default.** A migration may add columns, create tables,
  or add indexes without requiring a simultaneous code change in the same deployment.
- Migrations that remove columns or tables are permitted only after the code referencing those
  columns has been removed and deployed in a prior release.
- Migrations must never truncate or delete business data. Data transformation belongs in a
  seeder or a dedicated data migration job, not in a schema migration.
- `php artisan migrate --force` is required for automated deployments. The `--force` flag
  bypasses the interactive confirmation prompt. It does not bypass safety — it confirms that
  the automated pipeline is the authorized executor.

---

### 12. Security Standards

#### SSH Access

- SSH password authentication must be disabled on Production servers. Key-based authentication only.
- The `root` user must not be used for application operations or deployment.
- SSH port may be changed from 22 as a hardening measure, but must be documented in the
  `DEPLOY_PORT` GitHub Secret.
- Inbound SSH access must be restricted to known IP ranges where operationally feasible.

#### Deploy User

- Deployments are executed under a dedicated deploy user (e.g., `ubuntu` or a dedicated `deploy`
  account), not as root.
- The deploy user must be a member of the `docker` group to run `docker compose` commands.
- The deploy user must have no sudo access beyond what is strictly required for deployment.
- The deploy SSH key must be a dedicated key used only for deployments — not a developer's
  personal key.

#### Firewall and Port Exposure

Only the following ports may be publicly accessible on a Production server:

| Port | Protocol | Service |
|---|---|---|
| 80 | TCP | HTTP (redirect to 443 only) |
| 443 | TCP | HTTPS |
| `DEPLOY_PORT` | TCP | SSH (restricted to known IPs where possible) |

All other ports must be bound to `127.0.0.1` or restricted to the Docker internal network.

| Service | Required Binding |
|---|---|
| MySQL (3306) | `127.0.0.1` only — never public |
| Redis (6379) | `127.0.0.1` only — never public |
| PHP-FPM (9000) | Docker internal network only |
| Mailpit SMTP (1025) | `127.0.0.1` only — dev/test only |
| Mailpit UI (8025) | `127.0.0.1` only — dev/test only |

#### Docker Network Isolation

All application services communicate over the `ecos-network` Docker bridge network. Services
reference each other by service name (`mysql`, `redis`, `mailpit`, `app`), not by host IP.
This network is not exposed to the host.

The principle is: **containers talk to each other; only nginx talks to the outside world.**

#### Password Policy

- Database passwords (MySQL user and root) must be at least 32 characters, randomly generated,
  and unique per environment.
- Redis passwords must be at least 32 characters.
- No default, dictionary, or example passwords (`secret`, `password`, `root`, `changeme`) are
  permitted in Staging or Production.

#### Future: Multi-Factor Authentication

SSH access to Production servers must support MFA enforcement (e.g., TOTP via PAM or hardware
key via FIDO2) in future deployments where the security posture requires it. This is not a
current requirement but must not be architecturally foreclosed.

---

### 13. Monitoring (Future Integration Targets)

The following monitoring integrations are planned but not yet implemented. They are documented
here so that future implementation choices remain consistent with the declared architectural intent.

| Layer | Tool Category | Purpose |
|---|---|---|
| Infrastructure metrics | Prometheus + Grafana | CPU, memory, disk, network per container |
| Application errors | Error tracking (e.g., Sentry) | Exception capture, stack traces, release tracking |
| Alerting | PagerDuty / OpsGenie / Slack | On-call notification for downtime and error spikes |
| Audit logs | Immutable audit trail | Security-relevant actions (logins, privilege changes, bulk operations) |
| Queue health | Laravel Horizon | Queue depth, throughput, failed job rate |

When these integrations are implemented, each will require its own ADR for the specific tooling
decision. This ADR establishes the requirement; future ADRs establish the implementation.

---

### 14. Production Readiness Checklist

This checklist must be completed before any environment is classified as Production-ready.
Items marked *(future)* are not currently required but must be resolved before GA release.

#### Environment Configuration

- [ ] `APP_ENV=production`
- [ ] `APP_DEBUG=false`
- [ ] `APP_URL` is the correct HTTPS domain
- [ ] `APP_KEY` is unique to this environment
- [ ] `SESSION_SECURE_COOKIE=true`
- [ ] `SESSION_DOMAIN` is set to the production domain
- [ ] `SESSION_ENCRYPT=true`
- [ ] `LOG_LEVEL=error`

#### Security

- [ ] No secrets in `docker-compose.yml` — all values use `${VAR}` substitution
- [ ] `DB_PASSWORD` and `MYSQL_ROOT_PASSWORD` are strong and unique
- [ ] `REDIS_PASSWORD` is set
- [ ] SSH password authentication disabled on the server
- [ ] MySQL port (3306) is NOT publicly accessible
- [ ] Redis port (6379) is NOT publicly accessible
- [ ] Mailpit ports (1025, 8025) are NOT publicly accessible
- [ ] Nginx security headers present (X-Content-Type-Options, X-Frame-Options, etc.)

#### HTTPS

- [ ] TLS certificate is installed and valid
- [ ] HTTPS responds correctly (`curl -I https://domain/healthz` → 200)
- [ ] HTTP redirects to HTTPS
- [ ] HSTS header is present
- [ ] `SESSION_SECURE_COOKIE=true` confirmed after HTTPS is live

#### Deployment

- [ ] Automated pipeline is configured (GitHub Actions or equivalent)
- [ ] No manual deployment was used to bootstrap the environment
- [ ] `DEPLOY_PATH`, `DEPLOY_HOST`, `DEPLOY_USER`, `SSH_PRIVATE_KEY` are set in GitHub Secrets
- [ ] A test deployment has completed successfully end-to-end
- [ ] Rollback has been tested in Staging at least once

#### Database

- [ ] Migrations are up to date (`php artisan migrate:status` — no pending)
- [ ] Database backup is configured and has run at least once
- [ ] Restore from backup has been verified in an isolated environment
- [ ] `MYSQL_ROOT_PASSWORD` is not the default value

#### Queue and Cache

- [ ] `QUEUE_CONNECTION=redis`
- [ ] `CACHE_STORE=redis`
- [ ] Queue workers are running (`docker compose exec app php artisan queue:monitor`)
- [ ] No failed jobs in the queue

#### Mail

- [ ] `MAIL_HOST` is NOT `mailpit`
- [ ] A test email has been sent and received from the production server
- [ ] SPF, DKIM, and DMARC are configured for the sending domain

#### Health Endpoints

- [ ] `GET /healthz` → `200 OK` with body `ok`
- [ ] `GET /api/auth/me` → `200` or `401` (never `500`)
- [ ] `GET /app/index.html` → `200` with a Vite asset reference
- [ ] `GET /version` → `200` with correct commit SHA *(future)*

#### Monitoring

- [ ] Container health status is `healthy` for `app` and `nginx`
- [ ] Error tracking is configured *(future)*
- [ ] Alerting is configured for downtime *(future)*
- [ ] Audit logging is enabled *(future)*

#### Backups

- [ ] Daily database backup is scheduled
- [ ] Backup storage is off-server
- [ ] Backup encryption is enabled
- [ ] Restore verification has been completed

---

## Consequences

### Positive

- **Consistent deployments.** Every future deployment — including customer environments — has a
  defined baseline. Auditing a deployment means checking against this document.
- **Eliminated silent failures.** The email policy and health monitoring requirements prevent the
  class of failures where the application appears healthy but core functionality (email delivery,
  queue processing) is silently broken.
- **Security surface reduced.** The port binding and secret management rules close the most common
  misconfiguration vulnerabilities without requiring external tooling.
- **Rollback is deliberate.** The separation of application rollback from migration rollback
  prevents accidental data loss during incident response.
- **Onboarding.** New team members and future customers have a single authoritative document
  that defines what production compliance requires.

### Negative / Trade-offs

- **Checklist overhead.** The production readiness checklist adds friction to the first deployment
  of a new environment. This is intentional — misconfigured production environments are expensive
  to fix after the fact.
- **HTTPS is a hard prerequisite.** The HTTPS policy blocks a production deployment that does not
  yet have a domain and certificate. A domain name and DNS configuration are therefore prerequisites
  to first launch, not optional enhancements.
- **No manual deployments.** Prohibiting manual production deployments means the CI/CD pipeline
  must be fully functional before production can be updated. Pipeline outages are now blocking.
- **Secret rotation has operational cost.** The rotation policy requires coordinated changes across
  the server `.env`, Docker Compose, and GitHub Secrets. This cost is real but necessary.

---

## Related ADRs

| ADR | Relationship |
|---|---|
| [ADR-001](ADR-001-Lifecycle-and-Data-Integrity.md) | Data integrity and archive policy extends to backup retention requirements |
| [ADR-002](ADR-002-Stock-Ledger.md) | Immutable ledger entries must survive database restore — backup completeness is required |
| [ADR-003](ADR-003-WooCommerce-Integration.md) | External channel sync lag is a Business Health indicator (Section 7) |
| [ADR-006](ADR-006-Inventory-Domain-Events.md) | Correlation IDs in domain events must match the HTTP request correlation ID (Section 9) |

---

## Future Considerations

- **Multi-tenant deployments.** If ECOS ERP is deployed as a SaaS platform with multiple
  customer tenants in a single stack, the environment strategy must be extended to include
  tenant isolation, per-tenant backup policies, and per-tenant audit logs.
- **Secret Manager migration.** As the number of customer deployments grows, managing `.env`
  files per server becomes operationally unsustainable. A future ADR will address migration
  to a centralized secret manager (AWS Secrets Manager, HashiCorp Vault, or equivalent).
- **Canary deployments.** The current pipeline deploys to 100% of traffic immediately.
  At scale, a canary or blue-green deployment strategy may be required to reduce the blast
  radius of a bad release.
- **Compliance requirements.** If the system processes payment card data or operates in
  jurisdictions with specific data residency requirements (GDPR, Egyptian data protection
  law), this ADR will need a compliance annex.
