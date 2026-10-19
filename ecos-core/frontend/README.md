# ECOS ERP — Frontend

The ECOS ERP web client: **React 19 · TypeScript · Vite**, styled with
**Tailwind CSS v4** and **shadcn/ui**. This package contains the scalable,
feature-based foundation that every future screen builds on. No business
features are implemented yet.

## Tech Stack

| Concern      | Library                               |
| ------------ | ------------------------------------- |
| UI runtime   | React 19                              |
| Language     | TypeScript (strict)                   |
| Build tool   | Vite 8                                |
| Styling      | Tailwind CSS v4 (`@tailwindcss/vite`) |
| Components   | shadcn/ui (Radix UI primitives)       |
| Icons        | lucide-react                          |
| Routing      | React Router                          |
| Server state | TanStack Query                        |
| Client state | Zustand                               |
| Forms        | React Hook Form + Zod                 |
| Quality      | ESLint · Prettier · TypeScript strict |

## Architecture

A **feature-based architecture** with a shared foundation:

- **Pages live inside features** (`features/<feature>/pages/`) so each domain
  area is self-contained and can grow independently.
- **Shared UI** is split into `components/ui` (shadcn/ui primitives) and
  `components/common` (composed, app-specific reusable pieces).
- **Cross-cutting concerns** are isolated: `providers` (React context),
  `store` (Zustand), `services` (data access), `lib` (utilities/config),
  `hooks`, `types`, and `router`.
- **Layouts** (`layouts/`) wrap route groups via React Router `<Outlet />`.
- **Theming**: a `ThemeProvider` toggles the `dark` class on `<html>` and
  persists the choice; light/dark/system are switchable via `ThemeToggle`.
- **Absolute imports**: the `@/*` alias maps to `src/*` (configured in
  `vite.config.ts` and `tsconfig`).

### Routes

| Path         | Layout            | Page (placeholder) |
| ------------ | ----------------- | ------------------ |
| `/`          | —                 | `HomePage`         |
| `/login`     | `AuthLayout`      | `LoginPage`        |
| `/dashboard` | `DashboardLayout` | `DashboardPage`    |

## Folder Structure

```
src/
├── app/             # application root (App: providers + router)
├── components/
│   ├── ui/          # shadcn/ui primitives (button, input, card, dialog, …)
│   └── common/      # composed reusable components (e.g. ThemeToggle)
├── features/        # feature modules, each with its own pages/
│   ├── home/pages/
│   ├── auth/pages/
│   └── dashboard/pages/
├── layouts/         # AuthLayout, DashboardLayout
├── hooks/           # reusable hooks (e.g. useTheme)
├── lib/             # cn(), env, query client
├── providers/       # ThemeProvider, QueryProvider, AppProviders
├── router/          # route definitions & path constants
├── services/        # generic data-access (http wrapper)
├── store/           # Zustand stores (UI state)
├── styles/          # global styles (entry: src/index.css)
├── types/           # shared TypeScript types
├── utils/           # generic helpers
├── index.css        # Tailwind v4 entry + theme tokens (light/dark)
└── main.tsx         # bootstrap
```

## Development Rules

1. **TypeScript strict, always.** No `any`; type props with `type`/`interface`;
   use `import type` for type-only imports.
2. **Use absolute imports** (`@/…`) — never deep relative chains (`../../../`).
3. **Feature isolation.** New screens go under `features/<feature>/`. Do not
   import one feature's internals from another; share via `components`, `lib`,
   `hooks`, or `types`.
4. **UI primitives are owned in `components/ui`** (shadcn/ui). Compose them in
   `components/common` or features — don't fork primitives per screen.
5. **State boundaries.** Server state → TanStack Query; global client/UI state →
   Zustand; local state → `useState`. Forms → React Hook Form + Zod schemas.
6. **Styling via Tailwind utility classes** and theme tokens (`bg-background`,
   `text-foreground`, …) so light/dark mode works automatically. Avoid
   hard-coded colors.
7. **Quality gate before every commit:**
   ```bash
   npm run lint          # ESLint (zero errors)
   npm run format        # Prettier
   npm run build         # tsc (strict) + vite build
   ```
8. **No business logic in the foundation.** Keep shared code generic and reusable.

## Commands

```bash
npm run dev            # start dev server (http://localhost:5173/app/)
npm run build          # type-check + production build
npm run preview        # serve the production build
npm run lint           # ESLint
npm run format         # Prettier (write)
npm run format:check   # Prettier (check)
```

## Environment Variables

Defined in `.env` (see `.env.example`); must be prefixed with `VITE_`:

| Variable        | Purpose                      |
| --------------- | ---------------------------- |
| `VITE_APP_NAME` | Application display name     |
| `VITE_APP_ENV`  | Environment label            |
| `VITE_API_URL`  | Base URL for the backend API |

Access them through `@/lib/env` (typed), never `import.meta.env` directly.
