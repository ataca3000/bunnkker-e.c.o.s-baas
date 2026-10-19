# ADR-025 — Workspace Strategy

**Status:** Approved
**Date:** 2026-07-22
**Deciders:** Engineering Platform Team
**Output Directory:** docs/engineering-cloud/

---

## 1. Context

Every EngineeringTask executes in an isolated Workspace. Without a disciplined workspace model, concurrent tasks interfere with each other through shared filesystems, cached dependencies, or leaked environment variables — producing non-deterministic results and hard-to-diagnose failures.

This ADR defines the complete Workspace model: its isolation guarantees, lifecycle, locking semantics, caching strategy, git branch conventions, artifact storage, security constraints, and failure recovery procedures. All EngineeringAgent and EngineeringWorker implementations must conform to this specification.

---

## 2. Workspace Definition

A **Workspace** is a disposable, isolated execution environment. It is created for a single ExecutionSession, owned by exactly one EngineeringTask at a time, and destroyed (or archived) when the task transitions to Completed, Failed, or Cancelled.

A Workspace contains:

- A **git clone** checked out at a specific branch (`eng/{task_id_short}/{slug}`)
- The **required toolchain** verified before hand-off (PHP, Node, Composer, npm, or project-specific binaries)
- **Temporary files and build outputs** stored under `/workspace/tmp/`
- A **WorkspaceLock** that enforces single-session access

Workspaces are never reused across tasks. A Workspace retired from one task is cleaned and its slot returned to the warm pool or released entirely.

---

## 3. Workspace Isolation Model

### 3.1 Isolation Levels

Three isolation levels are defined in ascending order of security and resource cost.

| Level | Description | Guarantees | Use Case |
|---|---|---|---|
| **Process Isolation** (default) | The task runs in a separate OS process group with a chroot jail. No shared filesystem mounts between concurrent tasks. | Filesystem namespace separation, distinct environment variable set, resource limits via cgroups, no cross-task process visibility. | Development and CI environments where throughput matters more than strict security. |
| **Container Isolation** (recommended production) | The task runs inside a Docker container with a private network namespace. The container image is pre-baked with the verified toolchain. | Full filesystem isolation via overlayfs, private network namespace, no ambient host capabilities, resource limits enforced by container runtime, ephemeral container ID per session. | Standard production deployments. Balances security with provisioning speed. |
| **VM Isolation** (high-security) | The task runs inside a dedicated virtual machine provisioned by a hypervisor. The VM is created fresh per task and destroyed at completion. | Hypervisor-level memory isolation, dedicated kernel, hardware-enforced network separation, no shared kernel namespaces, full disk encryption at rest. | Tasks handling secrets, production credentials, or compliance-sensitive code. |

### 3.2 Isolation Guarantees

Regardless of isolation level, the following guarantees hold for every Workspace:

- **Filesystem:** No task can read or write to another task's working directory. Shared caches (git objects, dependency caches) are read-only mounts accessible to all tasks but writable only by the cache manager process.
- **Network:** Outbound connections are restricted to the whitelist defined in Section 10. No task can reach another task's local network interface.
- **Environment Variables:** Each Workspace receives only the environment variables explicitly provided by the ExecutionSession. No host environment variables are inherited.
- **Process Table:** A task cannot observe or signal processes belonging to another task. Under Container and VM isolation, the task cannot see host processes at all.
- **Resource Limits:** CPU (cores or shares), memory (RAM and swap), disk I/O bandwidth, and open file descriptors are all bounded per workspace. Exceeding any limit raises a WorkspaceResourceExhausted event and triggers controlled cleanup.

---

## 4. Workspace Lifecycle

### 4.1 States

