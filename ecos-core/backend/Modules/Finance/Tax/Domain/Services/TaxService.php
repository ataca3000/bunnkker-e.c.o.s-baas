<?php

declare(strict_types=1);

namespace Modules\Finance\Tax\Domain\Services;

use Modules\Finance\Tax\Domain\Models\TaxCategory;
use Modules\Finance\Tax\Domain\Models\TaxCode;

/**
 * Tax master data — categories and codes. The VAT foundation; ETA e-invoicing
 * is out of F1 scope.
 */
class TaxService
{
    /** @param array<string, mixed> $attributes */
    public function createCategory(array $attributes): TaxCategory
    {
        return TaxCategory::create($attributes)->refresh();
    }

    /** @param array<string, mixed> $attributes */
    public function createCode(array $attributes): TaxCode
    {
        // A code inherits recoverability from its category unless overridden.
        if (! array_key_exists('is_recoverable', $attributes) && isset($attributes['tax_category_id'])) {
            $category = TaxCategory::find($attributes['tax_category_id']);
            $attributes['is_recoverable'] = $category?->is_recoverable ?? true;
        }

        return TaxCode::create($attributes)->refresh();
    }
}
