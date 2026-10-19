<?php

declare(strict_types=1);

namespace Modules\Hr\Compensation\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Models\KpiFact;
use Modules\Hr\Compensation\Domain\ValueObjects\WorkforceKpiEvent;

/**
 * The append-only writer of operational KPI facts.
 *
 * Ingestion is idempotent on the event's key, so a domain event delivered twice —
 * which a queue will eventually do — is counted once. Nothing here interprets the
 * fact; that is the KPI engine's and the commission engine's job.
 */
final class KpiFactService
{
    /**
     * Record a fact. Returns the existing row when the event has already landed.
     *
     * Two timestamps are kept, and they are not the same question. `occurred_at`
     * is when the thing happened in the operational module; `imported_at` is when
     * HR heard about it. "The order was on the 30th, we received it on the 3rd"
     * is exactly what a commission dispute turns on, and one column cannot say it.
     */
    public function record(WorkforceKpiEvent $event): KpiFact
    {
        $existing = KpiFact::query()->where('idempotency_key', $event->idempotencyKey)->first();

        if ($existing !== null) {
            return $existing;
        }

        $metadata = $event->metadata;

        return KpiFact::create($event->toFact() + [
            // The KIND of document behind the reference. Naming a document type is
            // not importing the module — the reference itself stays opaque, and HR
            // still cannot resolve it into an order.
            'source_document_type' => isset($metadata['document_type'])
                ? (string) $metadata['document_type'] : null,
            'source_document_number' => isset($metadata['document_number'])
                ? (string) $metadata['document_number'] : null,
            'imported_at' => Carbon::now(),
        ]);
    }

    /**
     * Where a number came from — the provenance of every fact behind a metric in a
     * window.
     *
     * This is what turns "your commission is 250" into something a person can
     * check: which module said so, against which document, on what date, and when
     * HR received it.
     *
     * @return array<string, mixed>
     */
    public function traceability(
        string $companyId,
        string $employeeId,
        string $metricKey,
        string $from,
        string $to,
        int $limit = 200,
    ): array {
        $facts = KpiFact::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $employeeId)
            ->where('metric_key', $metricKey)
            ->whereBetween('occurred_at', [
                Carbon::parse($from)->startOfDay(),
                Carbon::parse($to)->endOfDay(),
            ])
            ->orderBy('occurred_at')
            ->limit($limit)
            ->get();

        $total = KpiFact::query()
            ->where('company_id', $companyId)
            ->where('employee_id', $employeeId)
            ->where('metric_key', $metricKey)
            ->whereBetween('occurred_at', [
                Carbon::parse($from)->startOfDay(),
                Carbon::parse($to)->endOfDay(),
            ])
            ->count();

