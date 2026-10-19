<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Application\Listeners;

use Illuminate\Support\Facades\Log;
use Modules\Admin\Configuration\Domain\Events\BrandPolicyUpdated;
use Modules\Organization\Brands\Domain\Models\Brand;
use Throwable;

/**
 * Keeps brands.default_target_margin in sync whenever the pricing policy
 * changes in Configuration OS. Config OS is the canonical source of truth;
 * the brands column is a read-only projection used by the Pricing Engine.
 */
final class BrandPolicyUpdatedListener
{
    public function handle(BrandPolicyUpdated $event): void
    {
        if ($event->policyGroup !== 'pricing') {
            return;
        }

        if (! isset($event->settings['minimum_margin_pct'])) {
            return;
        }

        try {
            Brand::where('id', $event->brandId)
                ->update(['default_target_margin' => (float) $event->settings['minimum_margin_pct']]);
        } catch (Throwable $e) {
            Log::channel('daily')->warning('[Config] Failed to sync minimum_margin_pct to brands table', [
                'brand_id' => $event->brandId,
                'value' => $event->settings['minimum_margin_pct'],
                'error' => $e->getMessage(),
            ]);
        }
    }
}
