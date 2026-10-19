<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Domain\Services;

use Illuminate\Support\Facades\DB;
use Modules\Logistics\Delivery\Domain\Enums\CodStatus;
use Modules\Logistics\Delivery\Domain\Events\CodCollected;
use Modules\Logistics\Delivery\Domain\Exceptions\DeliveryException;
use Modules\Logistics\Delivery\Domain\Models\CodRecord;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;

/**
 * COD completion at the door.
 *
 * ┌─ CTO DECISION 3 — DISTRIBUTION IS THE SINGLE CASH AUTHORITY ─────────────┐
 * │ This service records that money changed hands and publishes CodCollected. │
 * │ It performs NO settlement arithmetic, and writes to NO distribution_*     │
 * │ table. Distribution's SettlementService remains the sole authority for    │
 * │ trip cash balances and reconciliation.                                   │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CodCompletionService
{
    public function open(Delivery $delivery, float $amountDue, string $currency = 'EGP'): CodRecord
    {
        return DB::transaction(function () use ($delivery, $amountDue, $currency) {
            $record = CodRecord::firstOrNew(['delivery_id' => $delivery->id]);

            $record->fill([
                'delivery_id' => $delivery->id,
                'amount_due' => $amountDue,
                'currency' => $currency,
                'status' => $amountDue > 0 ? CodStatus::Due->value : CodStatus::NotApplicable->value,
            ]);
            $record->save();

            return $record->refresh();
        });
    }

    /**
     * Record collection at the door.
     *
     * @param  array<string, mixed>  $attributes
     */
    public function collect(
        CodRecord $record,
        DeliveryAttempt $attempt,
        float $amount,
        array $attributes = [],
        ?int $actorId = null,
        ?string $actor = null,
    ): CodRecord {
        if (! $record->status->canTransitionTo(CodStatus::Collected)) {
            throw DeliveryException::invalidCodTransition($record->status, CodStatus::Collected);
        }

        $collected = DB::transaction(function () use ($record, $attempt, $amount, $attributes, $actorId) {
            $record->update($attributes + [
                'attempt_id' => $attempt->id,
                'amount_collected' => $amount,
                'status' => CodStatus::Collected->value,
                'collected_at' => now(),
                'collected_by' => $actorId,
            ]);

            return $record->refresh();
        });

        // Distribution reconciles the cash; we only report the fact.
        CodCollected::dispatch($collected->delivery, $collected, $actor);

        return $collected;
    }

    public function verify(CodRecord $record, ?int $actorId = null): CodRecord
    {
        $this->assertTransition($record, CodStatus::Verified);

        return DB::transaction(function () use ($record, $actorId) {
            $record->update([
                'status' => CodStatus::Verified->value,
                'verified_at' => now(),
                'verified_by' => $actorId,
            ]);

            return $record->refresh();
        });
    }

    public function dispute(CodRecord $record, string $reason, ?int $actorId = null): CodRecord
    {
        $this->assertTransition($record, CodStatus::Disputed);

        return DB::transaction(function () use ($record, $reason, $actorId) {
            $record->update([
                'status' => CodStatus::Disputed->value,
                'dispute_reason' => $reason,
                'verified_by' => $actorId,
            ]);

            return $record->refresh();
        });
    }

    public function writeOff(CodRecord $record, string $reason, ?int $actorId = null): CodRecord
    {
        $this->assertTransition($record, CodStatus::WrittenOff);

        return DB::transaction(function () use ($record, $reason, $actorId) {
            $record->update([
                'status' => CodStatus::WrittenOff->value,
                'dispute_reason' => $reason,
                'verified_at' => now(),
                'verified_by' => $actorId,
            ]);

            return $record->refresh();
        });
    }

    private function assertTransition(CodRecord $record, CodStatus $target): void
    {
        if (! $record->status->canTransitionTo($target)) {
            throw DeliveryException::invalidCodTransition($record->status, $target);
        }
    }
}