| State | Meaning | Entry Conditions | Exit Conditions | Max Duration |
|---|---|---|---|---|
| **Pending** | Workspace has been requested but no slot has been allocated. | EngineeringTask moves to Queued and requests a Workspace. | Slot available in warm pool or cold-start initiated. | 5 minutes before escalation to Ops. |
| **Provisioning** | Slot allocated; git clone, toolchain verification, and environment setup are in progress. | Slot obtained from pool or fresh allocation approved. | All provisioning steps succeed, WorkspaceLock acquired. | 90 seconds (warm path: 15 seconds). If exceeded, transition to Failed. |
| **Active** | Workspace is fully provisioned and the ExecutionSession is running. | WorkspaceLock acquired and handed off to the EngineeringWorker. | Session completes, fails, is paused, or lock TTL expires without renewal. | Unbounded while lock is renewed; forced timeout after 4 hours (lock TTL). |
| **Idle** | Task is Paused; the Workspace is held but not actively executing. | EngineeringTask transitions to Paused. | Task resumes (back to Active) or is Cancelled/Failed (forward to Archiving). | 30 minutes. Idle beyond 30 minutes triggers automatic archiving. |
| **Archiving** | Artifacts are being collected, git status verified, and working directory cleaned. | Task leaves Active or Idle due to completion, failure, or cancellation. | Artifact upload confirmed, directory deleted, lock released. | 10 minutes. If exceeded, forced cleanup and slot released. |
| **Archived** | Workspace slot is released. Artifacts are in object storage. | Archiving completes successfully. | Terminal state. | Indefinite — record retained for audit trail. |
| **Failed** | Workspace could not be provisioned or was corrupted mid-execution. | Provisioning timeout, git clone failure, disk full, or unrecoverable corruption detected. | Ops alert raised, partial artifacts salvaged if possible, slot forcefully released. | Terminal state after recovery attempt. |

### 4.2 Provisioning Flow

Provisioning follows one of two paths depending on warm pool availability.

**Warm Path (target: under 10 seconds)**

1. **Allocate slot from warm pool** — claim a pre-cloned workspace instance that matches the required toolchain version.
2. **Fetch latest commits** — `git fetch origin` and `git reset --hard origin/{base_branch}` to bring the clone up to date.
3. **Create task branch** — `git checkout -b eng/{task_id_short}/{slug}`.
4. **Verify toolchain** — confirm all required binaries are present and at correct versions. Abort if any are missing.
5. **Inject environment** — write the session-scoped `.env` from secrets manager. No credentials are stored in the repo.
6. **Acquire WorkspaceLock** — optimistic lock insert. If another session holds the lock, retry once then fail.
7. **Hand off to EngineeringWorker** — emit WorkspaceProvisioned event and pass workspace path and lock token.

**Cold Path (target: under 60 seconds)**

1. **Allocate a fresh slot** — provision a new container or VM depending on isolation level.
2. **Clone repository** — `git clone --filter=blob:none --single-branch` using the shared git object cache (Section 6.1). Reduces clone time from 60 seconds (full) to 5 seconds (cached).
3. **Install toolchain** — apply the pinned toolchain manifest. Resolved from the dependency cache (Section 6.2) where possible.
4. **Create task branch** — as above.
5. **Verify toolchain** — as above.
6. **Inject environment** — as above.
7. **Acquire WorkspaceLock** — as above.
8. **Hand off to EngineeringWorker** — emit WorkspaceProvisioned event.

### 4.3 Warm Pool

The warm pool maintains a set of pre-provisioned, pre-cloned workspace slots ready for immediate assignment. This eliminates cold-start latency for the common case.

| Tier | Pool Size | Refresh Strategy |
|---|---|---|
| Process Isolation | 10 slots | Replaced immediately on consumption; target 10 idle at all times. |
| Container Isolation | 20 slots | Replaced immediately on consumption; target 20 idle at all times. |
| VM Isolation | 5 slots | Replaced on consumption with a 45-second spin-up lag; target 5 idle. |

**Staleness Policy:** A warm pool slot is considered stale if the last `git fetch` was more than 1 hour ago. Stale slots are evicted from the pool and replaced. The eviction process runs `git fetch` in the background before placing a fresh slot; the stale slot remains available until its replacement is ready to avoid pool depletion.

**Pool Replenishment:** When pool size falls below 50% of target, an alert is raised and the pool manager begins emergency replenishment. Replenishment is rate-limited to avoid saturating the git server.

### 4.4 Cleanup

**Normal cleanup on task completion or failure:**

1. **Archive artifacts** — upload all declared TaskArtifacts (Section 9) to object storage. Compute checksum before upload.
2. **Git status check** — run `git status` and `git diff HEAD` to detect uncommitted work. Log a warning if any untracked or modified files exist outside declared artifact paths. This is informational only; it does not block cleanup.
3. **Delete working directory** — recursively delete the workspace root including `/workspace/tmp/`.
4. **Release WorkspaceLock** — set `released_at` on the WorkspaceLock record. Emit WorkspaceLockReleased event.
5. **Return slot to pool** — for Process Isolation, return the cleaned slot to the warm pool after re-cloning. For Container and VM Isolation, destroy the container or VM; the pool manager provisions a replacement asynchronously.

