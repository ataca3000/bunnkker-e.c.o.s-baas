<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Application\Events\Inbound\LoadingProductLoadedEvent;
use Modules\Operations\Preparation\Domain\Enums\PoolMovementType;
use Throwable;

/**
 * When Loading OS physically loads units onto a vehicle,
 * increment quantity_loaded and decrement quantity_reserved on the pool entry.
 *
 * INTEGRATION-DESIGN.md §7.3
 */
final class LoadingProductLoadedListener
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function handle(LoadingProductLoadedEvent $event): void
    {
        $companyId = DB::table('prepared_products_pool')
            ->where('id', $event->poolEntryId)
            ->value('company_id');

        if ($companyId && $this->flags->isDisabled('workflow.stages.preparation', $companyId)) {
            return;
        }

        try {
            DB::transaction(function () use ($event): void {
                $pool = DB::table('prepared_products_pool')
                    ->where('id', $event->poolEntryId)
                    ->lockForUpdate()
                    ->first();

                if (! $pool) {
                    Log::channel('daily')->warning('[Preparation] LoadingProductLoadedListener: pool entry not found', [
                        'pool_entry_id' => $event->poolEntryId,
                    ]);

                    return;
                }

                DB::table('prepared_products_pool')
                    ->where('id', $event->poolEntryId)
                    ->update([
                        'quantity_reserved' => max(0, $pool->quantity_reserved - $event->quantityLoaded),
                        'quantity_loaded' => $pool->quantity_loaded + $event->quantityLoaded,
                        'updated_at' => now(),
                    ]);

                DB::table('prepared_pool_movements')->insert([
                    'id' => Str::ulid()->toString(),
                    'prepared_pool_id' => $event->poolEntryId,
                    'movement_type' => PoolMovementType::Loaded->value,
                    'quantity' => $event->quantityLoaded,
                    'reference_type' => 'vehicle',
                    'reference_id' => $event->vehicleId,
                    'performed_by_type' => 'system',
                    'performed_by_id' => null,
                    'notes' => 'Loaded onto vehicle',
                    'recorded_at' => now(),
                ]);
            });
        } catch (Throwable $e) {
            Log::channel('daily')->error('[Preparation] LoadingProductLoadedListener failed', [
                'pool_entry_id' => $event->poolEntryId,
                'product_id' => $event->productId,
                'qty_loaded' => $event->quantityLoaded,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
