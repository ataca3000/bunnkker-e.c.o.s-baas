<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Promotion\Domain\Enums\PromotionRewardType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Percentage;

/**
 * Immutable value object expressing what a qualifying customer receives.
 *
 * Deliberately kept as a typed parameter bag so future reward types can be
 * introduced by adding a new factory method without changing the aggregate.
 */
final readonly class PromotionReward
{
    private function __construct(
        public PromotionRewardType $type,
        public array $parameters,
    ) {}

    // ── Factories ─────────────────────────────────────────────────────────────

    public static function percentageDiscount(Percentage $percentage, string $scope = 'cart_total'): self
    {
        self::guardScope($scope);

        return new self(PromotionRewardType::PercentageDiscount, [
            'percentage' => $percentage->value,
            'scope' => $scope,
        ]);
    }

    public static function fixedAmountDiscount(Money $amount, string $scope = 'cart_total'): self
    {
        self::guardScope($scope);
        if (! $amount->isPositive()) {
            throw new InvalidArgumentException('Fixed discount amount must be positive.');
        }

        return new self(PromotionRewardType::FixedAmountDiscount, [
            'amount' => $amount->toArray(),
            'scope' => $scope,
        ]);
    }

    public static function freeItem(string $productId, int $quantity = 1): self
    {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('Free item product ID cannot be empty.');
        }
        if ($quantity <= 0) {
            throw new InvalidArgumentException('Free item quantity must be positive.');
        }

        return new self(PromotionRewardType::FreeItem, [
            'product_id' => $productId,
            'quantity' => $quantity,
        ]);
    }

    public static function bundlePrice(Money $price): self
    {
        if (! $price->isPositive()) {
            throw new InvalidArgumentException('Bundle price must be positive.');
        }

        return new self(PromotionRewardType::BundlePrice, [
            'price' => $price->toArray(),
        ]);
    }

    // ── Convenience accessors ─────────────────────────────────────────────────

    public function getPercentage(): ?Percentage
    {
        if ($this->type !== PromotionRewardType::PercentageDiscount) {
            return null;
        }

        return Percentage::of($this->parameters['percentage']);
    }

    public function getAmount(): ?Money
    {
        $key = match ($this->type) {
            PromotionRewardType::FixedAmountDiscount => 'amount',
            PromotionRewardType::BundlePrice => 'price',
            default => null,
        };

        return $key ? Money::fromArray($this->parameters[$key]) : null;
    }

    public function getFreeItemProductId(): ?string
    {
        return $this->parameters['product_id'] ?? null;
    }

    public function getFreeItemQuantity(): ?int
    {
        return $this->parameters['quantity'] ?? null;
    }

    public function getScope(): ?string
    {
        return $this->parameters['scope'] ?? null;
    }

    // ── Serialization ─────────────────────────────────────────────────────────

    public function toArray(): array
    {
        return [
            'type' => $this->type->value,
            'parameters' => $this->parameters,
        ];
    }

    public static function fromArray(array $data): self
    {
        return new self(
            type: PromotionRewardType::from($data['type']),
            parameters: $data['parameters'] ?? [],
        );
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    private static function guardScope(string $scope): void
    {
        if (! in_array($scope, ['cart_total', 'line_item'], true)) {
            throw new InvalidArgumentException(
                "Invalid scope \"{$scope}\". Must be 'cart_total' or 'line_item'.",
            );
        }
    }
}
