<?php

declare(strict_types=1);

namespace App\Core\Audit;

use Illuminate\Support\Str;
use Throwable;

final class AuditService
{
    /**
     * Record a business action for the audit trail.
     *
     * @param  array<string, mixed>  $oldValues
     * @param  array<string, mixed>  $newValues
     * @param  array<string, mixed>  $metadata
     */
    public function record(
        string $action,
        string $entityType,
        string $entityId,
        ?string $companyId = null,
        ?int $userId = null,
        array $oldValues = [],
        array $newValues = [],
        array $metadata = [],
        ?string $configVersion = null,
        ?string $policyVersion = null,
    ): void {
        try {
            AuditLog::create([
                'id' => Str::uuid()->toString(),
                'company_id' => $companyId,
                'user_id' => $userId,
                'action' => $action,
                'entity_type' => $entityType,
                'entity_id' => $entityId,
                'old_values' => $oldValues ?: null,
                'new_values' => $newValues ?: null,
                'metadata' => $metadata ?: null,
                'ip_address' => request()?->ip(),
                'user_agent' => request()?->userAgent(),
                'config_version_id' => $configVersion,
                'policy_version' => $policyVersion,
                'occurred_at' => now(),
            ]);
        } catch (Throwable) {
            // Audit failures must never block business logic.
        }
    }
}
