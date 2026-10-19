<?php

declare(strict_types=1);

namespace Modules\Logistics\Network\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Logistics\Network\Domain\Enums\CapacityCommitmentStatus;
use Modules\Logistics\Network\Domain\Enums\CapacityUnit;
use Modules\Logistics\Network\Domain\Events\CapacityCommitted;
use Modules\Logistics\Network\Domain\Events\CapacityExhausted;
use Modules\Logistics\Network\Domain\Events\CapacityReleased;
use Modules\Logistics\Network\Domain\Events\CapacityThresholdBreached;
use Modules\Logistics\Network\Domain\Exceptions\NetworkException;
use Modules\Logistics\Network\Domain\Models\CapacityCommitment;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;

/**
 * The capacity ledger — the single writer of committed_* on a slot.
 *
 * ┌─ NETWORK ADVISES, ORDERS DECIDES ───────────────────────────────────────┐
 * │ availability() never rejects anything. It answers with what remains and  │
 * │ what is short, and the caller decides — the same stance                  │
 * │ BranchAssignmentEngine takes when there is no coverage.                  │
 * │                                                                          │
 * │ reserve() DOES refuse when a slot cannot fit the request, because a hold │
 * │ that overdraws the slot is not advice, it is corruption.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Every mutation locks the slot row. Two concurrent reservations against the
 * last order slot must not both succeed, and an application-level read-modify-
 * write without a lock is precisely how that happens.
 */
class CapacityLedgerService
{
    /** How long a soft hold survives without confirmation. */
    public const DEFAULT_TTL_MINUTES = 30;

    /**
     * What remains, and what would be short. Advisory — never throws for lack
     * of capacity.
     *
     * @param  array<string, float>  $requested
     * @return array<string, mixed>
     */
    public function availability(CapacitySlot $slot, array $requested = []): array
    {
        $shortfall = $slot->shortfall($requested);
        $binding = $slot->bindingUnit();

        return [
            'slot_id' => $slot->uuid,
            'available' => $this->dimensions($slot, 'available'),
            'committed' => $this->dimensions($slot, 'committed'),
            'remaining' => $slot->remaining(),
            'utilisation' => $slot->utilisation(),
            'binding_unit' => $binding?->value,
            'can_accommodate' => $shortfall === [],
            'shortfall' => $shortfall === [] ? null : $shortfall,
            'at_warn_threshold' => $slot->isAtWarnThreshold(),
            'is_exhausted' => $slot->isExhausted(),
        ];
    }

    /**
     * Take a soft hold with a TTL.
     *
     * The TTL is not optional: an abandoned checkout that holds capacity for
     * ever makes a zone mysteriously sell out, and nobody can tell why.
     *
     * @param  array<string, float>  $quantities
     */
    public function reserve(
        CapacitySlot $slot,
        array $quantities,
        ?string $referenceType = null,
        ?string $referenceId = null,
        ?int $ttlMinutes = null,
        ?int $actorId = null,
    ): CapacityCommitment {
        $quantities = $this->normalise($quantities);

        if (array_sum($quantities) <= 0.0) {
            throw NetworkException::commitmentQuantitiesRequired();
        }

        $plan = $slot->plan;

        if ($plan !== null && ! $plan->isBookable()) {
            throw NetworkException::planNotPublished();
        }

        $area = $plan?->area;

        if ($area !== null && ! $area->acceptsCommitments()) {
            throw NetworkException::areaNotAcceptingCommitments($area->status);
        }

        $commitment = DB::transaction(function () use (
            $slot, $quantities, $referenceType, $referenceId, $ttlMinutes, $actorId
        ) {
            // Lock the slot: two concurrent reservations against the last order
            // must not both succeed.
            $locked = CapacitySlot::query()->lockForUpdate()->findOrFail($slot->id);

            $shortfall = $locked->shortfall($quantities);

            if ($shortfall !== []) {
                throw NetworkException::insufficientCapacity($shortfall);
            }

            $commitment = $locked->commitments()->create([
                'company_id' => $locked->plan?->company_id,
                'status' => CapacityCommitmentStatus::Reserved->value,
                'reference_type' => $referenceType,
                'reference_id' => $referenceId,
                'orders' => $quantities[CapacityUnit::Orders->value],
                'stops' => $quantities[CapacityUnit::Stops->value],
                'weight_kg' => $quantities[CapacityUnit::WeightKg->value],
                'volume_m3' => $quantities[CapacityUnit::VolumeM3->value],
                'expires_at' => Carbon::now()->addMinutes($ttlMinutes ?? self::DEFAULT_TTL_MINUTES),
                'created_by' => $actorId,
            ]);

            $this->applyToSlot($locked, $quantities, 1);

            return $commitment->refresh();
        });

        $this->publishThresholdEvents($slot->refresh());

        return $commitment;
    }

