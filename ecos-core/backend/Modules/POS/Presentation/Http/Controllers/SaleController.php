<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\ProcessSaleCommand;
use Modules\POS\Application\Services\FindCartService;
use Modules\POS\Application\Services\FindSaleService;
use Modules\POS\Application\Services\ProcessSaleService;
use Modules\POS\Presentation\Http\Requests\ProcessSaleRequest;
use Modules\POS\Presentation\Http\Resources\SaleResource;

final class SaleController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly ProcessSaleService $processSaleService,
        private readonly FindCartService $findCartService,
        private readonly FindSaleService $findSaleService,
    ) {}

    public function store(ProcessSaleRequest $request): JsonResponse
    {
        $data = $request->validated();
        $cart = $this->findCartService->execute($data['cart_id']);

        $payments = array_map(
            static fn (array $tender) => [
                'type' => $tender['method'],
                'amount' => (string) $tender['amount'],
                'currency' => (string) $cart->currency,
                'reference' => $tender['reference'] ?? null,
            ],
            $data['payments'],
        );

        $command = new ProcessSaleCommand(
            cartId: (string) $cart->id,
            sessionId: (string) $cart->session_id,
            shiftId: (string) $cart->shift_id,
            terminalId: (string) $cart->terminal_id,
            cashierId: (string) $cart->cashier_id,
            customerId: $cart->customer_id ? (string) $cart->customer_id : null,
            currency: (string) $cart->currency,
            payments: $payments,
            cashierName: $data['cashier_name'] ?? null,
            customerName: $data['customer_name'] ?? null,
        );

        $result = $this->processSaleService->execute($command);

        return $this->created([
            'sale_id' => $result->saleId,
            'receipt_id' => $result->receiptId,
            'receipt_number' => $result->receiptNumber,
            'total' => $result->totalAmount,
            'amount_paid' => $result->amountPaid,
            'change_given' => $result->changeGiven,
            'currency' => $result->currency,
        ], 'Sale processed.');
    }

    public function show(string $sale): JsonResponse
    {
        $model = $this->findSaleService->execute($sale);

        return $this->success(new SaleResource($model));
    }
}
