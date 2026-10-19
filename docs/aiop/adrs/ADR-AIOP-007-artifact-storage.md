# ADR-AIOP-007: Artifact Storage Strategy
## Architecture Decision Record

**Status:** Accepted  
**Date:** 2026-07-18  

---

## Context

AI agent executions produce multiple types of artifacts that must be stored securely, versioned, and made available for review. Artifacts include:
- Code diffs (unified diff format, potentially large)
- Full modified files (for context)
- Test results (JUnit XML, custom formats)
- Execution reports (JSON, markdown)
- Raw execution logs (potentially gigabytes for long-running tasks)
- Screenshots or visual outputs (future)

We need a storage strategy that handles diverse artifact types, large volumes, and long retention requirements without bloating the database.

---

## Decision

### Artifact Storage: Object Storage (S3-Compatible) + Metadata in Database

Artifacts are stored in S3-compatible object storage. The database stores metadata (filename, type, size, checksum, storage key, task reference) but not artifact content.

### Storage Layout

```
Artifact Vault Bucket Structure:
{bucket}/
  {workspace_id}/
    {project_id}/
      {task_id}/
        {execution_id}/
          report.json            ← AI execution report
          diff.patch             ← Unified diff of changes
          tests.xml              ← Test results (JUnit XML)
          logs/
            execution.log        ← Full execution log
            agent.log            ← AI agent stderr/debug output
          files/
            {path/to/file.php}   ← Modified files (full content)
```

### Artifact Types

| Type | Format | Max Size | Retention |
|---|---|---|---|
| `code_diff` | Unified diff | 50 MB | 1 year |
| `modified_files` | Archive (zip) | 200 MB | 1 year |
| `execution_report` | JSON | 1 MB | 2 years |
| `test_results` | JUnit XML | 10 MB | 1 year |
| `execution_log` | Plain text | 1 GB | 90 days |
| `agent_debug_log` | Plain text | 500 MB | 30 days |
| `screenshot` | PNG/WebP | 10 MB | 1 year |

### Upload Protocol

Workers upload artifacts via presigned URLs:
1. Worker requests presigned upload URL: `POST /api/aiop/worker/artifacts/presign`
2. Control plane generates S3 presigned URL (valid 15 minutes)
3. Worker uploads directly to S3 using presigned URL (bypasses control plane for large files)
4. Worker notifies control plane of completion: `POST /api/aiop/worker/artifacts/confirm`
5. Control plane verifies checksum, creates artifact metadata record

### Access Control

- Artifact URLs are **presigned** with a 1-hour expiry for review access
- Workers cannot access other tasks' artifacts (presign requests are scoped by token)
- Audit log records every artifact access

### Integrity Verification

```
Upload Flow:
Worker computes SHA-256 → Uploads to S3 → Notifies control plane with checksum
Control plane → Computes SHA-256 from S3 object → Compares → Stores verified checksum

Access Flow:
Reviewer requests artifact → Control plane generates presigned URL with checksum in response
Browser downloads artifact → UI computes SHA-256 → Compares with stored checksum → Displays result
```

### Retention and Archiving

- **Hot Storage (0–90 days):** Frequent access tier (S3 Standard)
- **Warm Storage (90 days–1 year):** Infrequent access tier (S3-IA / Glacier Instant)
- **Cold Archive (1 year–5 years):** Deep archive tier (Glacier Deep Archive)
- **Deletion:** Artifacts are never deleted during the retention period; deletion only after archival period expires

### Log Streaming (for real-time UI)

Execution logs are streamed in real time from the worker to the control plane during execution:
- Worker sends log chunks via `POST /api/aiop/worker/executions/{id}/log` (100-line batches)
- Control plane stores chunks in Redis temporarily for streaming to the UI via WebSocket
- At execution completion, the full log is assembled and uploaded to S3 as `execution.log`
- Redis log buffer is cleared after 24 hours

---

## Consequences

### Positive
- No artifact size limits imposed by the database
- S3 presigned URLs mean workers upload directly to storage (no control plane bandwidth cost)
- Tiered retention automatically moves old artifacts to cheaper storage

### Negative
- S3-compatible storage required as a dependency (MinIO for self-hosted)
- Presign URL dance adds 1 extra round trip per artifact upload
