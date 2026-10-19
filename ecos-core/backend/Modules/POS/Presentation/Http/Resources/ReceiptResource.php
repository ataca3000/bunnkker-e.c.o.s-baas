<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \Modules\POS\Receipt\Domain\Models\Receipt
 */
final class ReceiptResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'receipt_number' => $this->receipt_number,
            'type' => $this->type->value,
            'status' => $this->status->value,
            'original_transaction_id' => $this->original_transaction_id,
            'original_transaction_number' => $this->original_transaction_number,
            'terminal_id' => $this->terminal_id,
            'cashier_id' => $this->cashier_id,
            'cashier_name' => $this->cashier_name,
            'customer_id' => $this->customer_id,
            'customer_name' => $this->customer_name,
            'currency' => $this->currency,
            'line_items' => $this->line_items,
            'totals' => $this->totals,
            'payments' => $this->payments,
            'issued_at' => $this->issued_at?->toIso8601String(),
            'reprint_count' => $this->reprint_count,
        ];
    }
}
