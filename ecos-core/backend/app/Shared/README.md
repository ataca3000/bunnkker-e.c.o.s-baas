# Shared

**Namespace:** `App\Shared`

The **Shared Kernel** — concepts deliberately shared across multiple modules:
shared value objects, common DTOs, cross-module contracts, and integration
events that more than one bounded context agrees on.

Intended contents (added in later milestones, not now):

- Shared value objects (Money, Email, PhoneNumber, ...)
- Cross-module contracts / interfaces
- Integration event definitions
- Common enums used by several modules

> Keep this small and stable. Anything placed here becomes a coupling point
> between modules, so it changes rarely and by agreement.

_No business logic yet — this is an architectural placeholder (Milestone M2)._