**Orphan Detection:** A Workspace in Active or Idle state with no associated active ExecutionSession for 15 or more minutes is classified as orphaned. The workspace manager performs the cleanup sequence above automatically without waiting for task input. A WorkspaceOrphanDetected event is emitted. The corresponding EngineeringTask is transitioned to Failed if it was still in Running state.

---

## 5. WorkspaceLock Design

The WorkspaceLock enforces the invariant that at most one ExecutionSession holds a Workspace at any time.

**Schema:**

| Field | Type | Description |
|---|---|---|
| `workspace_id` | UUID | Foreign key to the Workspace record. |
| `session_id` | UUID | Foreign key to the ExecutionSession that holds the lock. |
| `acquired_at` | Timestamp | When the lock was first acquired. |
| `ttl_seconds` | Integer | Lock lifetime. Default: 14,400 (4 hours). |
| `last_renewed_at` | Timestamp | Timestamp of the most recent TTL extension. |
| `released_at` | Timestamp (nullable) | Null while lock is held; set on release. |

**Acquisition:** Lock acquisition uses optimistic locking via a unique index on `(workspace_id, released_at IS NULL)`. The INSERT either succeeds atomically or fails with a constraint violation if another session already holds the lock. No pessimistic SELECT FOR UPDATE is used. On failure, the requester retries once after 2 seconds. A second failure raises a WorkspaceLockConflict event and the provisioning sequence is aborted.

**TTL:** The default TTL is 4 hours. This represents the maximum duration any single task execution should require. Tasks exceeding this limit are forcibly aborted.

**Extension:** The EngineeringWorker renews the lock every 30 minutes by updating `last_renewed_at`. The lock is considered alive if `last_renewed_at + ttl_seconds > now()`. A lock that fails to renew for 45 minutes is treated as stale.

**Stale Lock Detection:** A background job runs every 5 minutes and queries for locks where `last_renewed_at + ttl_seconds < now()` and `released_at IS NULL`. For each stale lock:

1. Verify the associated ExecutionSession is truly inactive (not a transient renewal delay).
2. If inactive: set `released_at`, emit WorkspaceStaleLockForceReleased, and initiate the orphan cleanup sequence.
3. If active but failing to renew (EngineeringWorker crash suspected): emit WorkerHeartbeatMissed and escalate to Ops.

---

## 6. Workspace Cache Strategy

### 6.1 Git Object Cache

A shared, read-only git object store is maintained on a fast local volume accessible to all workspace slots. When a cold-start clone is initiated, git is configured to use `--reference /cache/git-objects/{repo_name}` which satisfies object fetches from the local cache before hitting the remote.

- **Effect:** Reduces cold-start git clone from 60 seconds to approximately 5 seconds for large repositories.
- **Cache maintenance:** The cache is updated by a scheduled job every 15 minutes via `git fetch --all` into the reference repository.
- **Invalidation:** The cache is never manually invalidated; stale objects are harmless because git verifies object integrity. The reference repo is refreshed, not replaced.

### 6.2 Dependency Cache

Composer (PHP) and npm (Node) dependency installations are cached, keyed by the hash of the relevant lockfile.

- **Composer:** Cache key is `sha256(composer.lock)`. Cached directory: `/cache/composer/{hash}/vendor/`. TTL: 24 hours.
- **npm:** Cache key is `sha256(package-lock.json)` or `sha256(yarn.lock)`. Cached directory: `/cache/npm/{hash}/node_modules/`. TTL: 24 hours.
- **Cache hit:** The cached vendor/node_modules directory is bind-mounted read-only into the workspace. The workspace receives a writable overlay layer for any runtime writes.
- **Cache miss:** Dependencies are installed fresh into the workspace and then written to the cache store.
- **TTL enforcement:** A cleanup job runs daily and removes cache entries older than 24 hours. Entries for lockfile hashes no longer present in any active branch are eligible for removal after 72 hours.

### 6.3 Build Artifact Cache

Compiled outputs (transpiled TypeScript, compiled PHP extension stubs, built assets) are cached to avoid redundant build steps across tasks working on the same content.

- **Cache key:** Content hash of all input files declared in the build manifest, combined with the dependency cache key.
- **Invalidation:** Cache entry is invalidated automatically when the dependency cache key changes (i.e., lockfile changes). Manual invalidation is available via a cache-bust API endpoint.
- **Scope:** Build artifact cache is scoped to the repository and branch prefix `eng/`. Artifacts from `main` or `release/*` branches are not cached here — they are managed by the release pipeline.

---

## 7. Git Branch Strategy

### 7.1 Branch Naming

All task branches follow the pattern:

```
eng/{task_id_short}/{slug}
```

