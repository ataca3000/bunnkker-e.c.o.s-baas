<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Policies;

use Modules\POS\Promotion\Domain\Enums\PromotionConditionType;
use Modules\POS\Promotion\Domain\Models\Promotion;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionCondition;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionContext;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Evaluates whether a Promotion applies to a given PromotionContext.
 *
 * Responsible for:
 *   1. Checking promotion lifecycle state (must be Active)
 *   2. Checking date-range validity against context.evaluatedAt
 *   3. Checking remaining use quota
 *   4. Evaluating each condition (all must be satisfied — AND logic)
 *
 * Kept separate from the Promotion aggregate to allow policy composition
 * and independent testing without database interaction.
 */
final class PromotionEligibilityPolicy
{
    /**
     * Returns true only when ALL eligibility checks pass.
     */
    public function isEligible(Promotion $promotion, PromotionContext $context): bool
    {
        if (! $promotion->isActive()) {
            return false;
        }

        $now = $context->evaluatedAt;

        if ($now < $promotion->getValidFrom()) {
            return false;
        }

        $validUntil = $promotion->getValidUntil();
        if ($validUntil !== null && $now > $validUntil) {
            return false;
        }

        if (! $promotion->hasRemainingUses()) {
            return false;
        }

        foreach ($promotion->getConditions() as $condition) {
            if (! $this->isConditionSatisfied($condition, $context)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Returns conditions that were NOT satisfied for a given context.
     * Useful for surfacing why a promotion did not apply.
     *
     * @return PromotionCondition[]
     */
    public function getUnsatisfiedConditions(Promotion $promotion, PromotionContext $context): array
    {
        return array_values(array_filter(
            $promotion->getConditions(),
            fn (PromotionCondition $cond) => ! $this->isConditionSatisfied($cond, $context),
        ));
    }

    /**
     * Returns conditions that WERE satisfied for a given context.
     *
     * @return PromotionCondition[]
     */
    public function getSatisfiedConditions(Promotion $promotion, PromotionContext $context): array
    {
        return array_values(array_filter(
            $promotion->getConditions(),
            fn (PromotionCondition $cond) => $this->isConditionSatisfied($cond, $context),
        ));
    }

    private function isConditionSatisfied(PromotionCondition $condition, PromotionContext $context): bool
    {
        return match ($condition->type) {
            PromotionConditionType::AnyPurchase => true,

            PromotionConditionType::MinimumCartTotal => $context->cartTotal->isGreaterThanOrEqual(
                Money::fromArray($condition->parameters['min_amount']),
            ),

            PromotionConditionType::MinimumQuantity => $this->checkMinimumQuantity($condition, $context),

            PromotionConditionType::SpecificProduct => $context->hasProduct(
                $condition->parameters['product_id'],
            ),

            PromotionConditionType::CustomerGroup => $context->isInGroup(
                $condition->parameters['group_id'],
            ),
        };
    }

    private function checkMinimumQuantity(PromotionCondition $condition, PromotionContext $context): bool
    {
        $minQty = $condition->parameters['min_quantity'];
        $productId = $condition->parameters['product_id'] ?? null;

        $actualQty = $productId !== null
            ? $context->quantityOf($productId)
            : $context->totalQuantity();

        return $actualQty >= $minQty;
    }
}
