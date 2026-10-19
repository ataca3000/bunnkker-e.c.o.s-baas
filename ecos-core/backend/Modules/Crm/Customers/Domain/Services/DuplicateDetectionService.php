<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Services;

use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Models\CustomerEmail;
use Modules\Crm\Customers\Domain\Models\CustomerPhone;

/**
 * Duplicate detection — finds candidate matches for a customer by normalized
 * phone, normalized email and name similarity.
 *
 * Deterministic and explainable: every candidate carries the reason(s) it
 * matched and a confidence score. It only reads; deciding to merge is a separate,
 * permissioned action.
 */
final class DuplicateDetectionService
{
    /**
     * @return list<array<string, mixed>>
     */
    public function candidatesFor(Customer $customer): array
    {
        $phones = $customer->phones()->pluck('normalized')->filter()->all();
        if ($customer->phone !== null) {
            $phones[] = CustomerPhone::normalize($customer->phone);
        }
        $emails = $customer->emails()->pluck('normalized')->filter()->all();
        if ($customer->email !== null) {
            $emails[] = CustomerEmail::normalize($customer->email);
        }

        return $this->candidates(
            (string) $customer->company_id,
            array_values(array_filter(array_unique($phones))),
            array_values(array_filter(array_unique($emails))),
            $customer->displayName(),
            (string) $customer->id,
        );
    }

    /**
     * @param  list<string>  $phones
     * @param  list<string>  $emails
     * @return list<array<string, mixed>>
     */
    public function candidates(string $companyId, array $phones, array $emails, ?string $name, ?string $excludeId = null): array
    {
        $scores = [];
        $reasons = [];

        $consider = function (Customer $c, string $reason, int $score) use (&$scores, &$reasons, $excludeId): void {
            if ($c->id === $excludeId || $c->isArchived() || $c->isMerged()) {
                return;
            }
            $scores[$c->id] = ($scores[$c->id] ?? 0) + $score;
            $reasons[$c->id][$reason] = true;
        };

        if ($phones !== []) {
            Customer::query()->where('company_id', $companyId)
                ->whereHas('phones', fn ($p) => $p->whereIn('normalized', $phones))
                ->get()->each(fn ($c) => $consider($c, 'phone', 60));
        }
        if ($emails !== []) {
            Customer::query()->where('company_id', $companyId)
                ->whereHas('emails', fn ($e) => $e->whereIn('normalized', $emails))
                ->get()->each(fn ($c) => $consider($c, 'email', 50));
        }
        if ($name !== null && trim($name) !== '') {
            Customer::query()->where('company_id', $companyId)
                ->where('name', 'like', '%'.trim($name).'%')
                ->limit(25)->get()->each(fn ($c) => $consider($c, 'name', 15));
        }

        $out = [];
        foreach ($scores as $id => $score) {
            $customer = Customer::find($id);
            if ($customer === null) {
                continue;
            }
            $out[] = [
                'customer_id' => $id,
                'display_name' => $customer->displayName(),
                'code' => $customer->code,
                'score' => min(100, $score),
                'confidence' => $score >= 60 ? 'high' : ($score >= 40 ? 'medium' : 'low'),
                'reasons' => array_keys($reasons[$id]),
            ];
        }

        usort($out, static fn ($a, $b) => $b['score'] <=> $a['score']);

        return $out;
    }
}
