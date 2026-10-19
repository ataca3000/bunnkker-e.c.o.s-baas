<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Presentation\Http\Controllers\Concerns;

use Illuminate\Http\Request;
use Modules\Crm\Customers\Domain\Models\Customer;

/** Shared company/actor resolution and customer lookup for the CRM controllers. */
trait ResolvesCustomerContext
{
    protected function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }

    protected function actorId(Request $request): ?int
    {
        $user = $request->user();

        return $user !== null ? (int) $user->id : null;
    }

    protected function customer(Request $request, string $id): Customer
    {
        return Customer::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();
    }
}
