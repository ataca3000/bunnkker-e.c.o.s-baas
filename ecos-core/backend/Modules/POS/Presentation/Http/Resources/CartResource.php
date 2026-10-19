<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \Modules\POS\Cart\Domain\Models\Cart
 */
final class CartResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        $lines = array_map(
            static fn ($line) => (new CartLineResource($line))->toArray($request),
            $this->getLines(),
        );

        return [
            'id' => $this->id,
            'session_id' => $this->session_id,
            'shift_id' => $this->shift_id,
            'terminal_id' => $this->terminal_id,
            'cashier_id' => $this->cashier_id,
            'customer_id' => $this->customer_id,
            'status' => $this->status->value,
            'currency' => $this->currency,
            'lines' => $lines,
            'subtotal' => $this->getSubtotal()->toArray(),
            'discount_total' => $this->getDiscountTotal()->toArray(),
            'total' => $this->getTotal()->toArray(),
            'notes' => $this->notes,
            'held_at' => $this->held_at?->toISOString(),
        ];
    }
}
