<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Services;

use Carbon\Carbon;
use Modules\Core\BusinessAttribution\Domain\Enums\AttributionModel;
use Modules\Core\BusinessAttribution\Domain\Models\AttributionConfig;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessEvent;

/**
 * Attribution Engine — calculates credit weights for touchpoints.
 * Supports: First Touch, Last Touch, Linear, Position Based, Time Decay.
 * Prepared for: AI Attribution, Data-Driven, Custom Models (via config).
 */
final class AttributionService
{
    /**
     * Calculate attribution credit weights for all events linked to a DNA.
     *
     * @return array{
     *   model: string,
     *   touchpoints: array<int, array{event_id: string, event_name: string, occurred_at: string, credit: float}>,
     *   total_touchpoints: int,
     * }
     */
    public function calculate(BusinessDna $dna, ?AttributionModel $model = null): array
    {
        // Resolve model: explicit → company default → last_touch
        if ($model === null) {
            $config = $this->getDefaultConfig($dna->company_id);
            $model = $config?->model ?? AttributionModel::LastTouch;
        }

        $events = BusinessEvent::where('business_dna_id', $dna->id)
            ->orderBy('occurred_at')
            ->get(['id', 'event_uuid', 'event_name', 'occurred_at']);

        if ($events->isEmpty()) {
            return ['model' => $model->value, 'touchpoints' => [], 'total_touchpoints' => 0];
        }

        $touchpoints = $events->map(static fn ($e) => [
            'event_id' => $e->id,
            'event_name' => $e->event_name,
            'occurred_at' => $e->occurred_at->toIso8601String(),
        ])->values()->all();

        $weights = match ($model) {
            AttributionModel::FirstTouch => $this->firstTouch($touchpoints),
            AttributionModel::LastTouch => $this->lastTouch($touchpoints),
            AttributionModel::Linear => $this->linear($touchpoints),
            AttributionModel::PositionBased => $this->positionBased($touchpoints),
            AttributionModel::TimeDecay => $this->timeDecay($touchpoints),
        };

        $result = array_map(static function (array $tp) use ($weights): array {
            return array_merge($tp, ['credit' => round($weights[$tp['event_id']] ?? 0.0, 4)]);
        }, $touchpoints);

        return [
            'model' => $model->value,
            'touchpoints' => $result,
            'total_touchpoints' => count($result),
        ];
    }

    public function getDefaultConfig(?string $companyId): ?AttributionConfig
    {
        if ($companyId === null) {
            return null;
        }

        return AttributionConfig::where('company_id', $companyId)
            ->where('is_default', true)
            ->first();
    }

    // ─── Attribution Model Implementations ────────────────────────────────────

    /** @param  array<int, array{event_id: string}> $touchpoints */
    private function firstTouch(array $touchpoints): array
    {
        $weights = [];
        foreach ($touchpoints as $i => $tp) {
            $weights[$tp['event_id']] = $i === 0 ? 1.0 : 0.0;
        }

        return $weights;
    }

    /** @param  array<int, array{event_id: string}> $touchpoints */
    private function lastTouch(array $touchpoints): array
    {
        $weights = [];
        $last = count($touchpoints) - 1;
        foreach ($touchpoints as $i => $tp) {
            $weights[$tp['event_id']] = $i === $last ? 1.0 : 0.0;
        }

        return $weights;
    }

    /** @param  array<int, array{event_id: string}> $touchpoints */
    private function linear(array $touchpoints): array
    {
        $count = count($touchpoints);
        $weight = $count > 0 ? round(1.0 / $count, 6) : 0.0;

        return array_combine(
            array_column($touchpoints, 'event_id'),
            array_fill(0, $count, $weight),
        );
    }

    /** @param  array<int, array{event_id: string}> $touchpoints */
    private function positionBased(array $touchpoints): array
    {
        $count = count($touchpoints);
        if ($count === 0) {
            return [];
        }
        if ($count === 1) {
            return [$touchpoints[0]['event_id'] => 1.0];
        }
        if ($count === 2) {
            return [
                $touchpoints[0]['event_id'] => 0.5,
                $touchpoints[1]['event_id'] => 0.5,
            ];
        }

        $weights = [];
        $midWeight = 0.2 / max(1, $count - 2);

        foreach ($touchpoints as $i => $tp) {
            $weights[$tp['event_id']] = match (true) {
                $i === 0 => 0.4,
                $i === $count - 1 => 0.4,
                default => $midWeight,
            };
        }

        return $weights;
    }

    /** @param  array<int, array{event_id: string, occurred_at: string}> $touchpoints */
    private function timeDecay(array $touchpoints): array
    {
        $count = count($touchpoints);
        if ($count === 0) {
            return [];
        }

        $conversionAt = Carbon::parse($touchpoints[$count - 1]['occurred_at']);

        $rawWeights = [];
        foreach ($touchpoints as $tp) {
            $daysDiff = abs((int) Carbon::parse($tp['occurred_at'])->diffInDays($conversionAt));
            $rawWeights[$tp['event_id']] = pow(0.5, $daysDiff / 7);
        }

        $sum = array_sum($rawWeights);
        if ($sum === 0.0) {
            return $this->linear($touchpoints);
        }

        return array_map(static fn ($w) => round($w / $sum, 6), $rawWeights);
    }
}
