# ADR-POS-001 — PostgreSQL as POS Database

**Status:** Accepted  
**Date:** 2026-06-30  
**Deciders:** Architecture Team

---

## Context

The POS specification document `22_IMPLEMENTATION_TASK.md` referenced MySQL as the database engine (e.g., MySQL-only JSON operator syntax). However, the ECOS ERP system uses **PostgreSQL** as its primary database engine. All existing modules — Inventory, Manufacturing, Commerce, Operations — run on PostgreSQL. The CLAUDE.md project definition explicitly lists PostgreSQL.

## Decision

Use **PostgreSQL** for all POS module database tables, queries, and migrations. Any MySQL-specific syntax from the specification documents must be translated to PostgreSQL-compatible syntax during implementation.

## Consequences

**Positive:**
- Full consistency with the rest of the ECOS ERP database.
- One engine to manage: migrations, backups, monitoring.
- Access to PostgreSQL-native features: `jsonb`, window functions, advisory locks, `ON CONFLICT DO UPDATE`.

**Negative / Watch-outs:**
- Any spec snippet containing MySQL-specific syntax (e.g., `JSON_EXTRACT`, `-> '$.'`, `ENGINE=InnoDB`) must be rewritten.
- `jsonb` replaces MySQL `JSON` columns. Queries use `->>` / `@>` operators instead of `JSON_EXTRACT`.

## Alternatives Considered

- **Keep MySQL for POS only** — rejected. Operating two database engines adds operational overhead and breaks the "one DB per monolith" principle.
