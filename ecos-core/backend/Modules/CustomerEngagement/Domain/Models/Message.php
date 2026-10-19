<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\CustomerEngagement\Domain\Enums\MessageDirection;
use Modules\CustomerEngagement\Domain\Enums\MessageType;

class Message extends Model
{
    use HasUuids;

    protected $table = 'cep_messages';

    public $timestamps = false;

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'direction' => MessageDirection::class,
            'message_type' => MessageType::class,
            'metadata' => 'array',
            'is_read' => 'boolean',
            'is_deleted' => 'boolean',
            'sent_at' => 'datetime',
            'delivered_at' => 'datetime',
            'read_at' => 'datetime',
            'failed_at' => 'datetime',
            'created_at' => 'datetime',
            'media_size' => 'integer',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function isInbound(): bool
    {
        return $this->direction === MessageDirection::Inbound;
    }
}
