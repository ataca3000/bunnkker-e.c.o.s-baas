<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use App\Core\Audit\AuditService;
use App\Models\User;
use Illuminate\Support\Facades\Auth;

/**
 * Thin, user-management-specific facade over the generic App\Core\Audit\AuditService
 * (ADR-040, Decision 4). Records every lifecycle/identity/role/org event against
 * entity_type = 'user'. Never throws (the underlying service swallows failures).
 */
class UserAuditService
{
    public const ENTITY = 'user';

    public function __construct(private readonly AuditService $audit) {}

    /**
     * @param  array<string,mixed>  $old
     * @param  array<string,mixed>  $new
     * @param  array<string,mixed>  $metadata
     */
    public function log(string $action, User $user, array $old = [], array $new = [], array $metadata = []): void
    {
        $this->audit->record(
            action: 'user.'.$action,
            entityType: self::ENTITY,
            entityId: (string) $user->getKey(),
            companyId: is_string($user->company_id) ? $user->company_id : null,
            userId: Auth::id(),
            oldValues: $old,
            newValues: $new,
            metadata: $metadata,
        );
    }
}
