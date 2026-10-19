<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Modules\Logistics\Operations\Domain\Models\OperationalException;

/**
 * @mixin OperationalException
 */
class OperationalExceptionResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->uuid,
            'company_id' => $this->company_id,

            // Where it must be fixed. Always shown, because Operations cannot
            // clear another module's fact and an operator needs to know that
            // before trying.
            'source' => $this->source->value,
            'source_label' => $this->source->label(),
            'is_self_owned' => $this->isSelfOwned(),

            'category' => $this->category->value,
            'category_label' => $this->category->label(),
            'exception_type' => $this->exception_type,

            'severity' => $this->severity->value,
            'severity_label' => $this->severity->label(),
            'severity_tone' => $this->severity->tone(),

            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_tone' => $this->status->tone(),
            'is_outstanding' => $this->isOutstanding(),
            'needs_attention' => $this->needsAttention(),
            'allowed_transitions' => array_map(
                static fn ($s) => ['value' => $s->value, 'label' => $s->label()],
                $this->status->allowedTransitions(),
            ),

            'title' => $this->title,
            'description' => $this->description,
            'context' => $this->context ?? [],

            'subject_type' => $this->subject_type,
            'subject_id' => $this->subject_id,
            // A pointer to the Phase 3 conflict, not a copy of its judgement.
            'source_conflict_id' => $this->whenLoaded(
                'sourceConflict',
                fn () => $this->sourceConflict?->uuid,
            ),

            // How many times this same problem has been observed. The count is
            // the information; four hundred rows would not be.
            'occurrence_count' => $this->occurrence_count,
            'is_recurring' => $this->occurrence_count > 1,

            'first_seen_at' => $this->first_seen_at?->toIso8601String(),
            'last_seen_at' => $this->last_seen_at?->toIso8601String(),
            'age_minutes' => $this->ageMinutes(),
            'unacknowledged_minutes' => $this->unacknowledgedMinutes(),
            'is_overdue_for_escalation' => $this->isOverdueForEscalation(),

            'acknowledged_at' => $this->acknowledged_at?->toIso8601String(),
            'acknowledged_by_name' => $this->acknowledged_by_name,

            'escalation_level' => $this->escalation_level,

            'resolved_at' => $this->resolved_at?->toIso8601String(),
            'resolved_by_name' => $this->resolved_by_name,
            'resolution' => $this->resolution,
            'resolution_reason' => $this->resolution_reason,

            'note_count' => $this->whenCounted('notes'),
        ];
    }
}
