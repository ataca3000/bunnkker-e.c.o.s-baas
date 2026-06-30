# Next.js Stealth RBAC Login (Role-Based Access Control)

A plug-and-play boilerplate for a "Camouflaged Login" that intelligently routes users based on their server-side role without exposing admin routes.

## The Problem
Most apps have separate login pages (`/admin/login`, `/employee/login`). This exposes your backend structure to hackers. 

## The Solution: Stealth Login
This boilerplate provides a single `/login` page that looks like a standard customer login. However, upon authentication, the server evaluates the user's role (RBAC) and silently redirects them:
- `SuperAdmin` -> `/dashboard`
- `Employee` -> `/pos`
- `Customer` -> `/home`

## How it works
1. **`src/app/login/page.tsx`**: The innocent-looking front-end login page.
2. **`src/app/api/auth/route.ts`**: The secure backend route that checks the database for the user's role and returns the correct redirect URL.

## License
MIT - Created by Brecha Soluciones S.A. de C.V.
