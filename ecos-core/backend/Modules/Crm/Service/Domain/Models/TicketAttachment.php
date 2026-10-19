<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** Metadata for a file attached to a ticket. */
class TicketAttachment extends Model
{
    use HasUuids;

    protected $table = 'crm_service_ticket_attachments';

    protected $fillable = ['ticket_id', 'name', 'file_path', 'mime_type', 'size_bytes', 'visibility', 'uploaded_by'];

    public function ticket(): BelongsTo
    {
        return $this->belongsTo(Ticket::class, 'ticket_id');
    }
}
