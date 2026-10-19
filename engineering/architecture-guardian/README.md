# ECOS Architecture Guardian

Scans the repository for architectural health issues and generates a complete
Repository Health Report.

## Usage

```bash
# Run all scanners
bash engineering/architecture-guardian/architecture-guardian.sh

# Run specific scanners
bash engineering/architecture-guardian/architecture-guardian.sh 02-translations 03-adr
```

## Scanners

| ID | Name | Detects |
|----|------|---------|
| 01-repository | Repository Scanner | Dead files, dead components, dead hooks, dead services |
| 02-translations | Translation Validator | Missing locale files, missing keys, empty values |
| 03-adr | ADR Validator | DDD layer violations, feature structure violations, HTTP anti-patterns |
| 04-namespaces | Namespace Validator | PSR-4 mismatches (PHP), import alias violations (TS) |
| 05-dependencies | Dependency Scanner | Circular dependencies (frontend + backend) |
| 06-duplicates | Duplicate Logic Detector | Copy-pasted files, duplicated function names |

## Severity Levels

| Level | Meaning |
|-------|---------|
| CRITICAL | Breaks builds or correctness — fix before merging |
| HIGH | Architecture violation — fix this sprint |
| MEDIUM | Technical debt — schedule for backlog |
| LOW | Informational — address when convenient |

## Output

- **Console:** live summary with finding details
- **Report:** `engineering/architecture-guardian/reports/health-report-YYYYMMDD-HHMMSS.md`

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Scan complete, no CRITICAL findings |
| 1 | Scan complete, CRITICAL findings present |
