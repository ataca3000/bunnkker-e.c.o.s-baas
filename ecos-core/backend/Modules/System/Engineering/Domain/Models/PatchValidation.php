<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\System\Engineering\Domain\Enums\PatchValidationStatus;
use Modules\System\Engineering\Domain\Enums\ValidationVerdict;

class PatchValidation extends Model
{
    use HasUuids;
    use SoftDeletes;

    protected $table = 'engineering_patch_validations';

    protected $fillable = [
        'company_id',
        'patch_id',
        'session_id',
        'attempt_number',
        'status',
        'verdict',
        'total_steps',
        'passed_steps',
        'failed_steps',
        'skipped_steps',
        'is_blocking_failure',
        'triggered_by',
        'started_at',
        'completed_at',
        'failure_summary',
    ];

    protected function casts(): array
    {
        return [
            'status'              => PatchValidationStatus::class,
            'verdict'             => ValidationVerdict::class,
            'attempt_number'      => 'integer',
            'total_steps'         => 'integer',
            'passed_steps'        => 'integer',
            'failed_steps'        => 'integer',
            'skipped_steps'       => 'integer',
            'is_blocking_failure' => 'boolean',
            'started_at'          => 'datetime',
            'completed_at'        => 'datetime',
        ];
    }

    public function patch(): BelongsTo
    {
        return $this->belongsTo(RepairPatch::class, 'patch_id');
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'session_id');
    }

    public function steps(): HasMany
    {
        return $this->hasMany(ValidationStep::class, 'validation_id')->orderBy('sequence', 'asc');
    }

    public function report(): HasOne
    {
        return $this->hasOne(ValidationReport::class, 'validation_id');
    }

    public function isTerminal(): bool
    {
        return $this->status->isTerminal();
    }
}
