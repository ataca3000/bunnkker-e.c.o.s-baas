# Architecture Tests

**Namespace:** `Tests\Architecture` (PSR-4 → `backend/tests/`)

Automated **architecture / fitness-function tests** that enforce the Clean
Architecture and modular-monolith boundaries so the structure cannot silently
erode over time.

Intended checks (added in later milestones, not now):

- `App\Core` must not depend on `App\Support` or any `Modules\*`
- Modules must not depend on each other's internal namespaces
- Domain layers must not import Eloquent / framework classes
- Naming conventions for use cases, controllers, and value objects

> These can be implemented with PHPUnit assertions over reflection, or with a
> dedicated tool such as Pest's architecture plugin or `phpat` (to be decided
> in M2). For now this directory is a placeholder.

_No tests yet — architectural placeholder (Milestone M2)._
