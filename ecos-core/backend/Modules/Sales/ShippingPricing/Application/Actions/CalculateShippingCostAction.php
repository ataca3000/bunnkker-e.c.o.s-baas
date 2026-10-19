<?php

declare(strict_types=1);

namespace Modules\Sales\ShippingPricing\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Modules\Sales\ShippingPricing\Domain\Models\ShippingPricingRule;

/**
 * Hierarchical shipping cost lookup: area > city > governorate > fallback null.
 * Accepts governorate (required), city (optional), area (optional), company_id (optional).
 */
final class CalculateShippingCostAction extends BaseAction
{
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var array<string, mixed> $params */
        $params = $arguments[0];

        $governorate = (string) ($params['governorate'] ?? '');
        $city = $params['city'] ? (string) $params['city'] : null;
        $area = $params['area'] ? (string) $params['area'] : null;
        $companyId = $params['company_id'] ? (string) $params['company_id'] : null;

        $rule = $this->findRule($governorate, $city, $area, $companyId);

        if ($rule === null) {
            return OperationResult::success([
                'found' => false,
                'standard_cost' => null,
                'express_cost' => null,
                'matched_level' => null,
            ], 'No shipping rule found for this location.');
        }

        return OperationResult::success([
            'found' => true,
            'standard_cost' => $rule->standard_cost,
            'express_cost' => $rule->express_cost,
            'matched_level' => $this->matchedLevel($rule),
        ], 'Shipping cost calculated.');
    }

    private function findRule(
        string $governorate,
        ?string $city,
        ?string $area,
        ?string $companyId,
    ): ?ShippingPricingRule {
        $base = ShippingPricingRule::where('governorate', $governorate)
            ->where('is_active', true)
            ->when($companyId, fn ($q) => $q->where(fn ($q2) => $q2->where('company_id', $companyId)->orWhereNull('company_id')));

        // Most specific: area level
        if ($area && $city) {
            $rule = (clone $base)->where('city', $city)->where('area', $area)->first();
            if ($rule) {
                return $rule;
            }
        }

        // City level
        if ($city) {
            $rule = (clone $base)->where('city', $city)->whereNull('area')->first();
            if ($rule) {
                return $rule;
            }
        }

        // Governorate level
        return (clone $base)->whereNull('city')->whereNull('area')->first();
    }

    private function matchedLevel(ShippingPricingRule $rule): string
    {
        if ($rule->area) {
            return 'area';
        }
        if ($rule->city) {
            return 'city';
        }

        return 'governorate';
    }
}
