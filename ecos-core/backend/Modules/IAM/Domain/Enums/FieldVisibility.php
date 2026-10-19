<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Enums;

/**
 * FieldVisibility — the visibility state of a single field/column/widget
 * (TASK-IAM-002 / ADR-038, Part 2).
 *
 * The Visibility Engine is independent from Authorization: a user may open a screen
 * (authorized) while individual sensitive fields are HIDDEN or READ_ONLY.
 */
enum FieldVisibility: string
{
    case VISIBLE = 'visible';
    case READ_ONLY = 'read_only';
    case HIDDEN = 'hidden';

    public function isVisible(): bool
    {
        return $this !== self::HIDDEN;
    }

    public function isHidden(): bool
    {
        return $this === self::HIDDEN;
    }

    public function isEditable(): bool
    {
        return $this === self::VISIBLE;
    }
}
