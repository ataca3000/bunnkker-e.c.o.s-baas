# ECOS Engineering Certification Engine

Combines all three Engineering Guardians into a single pre-release certification with an overall quality score and release readiness verdict.

## Usage

```bash
# Full certification (all 12 categories, ~3 min)
bash engineering/certification/certification.sh

# Fast mode (skip TypeScript, PHPStan, Pint — ~30s)
bash engineering/certification/certification.sh --fast

# Skip deployment validators (no Docker required)
bash engineering/certification/certification.sh --no-deploy

# JSON output only (no console progress)
bash engineering/certification/certification.sh --json-only

# Custom report directory
bash engineering/certification/certification.sh --report-dir=/tmp/cert
```

## Categories

| Category | Source | Weight | Scoring |
|----------|--------|--------|---------|
| PHP | quality-guardian: php-syntax, pint, phpstan | 12% | PASS/FAIL per validator, averaged |
| Laravel | quality-guardian: laravel bootstrap | 6% | Binary |
| TypeScript | quality-guardian: tsc -b | 12% | Binary |
| React / ESLint | quality-guardian: eslint | 8% | Binary |
| Architecture | arch-guardian: adr, namespaces | 12% | 100 − penalties (capped) |
| Repository | arch-guardian: repository, duplicates | 8% | 100 − penalties (capped) |
| Translations | arch-guardian: translations | 5% | 100 − missing-key penalty |
| Docker | deploy-guardian: compose | 5% | Binary |
| Deployment | deploy-guardian: env, laravel-caches | 8% | Binary (both must pass) |
| Security | checks/01-security.sh | 14% | 100 − CRIT×50 − HIGH×15 − MED×5 |
| Performance | checks/02-performance.sh | 5% | 100 − HIGH×10 − MED×3 |
| Technical Debt | checks/03-tech-debt.sh | 5% | 100 − MED×10 − LOW×2 (min 50) |

**Total weight: 100%**

## Release Readiness Rules

The release is declared **READY** only when ALL of the following hold:

1. Overall score ≥ 80
2. Zero CRITICAL findings from any scanner
3. Security has zero HIGH or CRITICAL findings
4. PHP category = PASS (syntax, pint, phpstan all green)
5. TypeScript category = PASS

## Report Output

Each run produces two report files in `reports/`:

- `cert-YYYYMMDD-HHmmss.json` — machine-readable JSON for CI/CD integration
- `cert-YYYYMMDD-HHmmss.md` — human-readable markdown report

### JSON Structure

```json
{
  "ecos_certification": {
    "generated_at": "2026-07-21T02:00:00Z",
    "branch": "main",
    "commit": "abc1234",
    "categories": {
      "php":         { "score": 100, "status": "PASS", "weight": 12 },
      "security":    { "score":  85, "status": "WARN", "weight": 14 }
    },
    "metrics": {
      "dead_code_files": 0,
      "arch_critical": 0,
      "arch_high": 59,
      "repo_health_pct": 100,
      "todo_count": 47
    },
    "overall_score": 88,
    "release_ready": false,
    "blockers": ["Deployment: APP_URL must be set to production domain"]
  }
}
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Certification complete — **release ready** |
| 1 | Certification complete — **NOT release ready** |
| 2 | Could not run (missing dependency) |

## Security Checks

`checks/01-security.sh` scans for:

- `.env` exposed in `public/` directory **(CRITICAL)**
- `eval()` calls in production PHP **(HIGH)**
- `exec`, `shell_exec`, `passthru`, `system` **(HIGH)**
- `APP_DEBUG=true` with `APP_ENV=production` **(HIGH)**
- Raw SQL with string-concatenated variables **(HIGH)**
- `dd()`, `dump()`, `var_dump()` in production code **(MEDIUM)**
- Unescaped Blade `{!! ... !!}` with request input **(MEDIUM)**
- npm / composer audit findings **(HIGH)**

## GitHub Actions Integration

```yaml
- name: ECOS Engineering Certification
  run: bash engineering/certification/certification.sh --no-deploy --fast
  # Fast mode for PRs; full certification runs on main branch only

- name: Upload certification report
  uses: actions/upload-artifact@v4
  with:
    name: ecos-cert-${{ github.sha }}
    path: engineering/certification/reports/cert-*.json
```
