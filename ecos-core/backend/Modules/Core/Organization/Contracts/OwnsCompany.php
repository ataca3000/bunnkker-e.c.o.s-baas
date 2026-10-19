<?php

declare(strict_types=1);

namespace Modules\Core\Organization\Contracts;

/**
 * Marker interface for domain models that are scoped to a Company.
 *
 * Any model that carries a `company_id` foreign key should implement this
 * interface. The contract enables:
 *
 *  - The scoped RBAC system (ADR-006 §5) to query "which company does this
 *    record belong to?" without knowing the concrete model class.
 *  - Future global query scopes to filter records to the authenticated user's
 *    allowed companies without per-model conditional logic.
 *  - PHPStan to verify that any code path exercising `getCompanyId()` is only
 *    called on models that actually carry the column.
 *
 * ## When to implement
 *
 *  - Implement as soon as a `company_id` column is added to the model's table.
 *  - Do NOT add the interface before the column exists — it would produce a
 *    null return value that callers cannot distinguish from "intentionally
 *    unscoped".
 *
 * ## Migration roadmap
 *
 * See ADR-007 for the phased list of all models that will implement this
 * interface as scope columns are added.
 */
interface OwnsCompany
{
    /**
     * Return the UUID of the company this record belongs to.
     *
     * Returns null only when the model has not yet been assigned to a company
     * (e.g., a freshly created record before the scope column is populated).
     * Models where the column is non-nullable at the database level should
     * always return a non-null value here.
     */
    public function getCompanyId(): ?string;
}
