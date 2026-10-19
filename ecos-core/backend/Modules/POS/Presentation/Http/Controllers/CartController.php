<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\OpenCartCommand;
use Modules\POS\Application\Commands\SetCartCustomerCommand;
use Modules\POS\Application\Services\CancelCartService;
use Modules\POS\Application\Services\FindCartService;
use Modules\POS\Application\Services\HoldCartService;
use Modules\POS\Application\Services\OpenCartService;
use Modules\POS\Application\Services\ResumeCartService;
use Modules\POS\Application\Services\SetCartCustomerService;
use Modules\POS\Presentation\Http\Requests\OpenCartRequest;
use Modules\POS\Presentation\Http\Requests\SetCartCustomerRequest;
use Modules\POS\Presentation\Http\Resources\CartResource;

final class CartController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly OpenCartService $openCartService,
        private readonly FindCartService $findCartService,
        private readonly HoldCartService $holdCartService,
        private readonly ResumeCartService $resumeCartService,
        private readonly CancelCartService $cancelCartService,
        private readonly SetCartCustomerService $setCartCustomerService,
    ) {}

    public function store(OpenCartRequest $request): JsonResponse
    {
        $data = $request->validated();
        $command = new OpenCartCommand(
            sessionId: $data['session_id'],
            shiftId: $data['shift_id'],
            terminalId: $data['terminal_id'],
            cashierId: $data['cashier_id'],
            currency: $data['currency'],
            customerId: $data['customer_id'] ?? null,
        );

        $result = $this->openCartService->execute($command);
        $cart = $this->findCartService->execute($result->cartId);

        return $this->created(new CartResource($cart), 'Cart opened.');
    }

    public function show(string $cart): JsonResponse
    {
        $model = $this->findCartService->execute($cart);

        return $this->success(new CartResource($model));
    }

    public function hold(string $cart): JsonResponse
    {
        $this->holdCartService->execute($cart);

        return $this->success(null, 'Cart placed on hold.');
    }

    public function resume(string $cart): JsonResponse
    {
        $this->resumeCartService->execute($cart);

        return $this->success(null, 'Cart resumed.');
    }

    public function setCustomer(SetCartCustomerRequest $request, string $cart): JsonResponse
    {
        $data = $request->validated();
        $updated = $this->setCartCustomerService->execute(
            new SetCartCustomerCommand(
                cartId: $cart,
                customerId: $data['customer_id'] ?? null,
            ),
        );

        return $this->success(new CartResource($updated), 'Cart customer updated.');
    }

    public function destroy(string $cart): JsonResponse
    {
        $this->cancelCartService->execute($cart);

        return $this->deleted('Cart cancelled.');
    }
}
