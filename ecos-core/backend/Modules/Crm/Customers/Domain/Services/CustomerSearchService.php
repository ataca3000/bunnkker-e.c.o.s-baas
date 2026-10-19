<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Models\CustomerPhone;

/**
 * Customer search — across name, code, phone, email, tag, group, status and type.
 * Read-only; matches against the master and the contact sub-tables (including
 * secondary phones/emails), so a customer is found by any of their numbers.
 */
final class CustomerSearchService
{
    /**
     * @param  array<string, mixed>  $filters  q, status, type, group_id, tag_id, per_page
     */
    public function search(string $companyId, array $filters): LengthAwarePaginator
    {
        $query = Customer::query()
            ->where('company_id', $companyId)
            ->with('group');

        if (! empty($filters['q'])) {
            $term = (string) $filters['q'];
            $digits = preg_replace('/\D+/', '', $term);

            $query->where(function ($w) use ($term, $digits): void {
                $w->where('name', 'like', "%{$term}%")
                    ->orWhere('code', 'like', "%{$term}%")
                    ->orWhere('business_name', 'like', "%{$term}%")
                    ->orWhere('email', 'like', "%{$term}%")
                    ->orWhere('phone', 'like', "%{$term}%")
                    ->orWhere('mobile', 'like', "%{$term}%")
                    ->orWhereHas('emails', fn ($e) => $e->where('normalized', 'like', '%'.mb_strtolower($term).'%'));

                if ($digits !== '') {
                    $w->orWhereHas('phones', fn ($p) => $p->where('normalized', 'like', "%{$digits}%"));
                }
            });
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }
        if (! empty($filters['type'])) {
            $query->where('customer_type', $filters['type']);
        }
        if (! empty($filters['group_id'])) {
            $query->where('customer_group_id', $filters['group_id']);
        }
        if (! empty($filters['tag_id'])) {
            $query->whereHas('tags', fn ($t) => $t->where('crm_customer_tags.id', $filters['tag_id']));
        }

        return $query->latest('created_at')->paginate((int) ($filters['per_page'] ?? 25));
    }

    /** Exact resolution by phone — the fast path for POS/call-center lookups. */
    public function findByPhone(string $companyId, string $phone): ?Customer
    {
        $normalized = CustomerPhone::normalize($phone);
        if ($normalized === null) {
            return null;
        }

        return Customer::query()
            ->where('company_id', $companyId)
            ->whereHas('phones', fn ($p) => $p->where('normalized', $normalized))
            ->first();
    }
}
