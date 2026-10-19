<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Customers\Domain\Enums\CustomerType;
use Modules\Crm\Customers\Domain\Services\CustomerService;
use Modules\Crm\Sales\Domain\Enums\LeadStatus;
use Modules\Crm\Sales\Domain\Events\LeadConverted;
use Modules\Crm\Sales\Domain\Events\LeadCreated;
use Modules\Crm\Sales\Domain\Events\LeadLost;
use Modules\Crm\Sales\Domain\Events\LeadQualified;
use Modules\Crm\Sales\Domain\Exceptions\SalesException;
use Modules\Crm\Sales\Domain\Models\Lead;
use Modules\Crm\Sales\Domain\Models\Opportunity;

/**
 * Leads and their conversion.
 *
 * ┌─ CONVERSION BRIDGES TO THE CUSTOMER FOUNDATION ─────────────────────────┐
 * │ A lead is a prospect the CRM owns. Converting a qualified lead creates (or │
 * │ links) a customer via C1 and opens an opportunity — the sales relationship │
 * │ becomes a real customer without ever duplicating identity.                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class LeadService
{
    public function __construct(
        private readonly CustomerService $customers,
        private readonly OpportunityService $opportunities,
    ) {}

    /** @param array<string, mixed> $data */
    public function create(string $companyId, array $data, ?int $actorId = null): Lead
    {
        $lead = Lead::create([
            'company_id' => $companyId,
            'name' => $data['name'],
            'phone' => $data['phone'] ?? null,
            'email' => $data['email'] ?? null,
            'company_name' => $data['company_name'] ?? null,
            'source' => $data['source'] ?? null,
            'status' => LeadStatus::New->value,
            'score' => $data['score'] ?? null,
            'owner_id' => $data['owner_id'] ?? $actorId,
            'notes' => $data['notes'] ?? null,
            'tags' => $data['tags'] ?? null,
            'created_by' => $actorId,
        ]);

        DB::afterCommit(static fn () => event(new LeadCreated(
            companyId: $companyId,
            leadId: (string) $lead->id,
            name: $lead->name !== null ? (string) $lead->name : null,
            source: $lead->source !== null ? (string) $lead->source : null,
            actorId: $actorId,
        )));

        return $lead;
    }

    public function setStatus(Lead $lead, LeadStatus $status): Lead
    {
        // status is enum-cast on the model, so read its value rather than casting.
        $previous = $lead->status instanceof LeadStatus
            ? $lead->status->value
            : ($lead->status !== null ? (string) $lead->status : null);

        $lead->update(['status' => $status->value]);
        $fresh = $lead->refresh();

        // Qualified and unqualified are the two moves the business reacts to.
        // Conversion has its own event and is published by convert().
        $event = match ($status) {
            LeadStatus::Qualified => new LeadQualified(
                companyId: (string) $fresh->company_id,
                leadId: (string) $fresh->id,
                previousStatus: $previous,
            ),
            LeadStatus::Unqualified => new LeadLost(
                companyId: (string) $fresh->company_id,
                leadId: (string) $fresh->id,
                previousStatus: $previous,
            ),
            default => null,
        };

        if ($event !== null) {
            DB::afterCommit(static fn () => event($event));
        }

        return $fresh;
    }

    /**
     * Convert a lead: create/link a customer, open an opportunity, and close the
     * lead as converted.
     *
     * @param  array<string, mixed>  $opportunity  name, amount, currency, expected_close_date
     * @return array{lead: Lead, customer_id: string, opportunity: Opportunity}
     */
    public function convert(Lead $lead, array $opportunity, ?int $actorId = null, ?string $existingCustomerId = null): array
    {
        if ($lead->isConverted()) {
            throw SalesException::leadAlreadyConverted($lead->name);
        }

        return DB::transaction(function () use ($lead, $opportunity, $actorId, $existingCustomerId): array {
            $customerId = $existingCustomerId ?? $this->createCustomerFromLead($lead, $actorId);

            $opp = $this->opportunities->create((string) $lead->company_id, array_merge([
                'name' => $opportunity['name'] ?? ($lead->name.' — opportunity'),
                'customer_id' => $customerId,
                'lead_id' => $lead->id,
                'source' => $lead->source,
            ], $opportunity), $actorId);

            $lead->update([
                'status' => LeadStatus::Converted->value,
                'customer_id' => $customerId,
                'converted_opportunity_id' => $opp->id,
                'converted_at' => Carbon::now(),
            ]);

            $fresh = $lead->refresh();

            DB::afterCommit(static fn () => event(new LeadConverted(
                companyId: (string) $fresh->company_id,
                leadId: (string) $fresh->id,
                customerId: (string) $customerId,
                opportunityId: (string) $opp->id,
                actorId: $actorId,
            )));

            return ['lead' => $fresh, 'customer_id' => $customerId, 'opportunity' => $opp];
        });
    }

    private function createCustomerFromLead(Lead $lead, ?int $actorId): string
    {
        $isBusiness = ! empty($lead->company_name);
        $customer = $this->customers->create(
            (string) $lead->company_id,
            $isBusiness ? CustomerType::Business : CustomerType::Individual,
            [
                'business_name' => $lead->company_name,
                'first_name' => $isBusiness ? null : $lead->name,
                'name' => $lead->name,
                'phone' => $lead->phone,
                'email' => $lead->email,
            ],
            $actorId,
        );

        return (string) $customer->id;
    }
}
