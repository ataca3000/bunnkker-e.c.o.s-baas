<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \Modules\POS\Sale\Domain\Models\Sale
 */
final class SaleResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'receipt_number' => $this->receipt_number,
            'status' => $this->status->value,
            'currency' => $this->currency,
            'lines' => $this->lines,
            'total' => $this->getTotal()->amount,
            'amount_paid' => $this->getAmountPaid()->amount,
            'change_given' => $this->getChangeGiven()->amount,
        ];
    }
}
