<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Application\Actions;

use DomainException;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Application\DTOs\RecalculateWaveDTO;
use Modules\Operations\Preparation\Domain\Enums\WaveStatus;
use Modules\Operations\Preparation\Domain\Exceptions\OrderAlreadyInWaveException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveOrder;

final class RecalculateWaveAction
{
    public function __construct(
        private readonly GenerateDemandAction $generateDemand,
    ) {}

    public function execute(PreparationWave $wave, RecalculateWaveDTO $dto): PreparationWave
    {
        $allowedStatuses = [WaveStatus::Draft, WaveStatus::Planning];

        if (! in_array($wave->status, $allowedStatuses, true)) {
            throw new DomainException(
                "Cannot recalculate wave in [{$wave->status->value}] status.",
            );
        }

        return DB::transaction(function () use ($wave, $dto): PreparationWave {
            // P1C — Order Exclusivity: check any newly-added orders aren't already in another wave.
            if (! empty($dto->addOrderLines)) {
                $newOrderIds = array_column($dto->addOrderLines, 'order_id');
                $conflicts = PreparationWaveOrder::where('company_id', $wave->company_id)
                    ->where('preparation_wave_id', '!=', $wave->id)
                    ->whereIn('order_id', $newOrderIds)
                    ->pluck('order_id')
                    ->all();

                if (! empty($conflicts)) {
                    throw new OrderAlreadyInWaveException($conflicts);
                }
            }

            foreach ($dto->removeOrderIds as $orderId) {
                PreparationWaveOrder::where('preparation_wave_id', $wave->id)
                    ->where('order_id', $orderId)
                    ->delete();
            }

            foreach ($dto->addOrderLines as $line) {
                PreparationWaveOrder::firstOrCreate(
                    ['preparation_wave_id' => $wave->id, 'order_id' => $line['order_id']],
                    [
                        'company_id' => $wave->company_id,
                        'order_number' => $line['order_number'],
                        'order_confirmed_at' => $line['confirmed_at'],
                        'customer_name_snapshot' => isset($line['customer_name'])
                            ? encrypt($line['customer_name'])
                            : null,
                        'delivery_zone_snapshot' => $line['delivery_zone'] ?? null,
                        'added_by' => $dto->actorId,
                    ],
                );
            }

            $newOrdersCount = $wave->waveOrders()->count();

            if ($newOrdersCount === 0) {
                throw new DomainException('Wave must have at least one order after recalculation.');
            }

            $wave->update([
                'orders_count' => $newOrdersCount,
                'status' => WaveStatus::Draft->value,
                'updated_by' => $dto->actorId,
            ]);

            return $this->generateDemand->execute($wave->fresh() ?? $wave, $dto->actorId);
        });
    }
}
