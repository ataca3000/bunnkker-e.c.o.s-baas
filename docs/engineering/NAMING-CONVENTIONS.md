# Naming Conventions

Authoritative naming rules for ECOS ERP. See also
[CODING-STANDARDS.md](CODING-STANDARDS.md) and
[FOLDER-CONVENTIONS.md](FOLDER-CONVENTIONS.md).

---

## 1. PHP naming rules

| Element            | Case            | Rule / Example |
| ------------------ | --------------- | -------------- |
| Namespace          | `PascalCase`    | `App\Support`, `Modules\Inventory\Domain` |
| Class              | `PascalCase`, singular | `InvoiceFactory` |
| Interface          | `PascalCase` (+`Interface` suffix) | `PaymentGatewayInterface` |
| Trait              | `PascalCase` (capability) | `HasUuid` |
| Enum               | `PascalCase`, singular | `OrderStatus` |
| Enum case          | `PascalCase`    | `OrderStatus::Pending` |
| Exception          | `PascalCase` + `Exception` | `InvalidStateException` |
| Method / function  | `camelCase`, verb phrase | `calculateTotal()` |
| Property / variable| `camelCase`     | `$unitPrice` |
| Constant           | `UPPER_SNAKE_CASE` | `DEFAULT_CURRENCY` |
| Config key         | `snake_case`    | `cache.default` |

- Every file: `declare(strict_types=1);` and PSR-4 class-name == file-name.
- Booleans read as predicates: `isActive`, `hasItems`, `canShip`.

## 2. Laravel conventions

| Element        | Convention                    | Example |
| -------------- | ----------------------------- | ------- |
| Model          | `PascalCase`, **singular**    | `Product` |
| Table          | `snake_case`, **plural**      | `products` |
| Pivot table    | singular models, alphabetical | `product_warehouse` |
| Column         | `snake_case`                  | `created_at`, `unit_price` |
| Foreign key    | `{singular}_id`               | `product_id` |
| Migration file | `snake_case`, timestamped, verb | `2026_06_22_000000_create_products_table` |
| Controller     | `PascalCase` + `Controller`   | `ProductController` |
| Form Request   | `PascalCase` + `Request`      | `StoreProductRequest` |
| Resource       | `PascalCase` + `Resource`     | `ProductResource` |
| Job / Listener | `PascalCase`, verb            | `SyncInventory` |
| Event          | `PascalCase`, past tense      | `OrderPlaced` |
| Policy         | `PascalCase` + `Policy`       | `ProductPolicy` |
| Seeder/Factory | `PascalCase` + `Seeder`/`Factory` | `ProductFactory` |
| Route name     | `snake_case`, dotted          | `products.index` |

## 3. TypeScript naming rules

| Element              | Case          | Example |
| -------------------- | ------------- | ------- |
| Type / Interface     | `PascalCase`  | `UserProfile` (no `I` prefix) |
| Enum & members       | `PascalCase`  | `Status.Active` |
| Class                | `PascalCase`  | `HttpClient` |
| Variable / function  | `camelCase`   | `fetchUser()` |
| React component       | `PascalCase`  | `UserCard` |
| React hook           | `camelCase`, `use*` prefix | `useAuth` |
| Constant (module)    | `UPPER_SNAKE_CASE` | `API_BASE_URL` |
| Generic type param   | single cap / `TName` | `T`, `TProps` |
| Boolean              | predicate     | `isLoading`, `hasError` |

- Prefer `type` for unions/props, `interface` for extensible object shapes.
- Use `import type { … }` for type-only imports.

## 4. React conventions

- One component per file; file name **matches** the component (`UserCard.tsx`).
- Props type named `{Component}Props`.
- Hooks start with `use` and live in `src/hooks/` (when introduced).
- Event handlers: `handle{Event}` (`handleSubmit`); props that take handlers:
  `on{Event}` (`onSubmit`).
- CSS modules / files named after the component (`UserCard.css`).

## 5. File naming

| Context                         | Style          | Example |
| ------------------------------- | -------------- | ------- |
| PHP class file                  | `PascalCase.php` | `ProductController.php` |
| Laravel migration               | `snake_case.php` | `..._create_products_table.php` |
| Blade view                      | `kebab-case.blade.php` | `order-summary.blade.php` |
| React component / class module  | `PascalCase.tsx/.ts` | `UserCard.tsx`, `HttpClient.ts` |
| TS hook / util module           | `camelCase.ts` | `useAuth.ts`, `formatMoney.ts` |
| Config / dotfiles               | `kebab-case` / tool default | `.prettierrc.json` |
| Markdown docs                   | `UPPER-KEBAB.md` | `CODING-STANDARDS.md` |

## 6. Class naming (summary)

Singular, intention-revealing, suffix by role: `*Controller`, `*Request`,
`*Resource`, `*Service`, `*Repository`, `*Factory`, `*Seeder`, `*Policy`,
`*Exception`, `*Helper`. Avoid generic names like `Manager`, `Data`, `Util`
unless the suffix is meaningful.

## 7. Interface naming

Use the **`Interface` suffix** for ports (`InventoryRepositoryInterface`) — this
is the project default for discoverability. Role-noun interfaces (`Clock`) are
acceptable only for stable, single-method abstractions. Do **not** use a
Hungarian `I` prefix.

## 8. Enum naming

- Type name: `PascalCase`, singular, optionally suffixed (`OrderStatus`,
  `CurrencyCode`).
- Cases: `PascalCase` (`OrderStatus::Pending`, `OrderStatus::Shipped`).
- Prefer **backed enums** with explicit `string`/`int` values for persistence;
  keep backing values stable (they may be stored in the DB).