- `task_id_short` — the first 8 characters of the EngineeringTask UUID.
- `slug` — a lowercase, hyphen-separated abbreviation of the task title, maximum 40 characters, non-alphanumeric characters removed.

Example: `eng/a3f7b2c1/add-worker-heartbeat-renewal`

### 7.2 Branch Lifecycle

- **Created at provisioning:** The task branch is created from the configured base branch (typically `main` or a release branch) at the moment the Workspace is provisioned.
- **Owned by the task:** Only the EngineeringWorker holding the WorkspaceLock may push to the branch. No other actor pushes to `eng/*` branches.
- **Merged or deleted at completion:** On Completed, the branch is merged into the base branch via a pull request if the task produced a code artifact, or deleted if no code was produced. Merge is performed by the release pipeline, not the workspace cleanup process.
- **Deleted on failure or cancellation:** On Failed or Cancelled, the branch is deleted. If the branch contains commits the operator wants to preserve, they must explicitly rescue the branch before the task reaches terminal state.
- **Never reused:** A branch name is never assigned to a second task. The `task_id_short` component guarantees uniqueness. Even if the task is retried, a new UUID suffix is generated.

### 7.3 Conflict Detection

Before provisioning completes and the lock is handed off, the workspace manager checks the divergence of the task branch against the base branch:

1. Run `git rev-list --count origin/{base_branch}...HEAD` to count commits the base has that the branch does not.
2. If the count exceeds 50 commits, emit a WorkspaceBranchDiverged event with the divergence count and alert the assigned EngineeringAgent.
3. The workspace is still handed off; the alert is informational and does not block execution. The EngineeringAgent decides whether to rebase before proceeding.

---

## 8. Temporary File Management

All temporary files generated during task execution must be written under `/workspace/tmp/`. This directory is:

- **Cleared on cleanup:** Deleted entirely during the Archiving phase before the workspace directory is removed.
- **Size-limited:** Maximum total size 1 GB. If the limit is reached, a WorkspaceDiskLimitReached event is emitted and the task is suspended. The EngineeringAgent may declare specific files as TaskArtifacts for upload, then request cleanup of `/workspace/tmp/` to reclaim space.
- **Not automatically archived:** Files in `/workspace/tmp/` are deleted at cleanup regardless of content. Any output the task wants to preserve must be explicitly declared as a TaskArtifact (Section 9) before the task reaches terminal state.
- **Not accessible between tasks:** The `/workspace/tmp/` directory is workspace-scoped. No other task or session can access it.

---

## 9. Artifact Storage

TaskArtifacts are outputs a task explicitly declares for long-term retention. Declaring an artifact causes the workspace cleanup process to upload the file to object storage before deleting the working directory.

**Storage backend:** S3-compatible object storage. The bucket is isolated per environment (development, staging, production). Cross-environment access is not permitted.

**Retention:** 90 days by default. Artifacts associated with a ReleaseBundle are retained for 1 year. Retention can be extended on a per-artifact basis by the Engineering Platform operator.

**TaskArtifact record schema:**

| Field | Type | Description |
|---|---|---|
| `task_id` | UUID | The EngineeringTask that produced this artifact. |
| `filename` | String | Original filename as it existed in the workspace. |
| `content_type` | String | MIME type (e.g., `application/zip`, `text/plain`). |
| `size_bytes` | Integer | File size in bytes at time of upload. |
| `checksum` | String | SHA-256 hex digest computed before upload. Verified after upload. |
| `storage_path` | String | Full object storage path including bucket and key. |
| `created_at` | Timestamp | When the artifact record was created (at upload time). |

**Integrity verification:** The checksum is computed in the workspace before upload and re-verified by reading back the uploaded object. A mismatch raises a TaskArtifactCorruption event and the upload is retried once. A second mismatch escalates to Ops and the task is marked Failed.

---

## 10. Security Constraints

### Network Whitelist

Outbound network access from any Workspace is restricted to the following destinations only:

| Destination | Protocol | Purpose |
|---|---|---|
| `github.com` | HTTPS (443) | Git clone, pull, push, GitHub API. |
| `registry.npmjs.org` | HTTPS (443) | npm package installation. |
| `packagist.org` | HTTPS (443) | Composer package resolution. |
| Internal artifact registry | HTTPS (internal port) | Internal package mirror and build cache. |
| Internal secrets manager | HTTPS (internal port) | Runtime secret retrieval. |
| Internal object storage | HTTPS (internal port) | TaskArtifact upload. |

