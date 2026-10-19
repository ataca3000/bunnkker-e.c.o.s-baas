<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Domain\Services;

use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Modules\Admin\Configuration\Domain\Events\BrandPolicyUpdated;
use Modules\Admin\Configuration\Domain\Events\ConfigurationChanged;
use Modules\Admin\Configuration\Domain\Models\BrandPolicy;
use Modules\Admin\Configuration\Domain\Models\ConfigCompanySetting;
use Throwable;

/**
 * Central authority for reading and writing all ERP configuration.
 *
 * Caching strategy:
 *   - Key:  config:brand:{brandId}:{group}  TTL: 1 hour
 *   - Key:  config:company:{companyId}      TTL: 1 hour
 * Invalidation: on every write.
 */
final class ConfigurationManager
{
    private const CACHE_TTL = 3600; // 1 hour

    public function __construct(private readonly ConfigAuditService $audit) {}

    // ── Brand Policy ──────────────────────────────────────────────────────────

    public function getBrandPolicy(string $brandId, string $group): array
    {
        return Cache::remember(
            "config:brand:{$brandId}:{$group}",
            self::CACHE_TTL,
            function () use ($brandId, $group): array {
                $policy = BrandPolicy::where('brand_id', $brandId)
                    ->where('policy_group', $group)
                    ->first();

                return $policy?->settings ?? BrandPolicy::defaultSettings($group);
            },
        );
    }

    public function updateBrandPolicy(
        string $brandId,
        string $companyId,
        string $group,
        array $settings,
        string $actorId,
        ?string $reason = null,
    ): BrandPolicy {
        $existing = BrandPolicy::where('brand_id', $brandId)
            ->where('policy_group', $group)
            ->first();

        $oldSettings = $existing?->settings ?? BrandPolicy::defaultSettings($group);

        if ($existing) {
            $existing->update([
                'settings' => array_merge($existing->settings, $settings),
                'version' => $existing->version + 1,
                'updated_by' => $actorId,
            ]);
            $policy = $existing->refresh();
        } else {
            $policy = BrandPolicy::create([
                'brand_id' => $brandId,
                'company_id' => $companyId,
                'policy_group' => $group,
                'settings' => array_merge(BrandPolicy::defaultSettings($group), $settings),
                'version' => 1,
                'created_by' => $actorId,
                'updated_by' => $actorId,
            ]);
        }

        Cache::forget("config:brand:{$brandId}:{$group}");

        try {
            $this->audit->record(
                companyId: $companyId,
                module: 'brand_policy',
                category: $group,
                action: $existing ? 'update' : 'create',
                oldValue: $oldSettings,
                newValue: $policy->settings,
                brandId: $brandId,
                reason: $reason,
            );
        } catch (Throwable $e) {
            // Audit is non-fatal — policy is already persisted. Log and continue.
            Log::channel('daily')->warning('[Config] Audit record failed after policy save', [
                'brand_id' => $brandId,
                'group' => $group,
                'error' => $e->getMessage(),
            ]);
        }

        BrandPolicyUpdated::dispatch($brandId, $companyId, $group, $policy->settings);

        return $policy;
    }

    // ── Company Settings ──────────────────────────────────────────────────────

    public function getCompanySettings(string $companyId, ?string $group = null): array
    {
        $cacheKey = "config:company:{$companyId}";

        $all = Cache::remember($cacheKey, self::CACHE_TTL, function () use ($companyId): array {
            return ConfigCompanySetting::where('company_id', $companyId)
                ->get()
                ->groupBy('setting_group')
                ->map(fn ($rows) => $rows->pluck('setting_value', 'setting_key'))
                ->toArray();
        });

        return $group ? ($all[$group] ?? []) : $all;
    }

    public function setCompanySetting(
        string $companyId,
        string $group,
        string $key,
        mixed $value,
        ?string $reason = null,
    ): void {
        $existing = ConfigCompanySetting::where('company_id', $companyId)
            ->where('setting_key', $key)
            ->first();

        $oldValue = $existing?->setting_value;

        if ($existing) {
            $existing->update([
                'setting_value' => $value,
                'version' => $existing->version + 1,
            ]);
        } else {
            ConfigCompanySetting::create([
                'company_id' => $companyId,
                'setting_group' => $group,
                'setting_key' => $key,
                'setting_value' => $value,
            ]);
        }

        Cache::forget("config:company:{$companyId}");

        $this->audit->record(
            companyId: $companyId,
            module: 'company_setting',
            category: $group,
            action: $existing ? 'update' : 'create',
            oldValue: $oldValue,
            newValue: $value,
            configKey: $key,
            reason: $reason,
        );

        ConfigurationChanged::dispatch($companyId, 'company_setting', $group, $key);
    }

    public function invalidateBrandCache(string $brandId, ?string $group = null): void
    {
        if ($group) {
            Cache::forget("config:brand:{$brandId}:{$group}");
        } else {
            foreach (BrandPolicy::POLICY_GROUPS as $g) {
                Cache::forget("config:brand:{$brandId}:{$g}");
            }
        }
    }
}
