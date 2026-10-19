<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** An append-only audit event on a ticket — the case's own timeline. */
class TicketEvent extends Model
{
    use HasUuids;

    protected $table = 'crm_service_ticket_events';

    protected $fillable = ['ticket_id', 'event_type', 'from_value', 'to_value', 'note', 'actor_id', 'occurred_at'];

    protected function casts(): array
    {
        return ['occurred_at' => 'datetime'];
    }

    protected static function booted(): void
    {
        static::updating(static fn (): bool => false);
        static::deleting(static fn (): bool => false);
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'ticket_id');
    }
}
