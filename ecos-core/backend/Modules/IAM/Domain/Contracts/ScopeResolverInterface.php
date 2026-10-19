<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use App\Models\User;
use Modules\IAM\Domain\ValueObjects\ScopeConstraint;

/**
 * ScopeResolverInterface — the Data Scope Engine (TASK-IAM-002 / ADR-038, Part 3).
 *
 * Turns a user + resource into a declarative ScopeConstraint. Business modules never
 * filter data by hand; they apply the constraint via the `scopedTo()` query macro.
 */
interface ScopeResolverInterface
{
    /**
     * Resolve the widest data scope the user holds for the resource and return the
     * constraint that narrows a query to it. ALL → unrestricted; unresolved → deny.
     *
     * @param  string  $resource  e.g. "sales.orders"
     * @param  string|null  $ownerColumn  the column that carries the record owner for SELF (default: created_by)
     */
    public function resolve(User $user, string $resource, ?string $ownerColumn = null): ScopeConstraint;
}
