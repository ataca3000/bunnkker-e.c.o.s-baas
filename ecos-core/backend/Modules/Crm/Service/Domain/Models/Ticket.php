<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Modules\Crm\Service\Domain\Enums\TicketPriority;
use Modules\Crm\Service\Domain\Enums\TicketStatus;
use Modules\Crm\Service\Domain\Enums\TicketType;

/**
 * A service case — ticket, complaint, service request, RMA return or warranty.
 *
 * ┌─ THE CRM OWNS THE CASE, NOT THE OPERATION ──────────────────────────────┐
 * │ Belongs to a customer; may reference an order/product/shipment by opaque   │
 * │ id in source_reference. It carries its SLA clock, assignment, escalation    │
 * │ and resolution state. It never owns Finance/Inventory/Shipping data.       │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class Ticket extends Model
{
    use HasUuids;

    protected $table = 'crm_service_tickets';

    protected $fillable = [
        'company_id', 'customer_id', 'ticket_number', 'type', 'subject', 'description',
        'status', 'priority', 'channel', 'category', 'sla_policy_id', 'assignee_id', 'team_id',
        'first_response_due_at', 'resolution_due_at', 'first_responded_at', 'resolved_at', 'closed_at',
        'first_response_breached', 'resolution_breached', 'reopened_count', 'escalation_level',
        'escalated_at', 'satisfaction_rating', 'source_reference', 'tags', 'created_by',
    ];

    protected function casts(): array
    {
        return [
            'type' => TicketType::class,
            'status' => TicketStatus::class,
            'priority' => TicketPriority::class,
            'first_response_due_at' => 'datetime',
            'resolution_due_at' => 'datetime',
            'first_responded_at' => 'datetime',
            'resolved_at' => 'datetime',
            'closed_at' => 'datetime',
            'escalated_at' => 'datetime',
            'first_response_breached' => 'boolean',
            'resolution_breached' => 'boolean',
            'source_reference' => 'array',
            'tags' => 'array',
        ];
    }

    public function notes(): HasMany
    {
        return $this->hasMany(TicketNote::class, 'ticket_id');
    }

    public function attachments(): HasMany
    {
        return $this->hasMany(TicketAttachment::class, 'ticket_id');
    }

    public function events(): HasMany
    {
        return $this->hasMany(TicketEvent::class, 'ticket_id');
    }

    public function slaPolicy(): BelongsTo
    {
        return $this->belongsTo(SlaPolicy::class, 'sla_policy_id');
    }

    public function isOpen(): bool
    {
        return $this->status->isOpen();
    }
}
