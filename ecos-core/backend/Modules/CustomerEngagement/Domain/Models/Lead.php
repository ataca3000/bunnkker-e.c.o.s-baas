<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\CustomerEngagement\Domain\Enums\ConversationPriority;
use Modules\CustomerEngagement\Domain\Enums\LeadStatus;

class Lead extends Model
{
    use HasUuids;

    protected $table = 'cep_leads';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'status' => LeadStatus::class,
            'priority' => ConversationPriority::class,
            'tags' => 'array',
            'metadata' => 'array',
            'score' => 'integer',
            'qualified_at' => 'datetime',
            'converted_at' => 'datetime',
            'lost_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function isConvertible(): bool
    {
        return $this->status === LeadStatus::Qualified;
    }
}