All other outbound connections are blocked at the network layer (Container: iptables rules; VM: security group). Connection attempts to blocked destinations emit a WorkspaceUnauthorizedNetworkAccess event and are logged for security audit.

### Credentials Policy

- **No production database credentials** in any Workspace. Tasks that require database access use a dedicated, ephemeral test database provisioned by the CI pipeline.
- **Secrets via secrets manager only.** Credentials are never written to the repository, the `.env` file checked into git, or any log stream. The secrets manager injects them at runtime into the workspace environment.
- **Git credentials** are short-lived deploy keys scoped to read/write on `eng/*` branches only. They cannot merge to `main` or delete protected branches.

### Secure Workspace Deletion

When a Workspace is destroyed:

1. All files in the workspace root are overwritten with zeros before deletion (for VM Isolation) or the overlay filesystem is destroyed (for Container Isolation).
2. The environment variable file is explicitly zeroed and unlinked before the working directory delete.
3. The secrets manager revokes the short-lived credential set issued to the session.
4. For VM Isolation: the VM disk is cryptographically erased using the hypervisor's secure-erase API before the VM slot is returned to inventory.

---

## 11. Failure Scenarios

| Failure | Detection | Recovery | Data Loss Risk |
|---|---|---|---|
| **Provisioning timeout** | Workspace remains in Provisioning beyond 90 seconds (warm path: 15 seconds). WorkspaceProvisioningTimeout event emitted. | Abort provisioning, transition Workspace to Failed. Return slot to pool. EngineeringTask remains in Queued state and is re-assigned to a new slot automatically up to 3 times. | None — task has not started executing. |
| **Git clone failure** | `git clone` exits non-zero or times out during cold path. WorkspaceGitCloneFailure event emitted. | Retry clone once using a direct clone (bypassing object cache) to rule out cache corruption. If retry fails, mark Workspace as Failed. Ops alert raised. If cache is suspect, trigger cache invalidation for the repository. | None — no task code has run. |
| **Dependency install failure** | Composer or npm exits non-zero. WorkspaceDependencyInstallFailure event emitted with exit code and last 50 lines of output. | Do not retry automatically — dependency failures usually indicate a lockfile or registry issue requiring human intervention. Transition Workspace to Failed. Alert the EngineeringAgent with the error output. | None — workspace is pre-execution. |
| **Workspace corruption mid-execution** | EngineeringWorker reports a filesystem error, or integrity check on a file required by the task fails. WorkspaceCorrupted event emitted. | Attempt to upload any already-declared TaskArtifacts before cleanup. Transition Workspace to Failed. Transition EngineeringTask to Failed. Ops alert raised. Do not retry automatically — corruption implies an infrastructure issue. | Partial — work completed before corruption may be lost if not yet declared as artifacts. |
| **Disk full** | `/workspace` volume usage reaches 1 GB limit. WorkspaceDiskLimitReached event emitted. Task execution is suspended. | Notify EngineeringAgent. Agent may upload current artifacts to free space and resume. If no response within 10 minutes, transition Workspace to Failed and clean up. | Partial — artifacts declared and uploaded before disk-full are preserved. Undeclared in-progress work is lost. |
| **Lock acquisition failure** | Unique index violation on WorkspaceLock INSERT. WorkspaceLockConflict event emitted. | Retry acquisition once after 2 seconds. If the second attempt fails, verify whether the existing lock is stale. If stale (per Section 5 TTL rules), force-release it and retry. If not stale, abort provisioning and escalate to Ops — this indicates a double-assignment bug. | None — workspace was not yet in use. |

---

## 12. Consequences

**Positive:**

- Deterministic task execution: no cross-task interference from shared state.
- Fast provisioning via warm pool and git object cache reduces median workspace startup to under 10 seconds.
- Secure-by-default: network whitelist, secrets manager injection, and secure deletion prevent credential leakage.
- Full audit trail: WorkspaceLock history, artifact checksums, and all lifecycle events are persisted.

**Negative:**

- Warm pool consumes resources continuously even when no tasks are running. Pool size must be tuned per environment.
- VM Isolation adds 45-second cold-start latency; unsuitable for interactive or short-duration tasks.
- Artifact declaration is mandatory — undeclared work product is lost at cleanup. EngineeringAgents must be trained to declare artifacts before task completion.

**Risks:**

- Warm pool staleness if the refresh job falls behind; mitigated by the 1-hour staleness eviction policy and pool size monitoring.
- Object cache corruption causing systematic git clone failures; mitigated by the direct-clone fallback and cache invalidation API.
