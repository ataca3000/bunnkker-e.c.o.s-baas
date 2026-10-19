<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Customers\Domain\Enums\CustomerStatus;
use Modules\Crm\Customers\Domain\Events\CustomerMerged;
use Modules\Crm\Customers\Domain\Exceptions\CustomerException;
use Modules\Crm\Customers\Domain\Models\Customer;
use Modules\Crm\Customers\Domain\Models\CustomerAddress;
use Modules\Crm\Customers\Domain\Models\CustomerDocument;
use Modules\Crm\Customers\Domain\Models\CustomerEmail;
use Modules\Crm\Customers\Domain\Models\CustomerMerge;
use Modules\Crm\Customers\Domain\Models\CustomerNote;
use Modules\Crm\Customers\Domain\Models\CustomerPhone;
use Modules\Crm\Customers\Domain\Models\CustomerPreference;

/**
 * Customer merge — resolves two records that are the same person into one.
 *
 * ┌─ THE SURVIVOR KEEPS EVERYTHING · THE OTHER IS NEVER DELETED ────────────┐
 * │ All contacts, addresses, notes, documents, preferences and tags move to    │
 * │ the survivor; the merged record is ARCHIVED with `merged_into_id` pointing  │
 * │ at the survivor, so orders/finance that reference its id still resolve      │
 * │ (via resolve()). Deletion is never used — a merged party may be referenced  │
 * │ by immutable financial records. The merge is recorded immutably.           │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class CustomerMergeService
{
    public function merge(Customer $surviving, Customer $merged, ?int $actorId = null): Customer
    {
        if ($surviving->id === $merged->id) {
            throw CustomerException::cannotMergeIntoSelf();
        }
        if ((string) $surviving->company_id !== (string) $merged->company_id) {
            throw CustomerException::crossCompanyMerge();
        }
        if ($surviving->isArchived() || $surviving->isMerged()) {
            throw CustomerException::cannotMergeArchived();
        }

        return DB::transaction(function () use ($surviving, $merged, $actorId): Customer {
            $summary = [
                'phones' => $this->movePhones($surviving, $merged),
                'emails' => $this->moveEmails($surviving, $merged),
                'addresses' => CustomerAddress::query()->where('customer_id', $merged->id)->update(['customer_id' => $surviving->id, 'is_default' => false]),
                'notes' => CustomerNote::query()->where('customer_id', $merged->id)->update(['customer_id' => $surviving->id]),
                'documents' => CustomerDocument::query()->where('customer_id', $merged->id)->update(['customer_id' => $surviving->id]),
                'preferences' => $this->movePreferences($surviving, $merged),
                'tags' => $this->moveTags($surviving, $merged),
            ];

            $merged->update([
                'status' => CustomerStatus::Archived->value,
                'is_active' => false,
                'merged_into_id' => $surviving->id,
                'archived_at' => Carbon::now(),
                'archived_by' => $actorId,
            ]);

            CustomerMerge::create([
                'company_id' => $surviving->company_id,
                'surviving_customer_id' => $surviving->id,
                'merged_customer_id' => $merged->id,
                'summary' => $summary,
                'performed_by' => $actorId,
                'performed_at' => Carbon::now(),
            ]);

            $fresh = $surviving->refresh();

            // Carries both ids: anything holding the losing id must repoint to
            // the winner, and it cannot work that out from the winner alone.
            DB::afterCommit(static fn () => event(new CustomerMerged(
                companyId: (string) $fresh->company_id,
                winnerCustomerId: (string) $fresh->id,
                loserCustomerId: (string) $merged->id,
                actorId: $actorId,
            )));

            return $fresh;
        });
    }

    /** Follow the merge chain to the surviving customer (or return the same one). */
    public function resolve(Customer $customer): Customer
    {
        $seen = [];
        while ($customer->merged_into_id !== null && ! isset($seen[$customer->id])) {
            $seen[$customer->id] = true;
            $next = Customer::find($customer->merged_into_id);
            if ($next === null) {
                break;
            }
            $customer = $next;
        }

        return $customer;
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function movePhones(Customer $surviving, Customer $merged): int
    {
        return CustomerPhone::query()->where('customer_id', $merged->id)
            ->update(['customer_id' => $surviving->id, 'is_primary' => false]);
    }

    private function moveEmails(Customer $surviving, Customer $merged): int
    {
        return CustomerEmail::query()->where('customer_id', $merged->id)
            ->update(['customer_id' => $surviving->id, 'is_primary' => false]);
    }

    private function movePreferences(Customer $surviving, Customer $merged): int
    {
        $existingKeys = CustomerPreference::query()->where('customer_id', $surviving->id)->pluck('key')->all();

        return CustomerPreference::query()
            ->where('customer_id', $merged->id)
            ->whereNotIn('key', $existingKeys)
            ->update(['customer_id' => $surviving->id]);
    }

    private function moveTags(Customer $surviving, Customer $merged): int
    {
        $tagIds = $merged->tags()->pluck('crm_customer_tags.id')->all();
        $surviving->tags()->syncWithoutDetaching($tagIds);
        $merged->tags()->detach();

        return count($tagIds);
    }
}
