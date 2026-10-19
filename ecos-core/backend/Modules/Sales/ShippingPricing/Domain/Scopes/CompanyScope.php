<?php

declare(strict_types=1);

namespace Modules\Sales\ShippingPricing\Domain\Scopes;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Scope;
use Illuminate\Support\Facades\Auth;

/**
 * Automatically scopes ShippingPricingRule queries to the authenticated user's
 * company, while always including global platform rules (company_id IS NULL).
 *
 * Applied as a global scope so no caller can forget to filter by company.
 * No-ops in unauthenticated contexts (seeders, artisan commands).
 */
final class CompanyScope implements Scope
{
    public function apply(Builder $builder, Model $model): void
    {
        if (! Auth::check()) {
            return;
        }

        /** @var string|null $companyId */
        $companyId = Auth::user()?->company_id;

        if ($companyId === null) {
            return;
        }

        $builder->where(function (Builder $q) use ($companyId): void {
            $q->where('company_id', $companyId)
                ->orWhereNull('company_id');
        });
    }
}
