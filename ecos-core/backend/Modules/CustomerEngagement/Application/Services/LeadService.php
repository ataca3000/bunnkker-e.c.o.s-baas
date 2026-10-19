<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Modules\CustomerEngagement\Domain\Enums\ConversationPriority;
use Modules\CustomerEngagement\Domain\Enums\LeadStatus;
use Modules\CustomerEngagement\Domain\Models\Conversation;
use Modules\CustomerEngagement\Domain\Models\Lead;

class LeadService
{
    public function createFromConversation(Conversation $conv, array $data): Lead
    {
        return Lead::create([
            'conversation_id' => $conv->id,
            'business_dna_id' => $conv->business_dna_id,
            'company_id' => $conv->company_id,
            'brand_id' => $conv->brand_id,
            'channel_id' => $conv->channel_id,
            'customer_name' => $data['customer_name'] ?? $conv->customer_name ?? 'Unknown',
            'customer_phone' => $data['customer_phone'] ?? $conv->customer_phone,
            'customer_email' => $data['customer_email'] ?? $conv->customer_email,
            'status' => LeadStatus::New->value,
            'priority' => $data['priority'] ?? ConversationPriority::Medium->value,
            'source' => $data['source'] ?? $conv->provider->value ?? null,
            'assigned_to' => $data['assigned_to'] ?? $conv->assigned_employee_id,
            'tags' => $data['tags'] ?? [],
            'metadata' => $data['metadata'] ?? null,
        ]);
    }

    public function qualify(Lead $lead, ?string $notes = null): Lead
    {
        $lead->update([
            'status' => LeadStatus::Qualified->value,
            'qualified_at' => now(),
            'qualification_notes' => $notes ?? $lead->qualification_notes,
        ]);

        return $lead->fresh();
    }

    public function disqualify(Lead $lead, string $reason): Lead
    {
        $lead->update([
            'status' => LeadStatus::Unqualified->value,
            'qualification_notes' => $reason,
        ]);

        return $lead->fresh();
    }

    public function markContacted(Lead $lead): Lead
    {
        $lead->update(['status' => LeadStatus::Contacted->value]);

        return $lead->fresh();
    }

    public function convert(Lead $lead, string $entityType, string $entityId): Lead
    {
        $lead->update([
            'status' => LeadStatus::Converted->value,
            'converted_at' => now(),
            'converted_entity_type' => $entityType,
            'converted_entity_id' => $entityId,
        ]);

        return $lead->fresh();
    }

    public function markLost(Lead $lead, string $reason): Lead
    {
        $lead->update([
            'status' => LeadStatus::Lost->value,
            'lost_at' => now(),
            'qualification_notes' => $reason,
        ]);

        return $lead->fresh();
    }

    public function assign(Lead $lead, string $assigneeId): Lead
    {
        $lead->update(['assigned_to' => $assigneeId]);

        return $lead->fresh();
    }

    public function updateScore(Lead $lead, int $score): Lead
    {
        $lead->update(['score' => max(0, min(100, $score))]);

        return $lead->fresh();
    }

    public function search(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $q = Lead::query()->latest();

        if (! empty($filters['company_id'])) {
            $q->where('company_id', $filters['company_id']);
        }
        if (! empty($filters['status'])) {
            $q->where('status', $filters['status']);
        }
        if (! empty($filters['assigned_to'])) {
            $q->where('assigned_to', $filters['assigned_to']);
        }
        if (! empty($filters['search'])) {
            $term = $filters['search'];
            $q->where(function ($sq) use ($term) {
                $sq->where('customer_name', 'like', "%{$term}%")
                    ->orWhere('customer_phone', 'like', "%{$term}%")
                    ->orWhere('customer_email', 'like', "%{$term}%");
            });
        }

        return $q->paginate($perPage);
    }
}
