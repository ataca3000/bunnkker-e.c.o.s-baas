# Modules

**Namespace:** `Modules\{ModuleName}` (PSR-4 → `backend/Modules/`)

The **bounded contexts** of the ECOS ERP modular monolith. Each ERP capability
(Inventory, Sales, Purchasing, Accounting, HR, ...) becomes a self-contained
module with its own Clean Architecture layers.

Recommended per-module layout (created when a module is actually built):

```
Modules/
└── {ModuleName}/
    ├── Domain/            # entities, value objects, domain services, events
    ├── Application/       # use cases, commands, queries, ports (interfaces)
    ├── Infrastructure/    # Eloquent models, repositories, external adapters
    └── Presentation/      # controllers, requests, resources, routes
```

**Rules**
- A module may depend on `App\Core` and `App\Shared`, never on another module's
  internals — cross-module communication goes through `Shared` contracts or
  domain events.
- The dependency direction is always inward: Presentation → Application → Domain.

_No modules implemented yet — this is the architectural container (Milestone M2)._
