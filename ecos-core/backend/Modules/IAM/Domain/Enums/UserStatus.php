<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Enums;

/**
 * User lifecycle status (TASK-IAM-004 / ADR-040). Every transition is validated against
 * the allowed-transitions map and audited by UserLifecycleService.
 */
enum UserStatus: string
{
    case DRAFT = 'draft';
    case INVITED = 'invited';
    case PENDING_ACTIVATION = 'pending_activation';
    case ACTIVE = 'active';
    case INACTIVE = 'inactive';
    case SUSPENDED = 'suspended';
    case LOCKED = 'locked';
    case ARCHIVED = 'archived';
    case DELETED = 'deleted';

    public function label(): string
    {
        return match ($this) {
            self::DRAFT => 'Draft',
            self::INVITED => 'Invited',
            self::PENDING_ACTIVATION => 'Pending Activation',
            self::ACTIVE => 'Active',
            self::INACTIVE => 'Inactive',
            self::SUSPENDED => 'Suspended',
            self::LOCKED => 'Locked',
            self::ARCHIVED => 'Archived',
            self::DELETED => 'Deleted',
        };
    }

    /** Can this user authenticate right now? */
    public function canAuthenticate(): bool
    {
        return $this === self::ACTIVE;
    }

    /** Statuses this status may transition to. */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::DRAFT => [self::INVITED, self::ACTIVE, self::ARCHIVED, self::DELETED],
            self::INVITED => [self::PENDING_ACTIVATION, self::ACTIVE, self::SUSPENDED, self::ARCHIVED, self::DELETED],
            self::PENDING_ACTIVATION => [self::ACTIVE, self::SUSPENDED, self::ARCHIVED, self::DELETED],
            self::ACTIVE => [self::INACTIVE, self::SUSPENDED, self::LOCKED, self::ARCHIVED, self::DELETED],
            self::INACTIVE => [self::ACTIVE, self::SUSPENDED, self::ARCHIVED, self::DELETED],
            self::SUSPENDED => [self::ACTIVE, self::INACTIVE, self::ARCHIVED, self::DELETED],
            self::LOCKED => [self::ACTIVE, self::SUSPENDED, self::ARCHIVED, self::DELETED],
            self::ARCHIVED => [self::ACTIVE, self::DELETED],
            self::DELETED => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    /** Deactivating actions a user must never perform on their own account. */
    public function isDeactivating(): bool
    {
        return in_array($this, [self::INACTIVE, self::SUSPENDED, self::LOCKED, self::ARCHIVED, self::DELETED], true);
    }
}
