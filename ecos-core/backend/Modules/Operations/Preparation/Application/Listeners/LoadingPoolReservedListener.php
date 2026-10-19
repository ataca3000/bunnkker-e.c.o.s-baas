<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Application\Events\Inbound\LoadingPoolReservedEvent;
use Modules\Operations\Preparation\Domain\Enums\PoolMovementType;
use Throwable;

/**
 * When Loading OS reserves units from the Prepared Products Pool,
 * increment quantity_reserved and append a PoolMovement record.
 *
 * INTEGRATION-DESIGN.md §7.3
 */
final class LoadingPoolReservedListener
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function handle(LoadingPoolReservedEvent $event): void
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
                    Log::channel('daily')->warning('[Preparation] LoadingPoolReservedListener: pool entry not found', [
                        'pool_entry_id' => $event->poolEntryId,
                    ]);

                    return;
                }

                DB::table('prepared_products_pool')
                    ->where('id', $event->poolEntryId)
                    ->update([
                        'quantity_reserved' => $pool->quantity_reserved + $event->quantityReserved,
                        'quantity_available' => max(0, $pool->quantity_available - $event->quantityReserved),
                        'updated_at' => now(),
                    ]);

                DB::table('prepared_pool_movements')->insert([
                    'id' => Str::ulid()->toString(),
                    'prepared_pool_id' => $event->poolEntryId,
                    'movement_type' => PoolMovementType::Reserved->value,
                    'quantity' => $event->quantityReserved,
                    'reference_type' => 'loading_wave',
                    'reference_id' => $event->loadingWaveId,
                    'performed_by_type' => 'system',
                    'performed_by_id' => null,
                    'notes' => 'Reserved by Loading Wave',
                    'recorded_at' => now(),
                ]);
            });
        } catch (Throwable $e) {
            Log::channel('daily')->error('[Preparation] LoadingPoolReservedListener failed', [
                'pool_entry_id' => $event->poolEntryId,
                'product_id' => $event->productId,
                'qty_reserved' => $event->quantityReserved,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
