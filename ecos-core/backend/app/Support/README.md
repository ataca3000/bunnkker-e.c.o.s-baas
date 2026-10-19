# Support

**Namespace:** `App\Support`

Technical **Support** utilities and framework glue — the outermost,
infrastructure-facing helpers that wire the application to Laravel and the
outside world.

Intended contents (added in later milestones, not now):

- Helper functions and traits
- Custom Artisan command base classes
- Service provider helpers / macros
- Adapters for third-party services
- Generic infrastructure utilities (mappers, serializers, ...)

> Unlike `Core` and `Shared`, code here may depend on the framework. It must
> not contain domain rules.

_No business logic yet — this is an architectural placeholder (Milestone M2)._
