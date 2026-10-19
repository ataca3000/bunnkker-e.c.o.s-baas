<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Infrastructure\Repositories;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Carbon;
use Modules\Logistics\Delivery\Domain\Contracts\DeliveryRepositoryInterface;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureCategory;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

class EloquentDeliveryRepository implements DeliveryRepositoryInterface
{
    public function findByUuid(string $uuid): ?Delivery
    {
        return $this->withRelations()->where('uuid', $uuid)->first();
    }

    public function findByUuidOrFail(string $uuid): Delivery
    {
        return $this->withRelations()->where('uuid', $uuid)->firstOrFail();
    }

    public function findByOrderId(string $orderId): ?Delivery
    {
        return $this->withRelations()->where('order_id', $orderId)->first();
    }

    public function paginate(array $filters = [], int $perPage = 20): LengthAwarePaginator
    {
        $query = Delivery::query()
            ->withCount(['attempts', 'failures', 'returns'])
            // The list leads with why a delivery is stuck, so the latest
            // attempt's failure travels with it rather than costing a click.
            ->with(['order', 'latestAttempt.failure', 'codRecord'])
            ->latest('id');

        $this->applyFilters($query, $filters);

        return $query->paginate($perPage);
    }

    public function create(array $attributes): Delivery
    {
        return Delivery::create($attributes);
    }

    public function update(Delivery $delivery, array $attributes): Delivery
    {
        $delivery->update($attributes);

        return $delivery->refresh();
    }

    public function statistics(?string $companyId = null): array
    {
        $byStatus = Delivery::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->selectRaw('status, COUNT(*) AS total')
            ->groupBy('status')
            ->pluck('total', 'status');

        $count = static fn (DeliveryStatus $s): int => (int) ($byStatus[$s->value] ?? 0);

        return [
            'total' => (int) $byStatus->sum(),
            'in_transit' => $count(DeliveryStatus::InTransit),
            'out_for_delivery' => $count(DeliveryStatus::OutForDelivery),
            'delivered' => $count(DeliveryStatus::Delivered),
            'partially_delivered' => $count(DeliveryStatus::PartiallyDelivered),
            'failed' => $count(DeliveryStatus::Failed),
            'awaiting_retry' => $count(DeliveryStatus::AwaitingRetry),
            'returning' => $count(DeliveryStatus::Returning),
            'returned' => $count(DeliveryStatus::Returned),
            'cancelled' => $count(DeliveryStatus::Cancelled),
            'sla_breached' => $this->breachedOpenDeliveries($companyId),
            'failures_by_category' => $this->failuresByCategory($companyId),
        ];
    }

    public function breachedOpenDeliveries(?string $companyId = null): int
    {
        return Delivery::query()
            ->when($companyId !== null, fn ($q) => $q->where('company_id', $companyId))
            ->whereNotNull('promised_at')
            ->whereNull('delivered_at')
            ->whereRaw('promised_at < ?', [Carbon::now()])
            ->whereNotIn('status', [
                DeliveryStatus::Delivered->value,
                DeliveryStatus::Returned->value,
                DeliveryStatus::Cancelled->value,
            ])
            ->count();
    }

    /** @return array<string, int> */
    private function failuresByCategory(?string $companyId): array
    {
        $rows = \Modules\Logistics\Delivery\Domain\Models\DeliveryFailure::query()
            ->when($companyId !== null, fn ($q) => $q->whereHas(
                'delivery',
                fn ($d) => $d->where('company_id', $companyId)
            ))
            ->selectRaw('category, COUNT(*) AS total')
            ->groupBy('category')
            ->pluck('total', 'category');

        $out = [];
        foreach (FailureCategory::cases() as $category) {
            $out[$category->value] = (int) ($rows[$category->value] ?? 0);
        }

        return $out;
    }

    private function withRelations(): Builder
    {
        return Delivery::query()
            ->withCount(['attempts', 'failures', 'returns'])
            ->with([
                'order',
                'attempts.failure',
                'attempts.pod.artifacts',
                'latestAttempt',
                'openAttempt',
                'codRecord',
                'returns.lines',
                'trackingEvents',
            ]);
    }

    /** @param array<string, mixed> $filters */
    private function applyFilters(Builder $query, array $filters): void
    {
        if (! empty($filters['company_id'])) {
            $query->where('company_id', $filters['company_id']);
        }

        if (! empty($filters['order_id'])) {
            $query->where('order_id', $filters['order_id']);
        }

        $status = $filters['status'] ?? null;
        if ($status !== null && in_array($status, DeliveryStatus::values(), true)) {
            $query->where('status', $status);
        } elseif ($status !== 'all') {
            // Default view hides closed deliveries.
            $query->whereNotIn('status', [
                DeliveryStatus::Delivered->value,
                DeliveryStatus::Returned->value,
                DeliveryStatus::Cancelled->value,
            ]);
        }

        // Exception Center: failure-first triage.
        if (! empty($filters['failure_category'])) {
            $query->whereHas(
                'failures',
                fn (Builder $q) => $q->where('category', $filters['failure_category'])
            );
        }

        if (filter_var($filters['sla_breached'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->whereNotNull('promised_at')
                ->whereNull('delivered_at')
                ->whereRaw('promised_at < ?', [Carbon::now()]);
        }

        if (filter_var($filters['awaiting_retry'] ?? false, FILTER_VALIDATE_BOOLEAN)) {
            $query->where('status', DeliveryStatus::AwaitingRetry->value);
        }

        if (! empty($filters['trip_id'])) {
            $query->whereHas('attempts', fn (Builder $q) => $q->where('trip_id', $filters['trip_id']));
        }
    }
}
