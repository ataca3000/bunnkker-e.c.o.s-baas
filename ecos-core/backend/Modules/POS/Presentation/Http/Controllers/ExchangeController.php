<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\ProcessExchangeCommand;
use Modules\POS\Application\Services\FindSaleService;
use Modules\POS\Application\Services\ProcessExchangeService;
use Modules\POS\Presentation\Http\Requests\ProcessExchangeRequest;

final class ExchangeController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly ProcessExchangeService $processExchangeService,
        private readonly FindSaleService $findSaleService,
    ) {}

    public function store(ProcessExchangeRequest $request): JsonResponse
    {
        $data = $request->validated();
        $sale = $this->findSaleService->execute($data['original_sale_id']);

        $command = new ProcessExchangeCommand(
            originalSaleId: (string) $sale->id,
            originalSaleNumber: (string) $sale->receipt_number,
            sessionId: (string) $sale->session_id,
            shiftId: (string) $sale->shift_id,
            terminalId: (string) $sale->terminal_id,
            cashierId: $data['cashier_id'],
            customerId: $sale->customer_id ? (string) $sale->customer_id : null,
            currency: $data['currency'],
            returnedLines: $data['returned_lines'],
            replacementLines: $data['replacement_lines'],
            reason: $data['reason'],
            notes: $data['notes'] ?? null,
            cashierName: $data['cashier_name'] ?? null,
            customerName: $data['customer_name'] ?? null,
        );

        $result = $this->processExchangeService->execute($command);

        return $this->created([
            'exchange_id' => $result->exchangeId,
            'exchange_number' => $result->exchangeNumber,
            'receipt_id' => $result->receiptId,
            'receipt_number' => $result->receiptNumber,
        ], 'Exchange processed.');
    }
}
