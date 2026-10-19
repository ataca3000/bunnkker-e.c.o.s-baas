<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\ProcessReturnCommand;
use Modules\POS\Application\Services\FindSaleService;
use Modules\POS\Application\Services\ProcessReturnService;
use Modules\POS\Presentation\Http\Requests\ProcessReturnRequest;

final class ReturnController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly ProcessReturnService $processReturnService,
        private readonly FindSaleService $findSaleService,
    ) {}

    public function store(ProcessReturnRequest $request): JsonResponse
    {
        $data = $request->validated();
        $sale = $this->findSaleService->execute($data['sale_id']);

        $command = new ProcessReturnCommand(
            saleId: (string) $sale->id,
            originalReceiptNumber: (string) $sale->receipt_number,
            sessionId: (string) $sale->session_id,
            shiftId: (string) $sale->shift_id,
            terminalId: (string) $sale->terminal_id,
            cashierId: $data['cashier_id'],
            customerId: $sale->customer_id ? (string) $sale->customer_id : null,
            currency: $data['currency'],
            lines: $data['lines'],
            refundTotalAmount: (string) $data['refund_total'],
            refundMethod: $data['refund_method'],
            notes: $data['notes'] ?? null,
            cashierName: $data['cashier_name'] ?? null,
            customerName: $data['customer_name'] ?? null,
        );

        $result = $this->processReturnService->execute($command);

        return $this->created([
            'return_id' => $result->returnId,
            'return_number' => $result->returnNumber,
            'receipt_id' => $result->receiptId,
            'receipt_number' => $result->receiptNumber,
            'refund_amount' => $result->refundAmount,
            'currency' => $result->currency,
        ], 'Return processed.');
    }
}
