# Core

**Namespace:** `App\Core`

The enterprise **Core** layer — framework-agnostic building blocks that every
module depends on but that depend on nothing module-specific.

Intended contents (added in later milestones, not now):

- Domain primitives / base value objects
- Abstract base entities & aggregate roots
- Domain events and event contracts
- Cross-cutting interfaces (Clock, IdGenerator, etc.)
- Base exceptions for the domain layer

> Clean Architecture rule: code here must **not** reference any specific module
> under `Modules/`. Dependencies point inward, toward Core.

_No business logic yet — this is an architectural placeholder (Milestone M2)._
