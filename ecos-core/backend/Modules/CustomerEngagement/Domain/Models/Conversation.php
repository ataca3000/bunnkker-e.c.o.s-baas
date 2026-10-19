<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\CustomerEngagement\Domain\Enums\CommunicationProvider;
use Modules\CustomerEngagement\Domain\Enums\ConversationPriority;
use Modules\CustomerEngagement\Domain\Enums\ConversationStatus;

class Conversation extends Model
{
    use HasUuids;

    protected $table = 'cep_conversations';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => ConversationStatus::class,
            'priority' => ConversationPriority::class,
            'provider' => CommunicationProvider::class,
            'tags' => 'array',
            'sentiment' => 'array',
            'metadata' => 'array',
            'first_response_at' => 'datetime',
            'last_message_at' => 'datetime',
            'last_agent_message_at' => 'datetime',
            'started_at' => 'datetime',
            'closed_at' => 'datetime',
            'messages_count' => 'integer',
            'unread_count' => 'integer',
            'internal_notes_count' => 'integer',
        ];
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('sent_at');
    }

    public function privateNotes(): HasMany
    {
        return $this->hasMany(PrivateNote::class)->latest();
    }

    public function assignmentLogs(): HasMany
    {
        return $this->hasMany(AssignmentLog::class)->latest();
    }

    public function slaViolations(): HasMany
    {
        return $this->hasMany(SlaViolation::class);
    }

    public function slaPolicy(): \Illuminate\Database\Eloquent\Relations\BelongsTo
    {
        return $this->belongsTo(SlaPolicy::class, 'sla_policy_id');
    }

    public function lead(): HasOne
    {
        return $this->hasOne(Lead::class);
    }

    public function isOpen(): bool
    {
        return ! $this->status->isTerminal();
    }
}
