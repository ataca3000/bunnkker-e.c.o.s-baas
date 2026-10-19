<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class ConversationTask extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'cep_conversation_tasks';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'due_at' => 'datetime',
            'completed_at' => 'datetime',
        ];
    }

    public function isDone(): bool
    {
        return ! is_null($this->completed_at);
    }

    public function isOverdue(): bool
    {
        return ! $this->isDone() && $this->due_at?->isPast();
    }

    public function complete(int $userId): void
    {
        $this->update(['completed_at' => now(), 'completed_by' => $userId]);
    }
}
