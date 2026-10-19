<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\POS\Application\Commands\ReprintReceiptCommand;
use Modules\POS\Application\Commands\VoidReceiptCommand;
use Modules\POS\Application\Services\FindReceiptService;
use Modules\POS\Application\Services\ReprintReceiptService;
use Modules\POS\Application\Services\VoidReceiptService;
use Modules\POS\Presentation\Http\Requests\ReprintReceiptRequest;
use Modules\POS\Presentation\Http\Requests\VoidReceiptRequest;
use Modules\POS\Presentation\Http\Resources\ReceiptResource;

final class ReceiptController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly FindReceiptService $findReceiptService,
        private readonly ReprintReceiptService $reprintReceiptService,
        private readonly VoidReceiptService $voidReceiptService,
    ) {}

    public function show(string $receipt): JsonResponse
    {
        $model = $this->findReceiptService->execute($receipt);

        return $this->success(new ReceiptResource($model));
    }

    public function reprint(string $receipt, ReprintReceiptRequest $request): JsonResponse
    {
        $data = $request->validated();
        $command = new ReprintReceiptCommand(
            receiptId: $receipt,
            cashierId: $data['cashier_id'],
            terminalId: $data['terminal_id'],
            reason: $data['reason'],
        );

        $result = $this->reprintReceiptService->execute($command);

        return $this->success([
            'receipt_id' => $result->receiptId,
            'receipt_number' => $result->receiptNumber,
            'reprint_count' => $result->reprintCount,
        ], 'Receipt reprinted.');
    }

    public function destroy(string $receipt, VoidReceiptRequest $request): JsonResponse
    {
        $data = $request->validated();
        $command = new VoidReceiptCommand(
            receiptId: $receipt,
            cashierId: $data['cashier_id'],
            reason: $data['reason'] ?? '',
        );

        $result = $this->voidReceiptService->execute($command);

        return $this->deleted("Receipt {$result->receiptNumber} voided.");
    }
}
