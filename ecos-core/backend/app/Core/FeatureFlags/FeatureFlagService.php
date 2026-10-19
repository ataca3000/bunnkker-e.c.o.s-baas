<?php

declare(strict_types=1);

namespace App\Core\FeatureFlags;

use Illuminate\Support\Facades\Cache;

final class FeatureFlagService
{
    private const TTL = 300;

    /**
     * Check if a feature flag is enabled.
     * Company-specific flags take precedence over global flags.
     */
    public function isEnabled(string $key, ?string $companyId = null): bool
    {
        $cacheKey = "feature_flag.{$key}.".($companyId ?? 'global');

        return (bool) Cache::remember($cacheKey, self::TTL, function () use ($key, $companyId): bool {
            // Company-specific override takes precedence
            if ($companyId !== null) {
                $companyFlag = FeatureFlag::where('key', $key)
                    ->where('company_id', $companyId)
                    ->first();

                if ($companyFlag !== null) {
                    return $companyFlag->enabled;
                }
            }

            // Global flag (company_id = null)
            $globalFlag = FeatureFlag::where('key', $key)
                ->whereNull('company_id')
                ->first();

            return $globalFlag?->enabled ?? false;
        });
    }

    public function isDisabled(string $key, ?string $companyId = null): bool
    {
        return ! $this->isEnabled($key, $companyId);
    }

    public function enable(string $key, ?string $companyId = null): void
    {
        $this->set($key, true, $companyId);
    }

    public function disable(string $key, ?string $companyId = null): void
    {
        $this->set($key, false, $companyId);
    }

    private function set(string $key, bool $enabled, ?string $companyId): void
    {
        FeatureFlag::updateOrCreate(
            ['key' => $key, 'company_id' => $companyId],
            ['enabled' => $enabled],
        );

        Cache::forget("feature_flag.{$key}.".($companyId ?? 'global'));
    }
}
