<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

/**
 * @mixin \stdClass
 */
final class SupplierAnalyticsResource extends JsonResource
{
    /**
     * @param  array<string, mixed>  $analytics
     */
    public function __construct(private readonly array $analytics)
    {
        parent::__construct($analytics);
    }

    /**
     * @return array<string, mixed>
     */
    public function toArray(Request $request): array
    {
        return $this->analytics;
    }
}
