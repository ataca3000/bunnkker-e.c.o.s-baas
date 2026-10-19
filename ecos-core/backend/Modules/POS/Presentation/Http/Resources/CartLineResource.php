<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\POS\Cart\Domain\ValueObjects\CartLine;

/**
 * @mixin CartLine
 */
final class CartLineResource extends JsonResource
{
    public function __construct(private readonly CartLine $line)
    {
        parent::__construct($line);
    }

    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->line->id,
            'product_id' => $this->line->productId,
            'product_name' => $this->line->productName,
            'sku' => $this->line->sku,
            'quantity' => $this->line->quantity->value(),
            'unit_price' => $this->line->unitPrice->amount(),
            'currency' => $this->line->unitPrice->currency(),
            'discount_type' => $this->line->discountType?->value,
            'discount_value' => $this->line->discountValue,
            'line_total' => $this->line->lineTotal->amount(),
            'sort_order' => $this->line->sortOrder,
        ];
    }
}