        return [
            'metric_key' => $metricKey,
            'metric_label' => KpiMetric::tryFrom($metricKey)?->label() ?? $metricKey,
            'source_module' => KpiMetric::tryFrom($metricKey)?->sourceModule(),
            'from' => $from,
            'to' => $to,
            'facts_total' => $total,
            'facts_shown' => $facts->count(),
            // Stated rather than implied: a truncated list that looks complete is
            // worse than one that says it isn't.
            'is_truncated' => $total > $facts->count(),
            'facts' => $facts->map(fn (KpiFact $fact) => [
                'id' => (string) $fact->id,
                'source_module' => $fact->source_module,
                'source_document_type' => $fact->source_document_type,
                'source_document_number' => $fact->source_document_number,
                'source_reference' => $fact->source_reference,
                'value' => (float) $fact->value,
                'quantity' => (float) $fact->quantity,
                'dimension_key' => $fact->dimension_key,
                'dimension_value' => $fact->dimension_value,
                'event_date' => $fact->occurred_at?->toDateTimeString(),
                'imported_date' => $fact->imported_at?->toDateTimeString()
                    ?? $fact->created_at?->toDateTimeString(),
                'idempotency_key' => $fact->idempotency_key,
            ])->all(),
        ];
    }

    /**
     * Record many facts at once, reporting how many were new.
     *
     * @param  array<int, WorkforceKpiEvent>  $events
     * @return array{recorded: int, duplicates: int}
     */
    public function recordMany(array $events): array
    {
        $recorded = 0;
        $duplicates = 0;

        foreach ($events as $event) {
            $before = KpiFact::query()->where('idempotency_key', $event->idempotencyKey)->exists();
            $this->record($event);
            $before ? $duplicates++ : $recorded++;
        }

        return ['recorded' => $recorded, 'duplicates' => $duplicates];
    }

    /**
     * Build an event from a flat payload — the shape the REST ingest endpoint and
     * the bus bridge both arrive in. Returns null when the metric is unknown,
     * rather than guessing what was meant.
     *
     * @param  array<string, mixed>  $payload
     */
    public function eventFromPayload(string $companyId, array $payload): ?WorkforceKpiEvent
    {
        $metric = KpiMetric::tryFrom((string) ($payload['metric_key'] ?? ''));

        if ($metric === null) {
            return null;
        }

        $occurredAt = isset($payload['occurred_at'])
            ? Carbon::parse((string) $payload['occurred_at'])
            : Carbon::now();

        $reference = isset($payload['source_reference']) ? (string) $payload['source_reference'] : null;

        return new WorkforceKpiEvent(
            companyId: $companyId,
            metric: $metric,
            employeeId: isset($payload['employee_id']) ? (string) $payload['employee_id'] : null,
            value: round((float) ($payload['value'] ?? 0), 4),
            quantity: round((float) ($payload['quantity'] ?? 1), 4),
            occurredAt: $occurredAt,
            idempotencyKey: (string) ($payload['idempotency_key']
                ?? $this->deriveKey($metric, $payload, $occurredAt)),
            departmentId: isset($payload['department_id']) ? (string) $payload['department_id'] : null,
            sourceReference: $reference,
            dimensionKey: isset($payload['dimension_key']) ? (string) $payload['dimension_key'] : null,
            dimensionValue: isset($payload['dimension_value']) ? (string) $payload['dimension_value'] : null,
            metadata: is_array($payload['metadata'] ?? null) ? $payload['metadata'] : [],
        );
    }

    /**
     * Totals for one subject, metric and window — the single query both the
     * commission engine and the KPI engine read through.
     *
     * @return array{value: float, quantity: float, facts: int}
     */
    public function aggregate(
        string $companyId,
        string $subjectColumn,
        string $subjectId,
        string $metricKey,
        string $from,
        string $to,
        ?string $dimensionKey = null,
        ?string $dimensionValue = null,
    ): array {
        $row = DB::table('hr_kpi_facts')
            ->where('company_id', $companyId)
            ->where($subjectColumn, $subjectId)
            ->where('metric_key', $metricKey)
            ->whereBetween('occurred_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->when($dimensionKey !== null, fn ($q) => $q->where('dimension_key', $dimensionKey))
            ->when($dimensionValue !== null, fn ($q) => $q->where('dimension_value', $dimensionValue))
            ->selectRaw('coalesce(sum(value),0) as total_value, coalesce(sum(quantity),0) as total_quantity, count(*) as facts')
            ->first();

        return [
            'value' => round((float) ($row->total_value ?? 0), 4),
            'quantity' => round((float) ($row->total_quantity ?? 0), 4),
            'facts' => (int) ($row->facts ?? 0),
        ];
    }

    /** The average of a metric's values — for percentages, which cannot be summed. */
    public function average(
        string $companyId,
        string $subjectColumn,
        string $subjectId,
        string $metricKey,
        string $from,
        string $to,
    ): float {
        $average = DB::table('hr_kpi_facts')
            ->where('company_id', $companyId)
            ->where($subjectColumn, $subjectId)
            ->where('metric_key', $metricKey)
            ->whereBetween('occurred_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->avg('value');

        return round((float) ($average ?? 0), 4);
    }

    /** A stable key when the publisher did not supply one. */
    private function deriveKey(KpiMetric $metric, array $payload, Carbon $occurredAt): string
    {
        return implode(':', [
            $metric->value,
            (string) ($payload['employee_id'] ?? 'none'),
            (string) ($payload['source_reference'] ?? $occurredAt->getTimestampMs()),
        ]);
    }
}
