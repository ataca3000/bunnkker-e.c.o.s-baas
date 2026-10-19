<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryReturnStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Events\ReturnInitiated;
use Modules\Logistics\Delivery\Domain\Events\ReturnReceived;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Delivery\Domain\Models\DeliveryReturn;
use Modules\Logistics\Delivery\Domain\Models\DeliveryReturnLine;

/**
 * Customer-facing returns.
 *
 * BR-24: a line may never return more than the customer failed to take.
 * Warehouse confirmation derives the discrepancy rather than trusting input.
 */
class DeliveryReturnService
{
    public function __construct(
        private readonly TrackingProjectionService $tracking,
    ) {}

    /**
     * @param  list<array<string, mixed>>  $lines
     * @param  array<string, mixed>  $attributes
     */
    public function initiate(
        Delivery $delivery,
        array $lines,
        array $attributes = [],
        ?DeliveryAttempt $attempt = null,
        ?int $actorId = null,
        ?string $actor = null,
    ): DeliveryReturn {
        if ($lines === []) {
            throw DeliveryException::partialDeliveryNeedsLines();
        }

        $return = DB::transaction(function () use ($delivery, $lines, $attributes, $attempt, $actorId) {
            $return = $delivery->returns()->create($attributes + [
                'attempt_id' => $attempt?->id,
                'status' => DeliveryReturnStatus::Initiated->value,
                'initiated_at' => now(),
                'initiated_by' => $actorId,
            ]);

            foreach ($lines as $line) {
                $model = new DeliveryReturnLine($line);
                $model->return_id = $return->id;

                if ($model->exceedsUndelivered()) {
                    throw DeliveryException::returnQuantityExceedsUndelivered(
                        $model->product_name ?? 'the product'
                    );
                }

                $model->save();
            }

            if ($delivery->status->canTransitionTo(DeliveryStatus::Returning)) {
                $delivery->update(['status' => DeliveryStatus::Returning->value]);
            }

            return $return->refresh();
        });

        $this->tracking->recordCustomerVisible(
            $delivery->refresh(),
            'return.initiated',
            'Return initiated',
            'Items you did not accept are being returned to our warehouse.',
            $attempt,
        );

        ReturnInitiated::dispatch($delivery->refresh(), $return, $actor);

        return $return;
    }

    public function markInTransit(DeliveryReturn $return): DeliveryReturn
    {
        $this->assertTransition($return, DeliveryReturnStatus::InTransit);

        $return->update(['status' => DeliveryReturnStatus::InTransit->value]);

        return $return->refresh();
    }

    /**
     * Warehouse receipt. Each line's discrepancy is derived from the counted
     * quantity, never supplied by the caller.
     *
     * @param  array<int, float>  $confirmedByLineId
     */
    public function receive(
        DeliveryReturn $return,
        array $confirmedByLineId = [],
        ?int $actorId = null,
        ?string $actor = null,
    ): DeliveryReturn {
        $this->assertTransition($return, DeliveryReturnStatus::Received);

        $received = DB::transaction(function () use ($return, $confirmedByLineId, $actorId) {
            foreach ($return->lines as $line) {
                if (! array_key_exists($line->id, $confirmedByLineId)) {
                    continue;
                }

                $line->warehouse_confirmed_qty = $confirmedByLineId[$line->id];
                $line->discrepancy_qty = $line->calculateDiscrepancy();
                $line->save();
            }

            $return->load('lines');

            $return->update([
                'status' => DeliveryReturnStatus::Received->value,
                'received_at' => now(),
                'received_by' => $actorId,
                'has_discrepancy' => $return->detectDiscrepancy(),
            ]);

            return $return->refresh();
        });

        ReturnReceived::dispatch($received->delivery, $received, $actor);

        return $received;
    }

    public function verify(DeliveryReturn $return, ?int $actorId = null): DeliveryReturn
    {
        $this->assertTransition($return, DeliveryReturnStatus::Verified);

        return DB::transaction(function () use ($return, $actorId) {
            $return->update([
                'status' => DeliveryReturnStatus::Verified->value,
                'verified_at' => now(),
                'verified_by' => $actorId,
            ]);

            $delivery = $return->delivery;
            if ($delivery !== null && $delivery->status->canTransitionTo(DeliveryStatus::Returned)) {
                $delivery->update(['status' => DeliveryStatus::Returned->value]);
            }

            return $return->refresh();
        });
    }

    public function flagDiscrepancy(DeliveryReturn $return, ?string $notes = null): DeliveryReturn
    {
        $this->assertTransition($return, DeliveryReturnStatus::Discrepancy);

        $return->update([
            'status' => DeliveryReturnStatus::Discrepancy->value,
            'has_discrepancy' => true,
            'notes' => $notes ?? $return->notes,
        ]);

        return $return->refresh();
    }

    private function assertTransition(DeliveryReturn $return, DeliveryReturnStatus $target): void
    {
        if (! $return->status->canTransitionTo($target)) {
            throw DeliveryException::invalidReturnTransition($return->status, $target);
        }
    }
}
