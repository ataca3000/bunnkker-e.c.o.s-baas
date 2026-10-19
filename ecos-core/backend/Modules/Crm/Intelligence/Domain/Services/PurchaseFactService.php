<?php

declare(strict_types=1);

namespace Modules\Crm\Intelligence\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Modules\Crm\Intelligence\Domain\Models\PurchaseFact;

/**
 * The append-only writer and reader of purchase facts.
 *
 * Facts arrive by opaque reference from Commerce/Finance; this service records
 * them idempotently and derives the raw per-customer aggregates (recency,
 * frequency, monetary, tenure, cadence) that every downstream engine consumes.
 */
final class PurchaseFactService
{
    /**
     * Record a purchase fact. Idempotent on (customer, source_reference): the same
     * order is never counted twice, so recomputation is safe to replay.
     */
    public function record(string $companyId, string $customerId, array $data): PurchaseFact
    {
        $reference = (string) $data['source_reference'];

        $existing = PurchaseFact::query()
            ->where('customer_id', $customerId)
            ->where('source_reference', $reference)
            ->first();

        if ($existing !== null) {
            return $existing;
        }

        return PurchaseFact::create([
            'company_id' => $companyId,
            'customer_id' => $customerId,
            'source_reference' => $reference,
            'source_type' => $data['source_type'] ?? 'order',
            'channel' => $data['channel'] ?? null,
            'amount' => round((float) ($data['amount'] ?? 0), 2),
            'item_count' => (int) ($data['item_count'] ?? 0),
            'occurred_at' => isset($data['occurred_at']) ? Carbon::parse($data['occurred_at']) : Carbon::now(),
            'actor_id' => $data['actor_id'] ?? null,
        ]);
    }

    /** @return Collection<int, PurchaseFact> a customer's facts, oldest first */
    public function factsFor(string $customerId): Collection
    {
        return PurchaseFact::query()
            ->where('customer_id', $customerId)
            ->orderBy('occurred_at')
            ->get();
    }

    /**
     * The raw, deterministic aggregates for one customer as of $asOf.
     *
     * @return array<string, mixed>
     */
    public function aggregates(string $customerId, ?Carbon $asOf = null): array
    {
        $asOf ??= Carbon::now();
        $facts = $this->factsFor($customerId);

        $count = $facts->count();
        if ($count === 0) {
            return [
                'frequency' => 0, 'monetary' => 0.0, 'average_order_value' => 0.0,
                'first_at' => null, 'last_at' => null,
                'recency_days' => null, 'tenure_days' => 0,
                'avg_interval_days' => null, 'purchase_frequency_monthly' => 0.0,
                'amounts' => [],
            ];
        }

        $monetary = round((float) $facts->sum('amount'), 2);
        $first = $facts->first()->occurred_at;
        $last = $facts->last()->occurred_at;

        $recencyDays = max(0, (int) floor((float) $last->diffInDays($asOf)));
        $tenureDays = max(0, (int) floor((float) $first->diffInDays($asOf)));
        $spanDays = max(0, (int) floor((float) $first->diffInDays($last)));

        // Average interval between consecutive purchases (only meaningful for repeat buyers).
        $avgInterval = $count > 1 ? (int) round($spanDays / ($count - 1)) : null;

        // Purchases per month over the observed tenure (min one month to avoid divide spikes).
        $tenureMonths = max(1.0, $tenureDays / 30.0);
        $monthlyFrequency = round($count / $tenureMonths, 4);

        return [
            'frequency' => $count,
            'monetary' => $monetary,
            'average_order_value' => round($monetary / $count, 2),
            'first_at' => $first,
            'last_at' => $last,
            'recency_days' => $recencyDays,
            'tenure_days' => $tenureDays,
            'avg_interval_days' => $avgInterval,
            'purchase_frequency_monthly' => $monthlyFrequency,
            'amounts' => $facts->pluck('amount')->map(fn ($a) => (float) $a)->all(),
        ];
    }
}
