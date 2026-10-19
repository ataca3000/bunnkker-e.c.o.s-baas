# Folder Conventions

How directories are organized in ECOS ERP and where new code belongs. See also
[NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md) and
[CODING-STANDARDS.md](CODING-STANDARDS.md).

---

## 1. Top-level layout

```
ECOS-ERP/
├── backend/     # Laravel 12 application (PHP 8.4)
├── frontend/    # React + TypeScript + Vite SPA
├── docker/      # Container build context & service configs
├── docs/        # Documentation (architecture / engineering / api / database)
├── scripts/     # Bootstrap & utility scripts
└── .github/     # CI/CD workflows
```

## 2. Backend (`backend/app`)

Shared, app-wide building blocks live under `app/`; bounded contexts live under
`backend/Modules/`.

| Folder         | Namespace        | Holds |
| -------------- | ---------------- | ----- |
| `Core/`        | `App\Core`       | Framework-agnostic domain primitives |
| `Shared/`      | `App\Shared`     | Shared kernel (cross-module VOs/contracts) |
| `Support/`     | `App\Support`    | Technical utilities / framework glue |
| `Enums/`       | `App\Enums`      | App-wide backed enums |
| `Exceptions/`  | `App\Exceptions` | Custom exception types |
| `Contracts/`   | `App\Contracts`  | App-wide interfaces (ports) |
| `Traits/`      | `App\Traits`     | Reusable behavior traits |
| `Helpers/`     | `App\Helpers`    | Stateless helper classes |
| `Http/`, `Models/`, `Providers/` | `App\…` | Standard Laravel folders (unchanged) |

### Module layout (`backend/Modules/{Module}`)

```
{Module}/
├── Domain/          # entities, value objects, domain services, events
├── Application/     # use cases, commands, queries, ports (interfaces)
├── Infrastructure/  # Eloquent models, repositories, adapters
└── Presentation/    # controllers, requests, resources, routes
```

**Rules**
- A module may depend on `App\Core` / `App\Shared`, never on another module's
  internals. Cross-module communication is via `Shared` contracts or events.
- Dependency direction is always inward: Presentation → Application → Domain.
- One class per file; folder reflects namespace (PSR-4).

## 3. Tests (`backend/tests`)

| Folder           | Purpose |
| ---------------- | ------- |
| `Unit/`          | Pure unit tests (no framework boot) |
| `Feature/`       | HTTP/feature tests through the framework |
| `Architecture/`  | Fitness functions enforcing module/layer boundaries |

Test classes end in `Test` and mirror the namespace of the code under test.

## 4. Frontend (`frontend/src`)

Recommended structure as the app grows (created on demand, not preemptively):

```
src/
├── assets/        # static assets
├── components/    # reusable presentational components
├── features/      # feature-scoped modules (mirror backend modules)
├── hooks/         # custom React hooks (use*)
├── lib/           # framework-agnostic utilities / API clients
├── types/         # shared TypeScript types
├── App.tsx
└── main.tsx
```

- Folder names: `kebab-case` or feature noun. Component files: `PascalCase.tsx`.
- Co-locate a component with its styles/tests where practical.

## 5. Documentation (`docs/`)

| Folder          | Contains |
| --------------- | -------- |
| `architecture/` | System & software architecture, ADRs |
| `engineering/`  | Standards, conventions, milestone reports |
| `api/`          | API contracts / OpenAPI |
| `database/`     | Schema, ERDs, migration notes |

Markdown filenames use `UPPER-KEBAB-CASE.md`; each folder has a `README.md`
index.

## 6. General rules

- New empty directories include a `README.md` describing their purpose (so they
  are tracked and self-documenting).
- Keep folders shallow and intention-revealing; avoid `misc/`, `common/`, or
  `utils/` dumping grounds — prefer `Support/`, `Shared/`, or a specific module.
