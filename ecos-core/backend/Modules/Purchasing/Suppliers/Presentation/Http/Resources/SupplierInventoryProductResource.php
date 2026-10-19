<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \stdClass
 */
final class SupplierInventoryProductResource extends JsonResource
{
    /**
     * @param  array<string, mixed>  $product
     */
    public function __construct(private readonly array $product)
    {
        parent::__construct($product);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->product;
    }
}
