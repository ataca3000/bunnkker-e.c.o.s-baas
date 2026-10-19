# Exceptions

**Namespace:** `App\Exceptions`

Custom application/domain exception types shared across the codebase.

**Convention:** `PascalCase` ending in `Exception` (e.g. `InvalidStateException`,
`ResourceNotFoundException`). Throw specific exceptions over generic ones; map
them to HTTP responses in the framework layer, not in the domain.

_Placeholder — no exceptions implemented yet (engineering foundation, no business logic)._
