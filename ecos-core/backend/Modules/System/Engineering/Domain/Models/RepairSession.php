<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\RepairFailureType;
use Modules\System\Engineering\Domain\Enums\RepairSessionStatus;

class RepairSession extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'engineering_repair_sessions';

    protected $keyType = 'string';

    public $incrementing = false;

    protected $fillable = [
        'company_id',
        'source_type',
        'source_id',
        'status',
        'failure_type',
        'failure_summary',
        'failure_context',
        'root_cause_category',
        'root_cause_description',
        'retry_count',
        'max_retries',
        'timeout_seconds',
        'timeout_at',
        'started_at',
        'completed_at',
        'failed_reason',
    ];

    protected function casts(): array
    {
        return [
            'status'           => RepairSessionStatus::class,
            'failure_type'     => RepairFailureType::class,
            'failure_context'  => 'array',
            'retry_count'      => 'integer',
            'max_retries'      => 'integer',
            'timeout_seconds'  => 'integer',
            'timeout_at'       => 'datetime',
            'started_at'       => 'datetime',
            'completed_at'     => 'datetime',
        ];
    }

    // Relations

    public function analysis(): HasOne
    {
        return $this->hasOne(RepairAnalysis::class, 'session_id');
    }

    public function prompts(): HasMany
    {
        return $this->hasMany(RepairPrompt::class, 'session_id');
    }

    public function responses(): HasMany
    {
        return $this->hasMany(RepairResponse::class, 'session_id');
    }

    public function patches(): HasMany
    {
        return $this->hasMany(RepairPatch::class, 'session_id');
    }

    public function history(): HasMany
    {
        return $this->hasMany(RepairHistory::class, 'session_id')
            ->orderBy('occurred_at', 'asc');
    }

    public function activePrompt(): HasOne
    {
        return $this->hasOne(RepairPrompt::class, 'session_id')
            ->where('is_active', true);
    }

    // Methods

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }

    public function isTimedOut(): bool
    {
        return $this->timeout_at && now()->isAfter($this->timeout_at);
    }
}
