<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Services;

use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Models\ConfigAuditEntry;

/**
 * Records immutable audit entries for every configuration change.
 * No anonymous changes — actor is always stamped.
 */
final class ConfigAuditService
{
    public function record(
        string $companyId,
        string $module,
        string $category,
        string $action,
        mixed $oldValue,
        mixed $newValue,
        ?string $brandId = null,
        ?string $configKey = null,
        ?string $reason = null,
    ): ConfigAuditEntry {
        $user = Auth::user();

        return ConfigAuditEntry::create([
            'company_id' => $companyId,
            'brand_id' => $brandId,
            'module' => $module,
            'category' => $category,
            'config_key' => $configKey,
            'old_value' => $oldValue !== null ? (is_array($oldValue) ? $oldValue : ['value' => $oldValue]) : null,
            'new_value' => $newValue !== null ? (is_array($newValue) ? $newValue : ['value' => $newValue]) : null,
            'action' => $action,
            'actor_id' => $user?->id,
            'actor_name' => $user?->name,
            'reason' => $reason,
            'occurred_at' => now(),
        ]);
    }

    public function getLog(string $companyId, ?string $brandId = null, int $limit = 50): \Illuminate\Database\Eloquent\Collection
    {
        return ConfigAuditEntry::query()
            ->where('company_id', $companyId)
            ->when($brandId !== null, fn ($q) => $q->where('brand_id', $brandId))
            ->orderByDesc('occurred_at')
            ->limit($limit)
            ->get();
    }
}
