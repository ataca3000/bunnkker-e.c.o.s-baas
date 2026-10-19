<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\ValueObjects;

use InvalidArgumentException;
use Modules\POS\Promotion\Domain\Enums\PromotionConditionType;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Immutable value object expressing a single promotion eligibility condition.
 *
 * Factory methods are the only way to create a condition, ensuring the
 * parameter array is always well-formed for the given type.
 */
final readonly class PromotionCondition
{
    private function __construct(
        public PromotionConditionType $type,
        public array $parameters,
    ) {}

    // ── Factories ─────────────────────────────────────────────────────────────

    public static function anyPurchase(): self
    {
        return new self(PromotionConditionType::AnyPurchase, []);
    }

    public static function minimumCartTotal(Money $minAmount): self
    {
        if (! $minAmount->isPositive()) {
            throw new InvalidArgumentException('Minimum cart total must be positive.');
        }

        return new self(PromotionConditionType::MinimumCartTotal, [
            'min_amount' => $minAmount->toArray(),
        ]);
    }

    public static function minimumQuantity(int $minQty, ?string $productId = null): self
    {
        if ($minQty <= 0) {
            throw new InvalidArgumentException('Minimum quantity must be positive.');
        }

        return new self(PromotionConditionType::MinimumQuantity, [
            'min_quantity' => $minQty,
            'product_id' => $productId,
        ]);
    }

    public static function specificProduct(string $productId): self
    {
        if (trim($productId) === '') {
            throw new InvalidArgumentException('Product ID cannot be empty.');
        }

        return new self(PromotionConditionType::SpecificProduct, [
            'product_id' => $productId,
        ]);
    }

    public static function customerGroup(string $groupId): self
    {
        if (trim($groupId) === '') {
            throw new InvalidArgumentException('Customer group ID cannot be empty.');
        }

        return new self(PromotionConditionType::CustomerGroup, [
            'group_id' => $groupId,
        ]);
    }

    // ── Convenience accessors ─────────────────────────────────────────────────

    public function getMinAmount(): ?Money
    {
        if ($this->type !== PromotionConditionType::MinimumCartTotal) {
            return null;
        }

        return Money::fromArray($this->parameters['min_amount']);
    }

    public function getMinQuantity(): ?int
    {
        return $this->parameters['min_quantity'] ?? null;
    }

    public function getProductId(): ?string
    {
        return $this->parameters['product_id'] ?? null;
    }

    public function getGroupId(): ?string
    {
        return $this->parameters['group_id'] ?? null;
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
            type: PromotionConditionType::from($data['type']),
            parameters: $data['parameters'] ?? [],
        );
    }
}
