<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Domain\Services;

use Illuminate\Support\Carbon;
use Modules\Logistics\Network\Domain\Models\CapacitySlot;
use Modules\Logistics\Operations\Domain\Enums\ReservationStatus;
use Modules\Logistics\Operations\Domain\Models\CapacityReservation;

/**
 * What the capacity picture looks like right now.
 *
 * Operational only. Nothing here forecasts, extrapolates or scores — it reports
 * what the ledger currently holds and what operations asked for.
 *
 * A rate with no denominator is null, never zero. "No reservations were made"
 * and "every reservation was refused" are different facts, and rendering both
 * as 0% invites a decision the data does not support.
 */
class CapacityMonitoringService
{
    /** @return array<string, mixed> */
    public function overview(?string $companyId = null, ?Carbon $date = null): array
    {
        $date ??= Carbon::today();

        $slots = CapacitySlot::query()
            ->whereHas('plan', function ($q) use ($companyId, $date) {
                $q->whereDate('plan_date', $date->toDateString())
                    ->when($companyId !== null, fn ($p) => $p->where('company_id', $companyId));
            })
            ->with('plan.area')
            ->get();

        $utilisations = $slots
            ->map(static fn (CapacitySlot $slot) => $slot->utilisation())
            ->filter(static fn (?float $u) => $u !== null)
            ->values();

        $byArea = [];

        foreach ($slots as $slot) {
            $area = $slot->plan?->area?->name ?? 'Unassigned';

            $byArea[$area] ??= ['slots' => 0, 'exhausted' => 0, 'at_warn' => 0];
            $byArea[$area]['slots']++;

            if ($slot->isExhausted()) {
                $byArea[$area]['exhausted']++;
            } elseif ($slot->isAtWarnThreshold()) {
                $byArea[$area]['at_warn']++;
            }
        }

        return [
            'date' => $date->toDateString(),
            'slot_count' => $slots->count(),
            'avg_utilisation' => $utilisations->isEmpty()
                ? null
                : round((float) $utilisations->avg(), 4),
            'at_warn_threshold' => $slots->filter(
                static fn (CapacitySlot $s) => $s->isAtWarnThreshold() && ! $s->isExhausted()
            )->count(),
            'exhausted' => $slots->filter(static fn (CapacitySlot $s) => $s->isExhausted())->count(),
            'by_area' => $byArea,
        ];
    }

    /**
     * How operations' own reservation requests are faring.
     *
     * @return array<string, mixed>
     */
    public function reservationStatistics(?string $companyId = null, ?Carbon $from = null, ?Carbon $to = null): array
    {
        $from ??= Carbon::today()->subDays(7);
        $to ??= Carbon::now();

        $reservations = CapacityReservation::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereBetween('requested_at', [$from, $to])
            ->get();

        $requested = $reservations->count();
        $held = $reservations->where('status', ReservationStatus::Held)->count();
        $confirmed = $reservations->where('status', ReservationStatus::Confirmed)->count();
        $released = $reservations->where('status', ReservationStatus::Released)->count();
        $failed = $reservations->where('status', ReservationStatus::Failed)->count();

        // The number that matters: how often the network could not take what
        // operations asked for.
        $refusalRate = $requested > 0 ? round($failed / $requested, 4) : null;

        $rebalanced = $reservations->whereNotNull('rebalanced_from_slot_id')->count();

        return [
            'from' => $from->toIso8601String(),
            'to' => $to->toIso8601String(),
            'requested' => $requested,
            'held' => $held,
            'confirmed' => $confirmed,
            'released' => $released,
            'refused' => $failed,
            'refusal_rate' => $refusalRate,
            'confirmation_rate' => $requested > 0 ? round($confirmed / $requested, 4) : null,
            'rebalanced' => $rebalanced,
            'currently_holding' => $reservations->filter(
                static fn (CapacityReservation $r) => $r->holdsCapacity()
            )->count(),
        ];
    }

    /**
     * The reasons the network gave when it refused, most common first.
     *
     * Refusals are only useful in aggregate: one is an incident, forty of the
     * same is a capacity plan that needs changing.
     *
     * @return list<array{reason: string, count: int}>
     */
    public function refusalReasons(?string $companyId = null, int $limit = 10): array
    {
        $rows = CapacityReservation::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->where('status', ReservationStatus::Failed->value)
            ->whereNotNull('failure_reason')
            ->get()
            ->groupBy('failure_reason')
            ->map(static fn ($group, $reason) => ['reason' => (string) $reason, 'count' => $group->count()])
            ->sortByDesc('count')
            ->take($limit)
            ->values()
            ->all();

        return $rows;
    }
}
