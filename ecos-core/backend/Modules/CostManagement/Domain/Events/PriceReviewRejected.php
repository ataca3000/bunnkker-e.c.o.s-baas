<?php

declare(strict_types=1);

namespace Modules\CostManagement\Domain\Events;

use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

final class PriceReviewRejected
{
    use Dispatchable, SerializesModels;

    public function __construct(
        public readonly string $reviewId,
        public readonly string $productId,
        public readonly string $companyId,
        public readonly string $reviewerId,
        public readonly ?string $notes,
    ) {}
}
