<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Crm\Service\Domain\Enums\NoteVisibility;

/** A note on a ticket — internal (agents) or public (customer-visible). */
class TicketNote extends Model
{
    use HasUuids;

    protected $table = 'crm_service_ticket_notes';

    protected $fillable = ['ticket_id', 'visibility', 'body', 'author_id'];

    protected function casts(): array
    {
        return ['visibility' => NoteVisibility::class];
    }

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'ticket_id');
    }
}
