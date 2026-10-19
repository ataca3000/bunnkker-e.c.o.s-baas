<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use App\Models\User;
use Modules\IAM\Domain\Enums\FieldVisibility;

/**
 * VisibilityResolverInterface — the Information Visibility Engine
 * (TASK-IAM-002 / ADR-038, Part 2).
 *
 * Independent from authorization: decides which fields of an already-authorized
 * resource a user may see or edit, based on the field's required permission.
 */
interface VisibilityResolverInterface
{
    /**
     * The visibility state of a single field for the user.
     */
    public function fieldState(User $user, string $resource, string $field): FieldVisibility;

    /**
     * Fields that must be removed before serialisation (state HIDDEN).
     *
     * @return list<string>
     */
    public function hiddenFields(User $user, string $resource): array;
}
