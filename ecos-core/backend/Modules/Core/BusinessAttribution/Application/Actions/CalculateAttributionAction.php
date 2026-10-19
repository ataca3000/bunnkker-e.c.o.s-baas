<?php

declare(strict_types=1);

namespace Modules\Core\BusinessAttribution\Application\Actions;

use Modules\Core\BusinessAttribution\Application\Services\AttributionService;
use Modules\Core\BusinessAttribution\Domain\Enums\AttributionModel;
use Modules\Core\BusinessAttribution\Domain\Models\BusinessDna;

/**
 * Calculate attribution credit for all touchpoints of a Business DNA record.
 */
final class CalculateAttributionAction
{
    public function __construct(
        private readonly AttributionService $attributionService,
    ) {}

    /**
     * @return array{
     *   model: string,
     *   touchpoints: array<int, array{event_id: string, event_name: string, occurred_at: string, credit: float}>,
     *   total_touchpoints: int,
     * }
     */
    public function execute(BusinessDna $dna, ?string $modelValue = null): array
    {
        $model = $modelValue !== null
            ? AttributionModel::from($modelValue)
            : null;

        return $this->attributionService->calculate($dna, $model);
    }
}
