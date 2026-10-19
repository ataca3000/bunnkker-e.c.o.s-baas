<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\AddCartLineCommand;
use Modules\POS\Application\Commands\RemoveCartLineCommand;
use Modules\POS\Application\Services\AddCartLineService;
use Modules\POS\Application\Services\RemoveCartLineService;
use Modules\POS\Presentation\Http\Requests\AddCartLineRequest;

final class CartLineController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly AddCartLineService $addCartLineService,
        private readonly RemoveCartLineService $removeCartLineService,
    ) {}

    public function store(string $cart, AddCartLineRequest $request): JsonResponse
    {
        $data = $request->validated();
        $command = new AddCartLineCommand(
            cartId: $cart,
            productId: $data['product_id'],
            productName: $data['product_name'],
            sku: $data['sku'],
            quantity: (string) $data['quantity'],
            unitPrice: (string) $data['unit_price'],
            currency: $data['currency'],
            discountType: $data['discount_type'] ?? null,
            discountValue: isset($data['discount_value']) ? (string) $data['discount_value'] : null,
        );

        $result = $this->addCartLineService->execute($command);

        return $this->created($result->toArray(), 'Line added to cart.');
    }

    public function destroy(string $cart, string $line): JsonResponse
    {
        $command = new RemoveCartLineCommand(cartId: $cart, lineId: $line);
        $this->removeCartLineService->execute($command);

        return $this->deleted('Line removed from cart.');
    }
}
