# ECOS Git Hooks

## guardian-pre-commit.sh (TASK-ENG-V2-003)

Pre-commit gate that submits the staged diff to the Engineering Guardian
(`POST /api/system/engineering/guardian/runs`) and blocks the commit unless the
decision is `allow`. Fails closed on any error — there is no bypass flag (ADR-034).

### Installation

Git Bash / Linux / macOS:

```bash
cp scripts/git-hooks/guardian-pre-commit.sh .git/hooks/pre-commit
chmod +x .git/hooks/pre-commit
```

### Required environment variables

| Variable | Purpose |
|---|---|
| `ECOS_API_URL` | Base URL of the ECOS backend, e.g. `https://erp.example.com` |
| `ECOS_API_TOKEN` | Sanctum bearer token of the committing engineer |

### Dependencies

`curl` and `jq` must be on PATH.
