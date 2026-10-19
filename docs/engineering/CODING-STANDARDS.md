# Coding Standards

Engineering standards for the ECOS ERP codebase. These are enforced by tooling
(Laravel Pint, PHPStan, ESLint, Prettier, TypeScript) and reviewed in PRs.

See also: [NAMING-CONVENTIONS.md](NAMING-CONVENTIONS.md) ·
[FOLDER-CONVENTIONS.md](FOLDER-CONVENTIONS.md).

---

## 1. General principles

- **Clean Architecture first.** Dependencies point inward (Presentation →
  Application → Domain). Infrastructure implements ports; the domain never
  depends on the framework.
- **Single Responsibility.** One reason to change per class/function.
- **Explicit over implicit.** Type everything; avoid magic and hidden globals.
- **No business logic in this foundation phase.** Structure and standards only.
- **Fail loud.** Throw specific exceptions; never silently swallow errors.

---

## 2. PHP / Laravel

- **Standard:** PSR-12, enforced by **Laravel Pint** (`backend/pint.json`,
  `laravel` preset). Run `composer exec pint` (or `./vendor/bin/pint`).
- **Static analysis:** **PHPStan** (`backend/phpstan.neon.dist`).
- **Strict types:** every PHP file starts with `declare(strict_types=1);`.
- **Type declarations:** always declare parameter, return, and property types.
  Use union/nullable types instead of `mixed` where possible.
- **Imports:** one class per `use`; no unused imports (Pint
  `ordered_imports` + `no_unused_imports`). Reference classes by short name,
  not fully-qualified, in bodies.
- **Visibility:** explicit on every method/property. Prefer `private`/`final`
  by default; widen only when needed.
- **Constructor property promotion** for dependencies.
- **No facades in domain/application code** — inject dependencies.
- **Comments:** explain *why*, not *what*. Public API gets docblocks only when
  they add information beyond the signature.

```php
<?php

declare(strict_types=1);

namespace App\Support;

final class MoneyFormatter
{
    public function __construct(private readonly string $currency) {}

    public function format(int $minorUnits): string
    {
        return number_format($minorUnits / 100, 2) . ' ' . $this->currency;
    }
}
```

---

## 3. TypeScript / React

- **Standard:** ESLint (`frontend/eslint.config.js`, flat config) + **Prettier**
  (`frontend/.prettierrc.json`) for formatting.
- **TypeScript strict mode is mandatory** (`strict: true`). No implicit `any`;
  no non-null assertions (`!`) without justification.
- **Components:** function components only, typed props via `type`/`interface`.
- **Hooks:** follow the Rules of Hooks (enforced by `eslint-plugin-react-hooks`).
- **Imports:** use `import type` for type-only imports
  (`verbatimModuleSyntax` is on).
- **No unused** locals/parameters (compiler-enforced).
- **Side-effect-free modules**; keep components pure and presentational where
  possible.

```tsx
type GreetingProps = {
  name: string;
};

export function Greeting({ name }: GreetingProps) {
  return <h1>Hello, {name}</h1>;
}
```

---

## 4. Formatting (both stacks)

| Setting        | Value                          |
| -------------- | ------------------------------ |
| Indentation    | 4 spaces (PHP), 2 spaces (TS/JS/JSON/YAML/MD) |
| Line endings   | LF                             |
| Charset        | UTF-8                          |
| Final newline  | required                       |
| Trailing WS    | trimmed (except Markdown)      |

Defined centrally in [`/.editorconfig`](../../.editorconfig) and honored by Pint
and Prettier.

---

## 5. Git & commits

- **Conventional Commits**: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`,
  `test:`, `build:`, `ci:`.
- One logical change per commit; keep PRs focused.
- All quality gates (tests, Pint, PHPStan, ESLint, TypeScript build) must pass
  before merge.

---

## 6. Quality gate commands

```bash
# PHP
docker compose exec app ./vendor/bin/pint --test    # format check
docker compose exec app php artisan test            # tests
# (PHPStan once installed: docker compose exec app ./vendor/bin/phpstan analyse)

# Frontend
cd frontend
npm run lint        # ESLint
npm run format:check # Prettier check
npm run build       # tsc (strict) + vite build
```
