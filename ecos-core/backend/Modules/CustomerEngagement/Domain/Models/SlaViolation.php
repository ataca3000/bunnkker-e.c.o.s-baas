<?php

declare(strict_types=1);

namespace Modules\CustomerEngagement\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\CustomerEngagement\Domain\Enums\SlaViolationType;

class SlaViolation extends Model
{
    use HasUuids;

    protected $table = 'cep_sla_violations';

    protected $guarded = [];

    protected function casts(): array
    {
        return [
            'violation_type' => SlaViolationType::class,
            'due_at' => 'datetime',
            'breached_at' => 'datetime',
            'resolved_at' => 'datetime',
        ];
    }

    public function conversation(): BelongsTo
    {
        return $this->belongsTo(Conversation::class);
    }

    public function policy(): BelongsTo
    {
        return $this->belongsTo(SlaPolicy::class, 'sla_policy_id');
    }

    public function isBreached(): bool
    {
        return $this->status === 'breached' || ($this->status === 'pending' && now()->gt($this->due_at));
    }
}
