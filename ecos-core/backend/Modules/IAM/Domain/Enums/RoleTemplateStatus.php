<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Enums;

/**
 * Lifecycle status of a Role Template (TASK-IAM-003 / ADR-039).
 * draft → published → deprecated → archived. Historical versions are never overwritten.
 */
enum RoleTemplateStatus: string
{
    case DRAFT = 'draft';
    case PUBLISHED = 'published';
    case DEPRECATED = 'deprecated';
    case ARCHIVED = 'archived';

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Draft',
            self::PUBLISHED => 'Published',
            self::DEPRECATED => 'Deprecated',
            self::ARCHIVED => 'Archived',
        };
    }

    /** Assignable to users only while published. */
    public function isAssignable(): bool
    {
        return $this === self::PUBLISHED;
    }

    /** Draft is the only freely editable state (system templates are immutable regardless). */
    public function isEditable(): bool
    {
        return $this === self::DRAFT;
    }
}