    /** Confirm a hold. The capacity was already deducted at reserve time. */
    public function commit(CapacityCommitment $commitment, ?string $actor = null): CapacityCommitment
    {
        $this->assertTransition($commitment, CapacityCommitmentStatus::Committed);

        $commitment->update([
            'status' => CapacityCommitmentStatus::Committed->value,
            'committed_at' => Carbon::now(),
            'expires_at' => null,
        ]);

        CapacityCommitted::dispatch($commitment->refresh(), $actor);

        return $commitment->refresh();
    }

    /** The delivery happened. Terminal, and the capacity stays consumed. */
    public function consume(CapacityCommitment $commitment): CapacityCommitment
    {
        $this->assertTransition($commitment, CapacityCommitmentStatus::Consumed);

        $commitment->update(['status' => CapacityCommitmentStatus::Consumed->value]);

        return $commitment->refresh();
    }

    /** Give the capacity back. */
    public function release(
        CapacityCommitment $commitment,
        ?string $reason = null,
        ?string $actor = null,
    ): CapacityCommitment {
        $this->assertTransition($commitment, CapacityCommitmentStatus::Released);

        // Releasing a CONFIRMED commitment is a business decision someone must
        // own; releasing an unconfirmed hold is routine.
        if ($commitment->status === CapacityCommitmentStatus::Committed
            && ($reason === null || trim($reason) === '')) {
            throw NetworkException::releaseReasonRequired();
        }

        $released = DB::transaction(function () use ($commitment, $reason) {
            $slot = CapacitySlot::query()->lockForUpdate()->findOrFail($commitment->capacity_slot_id);

            $commitment->update([
                'status' => CapacityCommitmentStatus::Released->value,
                'released_at' => Carbon::now(),
                'release_reason' => $reason,
            ]);

            $this->applyToSlot($slot, $commitment->quantities(), -1);

            return $commitment->refresh();
        });

        CapacityReleased::dispatch($released, $actor);

        return $released;
    }

    /**
     * Reclaim expired soft holds. Returns how many were reclaimed.
     *
     * Without this sweep, abandoned checkouts silently eat a day's capacity —
     * the failure mode that stays invisible until a zone sells out.
     */
    public function sweepExpired(?Carbon $at = null): int
    {
        $at ??= Carbon::now();

        $expired = CapacityCommitment::query()
            ->where('status', CapacityCommitmentStatus::Reserved->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<', $at)
            ->get();

        $count = 0;

        foreach ($expired as $commitment) {
            DB::transaction(function () use ($commitment) {
                $slot = CapacitySlot::query()
                    ->lockForUpdate()
                    ->findOrFail($commitment->capacity_slot_id);

                $commitment->update([
                    'status' => CapacityCommitmentStatus::Expired->value,
                    'released_at' => Carbon::now(),
                    'release_reason' => 'Soft hold expired without confirmation.',
                ]);

                $this->applyToSlot($slot, $commitment->quantities(), -1);
            });

            $count++;
        }

        return $count;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /**
     * Move committed_* on a slot. $sign of 1 consumes, -1 gives back.
     *
     * Clamped at zero: a released commitment whose slot was later reduced must
     * not drive committed negative and manufacture phantom capacity.
     *
     * @param  array<string, float>  $quantities
     */
    private function applyToSlot(CapacitySlot $slot, array $quantities, int $sign): void
    {
        $updates = [];

        foreach (CapacityUnit::cases() as $unit) {
            $delta = (float) ($quantities[$unit->value] ?? 0) * $sign;

            if ($delta === 0.0) {
                continue;
            }

            $column = 'committed_'.$unit->column();
            $next = max(0, round((float) $slot->{$column} + $delta, $unit->precision()));
            $updates[$column] = $next;
        }

        if ($updates !== []) {
            $slot->update($updates);
        }
    }

    /** @param array<string, float> $quantities @return array<string, float> */
    private function normalise(array $quantities): array
    {
        $out = [];

        foreach (CapacityUnit::cases() as $unit) {
            $out[$unit->value] = round((float) ($quantities[$unit->value] ?? 0), $unit->precision());
        }

        return $out;
    }

    /** @return array<string, float> */
    private function dimensions(CapacitySlot $slot, string $prefix): array
    {
        $out = [];

        foreach (CapacityUnit::cases() as $unit) {
            $out[$unit->value] = (float) $slot->{$prefix.'_'.$unit->column()};
        }

        return $out;
    }

    private function publishThresholdEvents(CapacitySlot $slot): void
    {
        if ($slot->isExhausted()) {
            CapacityExhausted::dispatch($slot);

            return;
        }

        if ($slot->isAtWarnThreshold()) {
            CapacityThresholdBreached::dispatch($slot);
        }
    }

    private function assertTransition(CapacityCommitment $commitment, CapacityCommitmentStatus $target): void
    {
        if (! $commitment->status->canTransitionTo($target)) {
            throw NetworkException::invalidCommitmentTransition($commitment->status, $target);
        }
    }
}
