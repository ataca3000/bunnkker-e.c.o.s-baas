<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Listeners;

use App\Core\FeatureFlags\FeatureFlagService;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Modules\Operations\Preparation\Application\Events\Inbound\LoadingPoolReservationReleasedEvent;
use Modules\Operations\Preparation\Domain\Enums\PoolMovementType;
use Throwable;

/**
 * When Loading OS releases a pool reservation (e.g., wave cancelled),
 * decrement quantity_reserved and restore quantity_available.
 *
 * INTEGRATION-DESIGN.md §7.3
 */
final class LoadingPoolReservationReleasedListener
{
    public function __construct(private readonly FeatureFlagService $flags) {}

    public function handle(LoadingPoolReservationReleasedEvent $event): void
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
                    Log::channel('daily')->warning('[Preparation] ReservationReleasedListener: pool entry not found', [
                        'pool_entry_id' => $event->poolEntryId,
                    ]);

                    return;
                }

                DB::table('prepared_products_pool')
                    ->where('id', $event->poolEntryId)
                    ->update([
                        'quantity_reserved' => max(0, $pool->quantity_reserved - $event->quantityReleased),
                        'quantity_available' => $pool->quantity_available + $event->quantityReleased,
                        'updated_at' => now(),
                    ]);

                DB::table('prepared_pool_movements')->insert([
                    'id' => Str::ulid()->toString(),
                    'prepared_pool_id' => $event->poolEntryId,
                    'movement_type' => PoolMovementType::ReservationReleased->value,
                    'quantity' => $event->quantityReleased,
                    'reference_type' => 'loading_wave',
                    'reference_id' => $event->loadingWaveId,
                    'performed_by_type' => 'system',
                    'performed_by_id' => null,
                    'notes' => 'Reservation released by Loading Wave',
                    'recorded_at' => now(),
                ]);
            });
        } catch (Throwable $e) {
            Log::channel('daily')->error('[Preparation] ReservationReleasedListener failed', [
                'pool_entry_id' => $event->poolEntryId,
                'product_id' => $event->productId,
                'qty_released' => $event->quantityReleased,
                'error' => $e->getMessage(),
            ]);
        }
    }
}
