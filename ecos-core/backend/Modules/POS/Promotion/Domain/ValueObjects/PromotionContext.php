<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\ValueObjects;

use DateTimeImmutable;
use Modules\POS\Shared\Domain\ValueObjects\Money;

/**
 * Immutable snapshot of the cart / customer context at promotion-evaluation time.
 *
 * The Application Layer builds this from Cart and Customer aggregates and passes it
 * to PromotionEligibilityPolicy — the Promotion Domain never imports Cart or Customer classes.
 *
 * @param  array<int, array{product_id: string, quantity: int}>  $items
 * @param  string[]  $customerGroups
 */
final readonly class PromotionContext
{
    public function __construct(
        public Money $cartTotal,
        public array $items,
        public ?string $customerId,
        public array $customerGroups,
        public DateTimeImmutable $evaluatedAt,
    ) {}

    public static function of(
        Money $cartTotal,
        array $items,
        ?string $customerId,
        array $customerGroups,
        DateTimeImmutable $evaluatedAt,
    ): self {
        return new self($cartTotal, $items, $customerId, $customerGroups, $evaluatedAt);
    }

    public function totalQuantity(): int
    {
        return (int) array_sum(array_column($this->items, 'quantity'));
    }

    public function quantityOf(string $productId): int
    {
        foreach ($this->items as $item) {
            if ($item['product_id'] === $productId) {
                return $item['quantity'];
            }
        }

        return 0;
    }

    public function hasProduct(string $productId): bool
    {
        return $this->quantityOf($productId) > 0;
    }

    public function isInGroup(string $groupId): bool
    {
        return in_array($groupId, $this->customerGroups, true);
    }

    public function hasCustomer(): bool
    {
        return $this->customerId !== null;
    }
}
