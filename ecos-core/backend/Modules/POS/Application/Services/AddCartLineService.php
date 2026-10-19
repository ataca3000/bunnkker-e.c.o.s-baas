<?php

declare(strict_types=1);

namespace Modules\POS\Application\Services;

use Modules\POS\Application\Commands\AddCartLineCommand;
use Modules\POS\Application\Exceptions\CartNotFoundException;
use Modules\POS\Application\Results\AddCartLineResult;
use Modules\POS\Cart\Domain\Contracts\CartRepositoryInterface;
use Modules\POS\Shared\Domain\Enums\DiscountType;
use Modules\POS\Shared\Domain\ValueObjects\Money;
use Modules\POS\Shared\Domain\ValueObjects\Quantity;

final class AddCartLineService
{
    public function __construct(
        private readonly CartRepositoryInterface $cartRepo,
    ) {}

    public function execute(AddCartLineCommand $command): AddCartLineResult
    {
        $cart = $this->cartRepo->findById($command->cartId);

        if ($cart === null) {
            throw CartNotFoundException::withId($command->cartId);
        }

        $discountType = $command->discountType !== null
            ? DiscountType::from($command->discountType)
            : null;

        $lineId = $cart->addLine(
            productId: $command->productId,
            productName: $command->productName,
            sku: $command->sku,
            quantity: Quantity::of($command->quantity),
            unitPrice: Money::of($command->unitPrice, $command->currency),
            discountType: $discountType,
            discountValue: $command->discountValue,
        );

        $this->cartRepo->save($cart);

        return new AddCartLineResult(
            cartId: (string) $cart->id,
            lineId: $lineId,
        );
    }
}
