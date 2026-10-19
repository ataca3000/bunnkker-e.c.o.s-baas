<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\ValueObjects;

use Illuminate\Contracts\Database\Query\Builder;
use Modules\IAM\Domain\Enums\DataScope;

/**
 * ScopeConstraint — an immutable, declarative description of how a query must be
 * narrowed for a user (TASK-IAM-002 / ADR-038, Part 3).
 *
 * It is NOT raw SQL. The Data Scope Engine returns a ScopeConstraint; the
 * `scopedTo()` query macro applies it. Three shapes:
 *   • unrestricted  → ALL scope, apply no filter (backward compatible default)
 *   • impossible    → deny-by-default when scope cannot be resolved → WHERE 1 = 0
 *   • column filter → WHERE {column} IN ({values})  (optionally OR {column} IS NULL)
 */
final class ScopeConstraint
{
    /**
     * @param  list<int|string>  $values
     */
    private function __construct(
        public readonly DataScope $scope,
        public readonly bool $unrestricted,
        public readonly bool $impossible,
        public readonly ?string $column,
        public readonly array $values,
        public readonly bool $orNull,
    ) {
    }

    public static function unrestricted(DataScope $scope = DataScope::ALL): self
    {
        return new self($scope, true, false, null, [], false);
    }

    /**
     * Deny by default — the query must return nothing.
     */
    public static function none(DataScope $scope): self
    {
        return new self($scope, false, true, null, [], false);
    }

    /**
     * @param  list<int|string>|int|string|null  $values
     */
    public static function where(DataScope $scope, string $column, array|int|string|null $values, bool $orNull = false): self
    {
        $list = is_array($values) ? array_values($values) : ($values === null ? [] : [$values]);

        // No values to match on = nothing is in scope → deny by default.
        if ($list === [] && ! $orNull) {
            return self::none($scope);
        }

        return new self($scope, false, false, $column, $list, $orNull);
    }

    /**
     * Apply this constraint to an Eloquent/Query builder.
     *
     * @template TBuilder of Builder
     *
     * @param  TBuilder  $query
     * @return TBuilder
     */
    public function applyTo(Builder $query): Builder
    {
        if ($this->unrestricted) {
            return $query;
        }

        if ($this->impossible) {
            return $query->whereRaw('1 = 0');
        }

        $column = (string) $this->column;

        return $query->where(function (Builder $q) use ($column): void {
            $q->whereIn($column, $this->values);

            if ($this->orNull) {
                $q->orWhereNull($column);
            }
        });
    }

    public function isUnrestricted(): bool
    {
        return $this->unrestricted;
    }

    public function isImpossible(): bool
    {
        return $this->impossible;
    }
}
