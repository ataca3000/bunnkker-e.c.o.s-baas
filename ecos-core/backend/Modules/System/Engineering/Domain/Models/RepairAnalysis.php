<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\System\Engineering\Domain\Enums\RepairApproach;

class RepairAnalysis extends Model
{
    use HasUuids;

    protected $table = 'engineering_repair_analyses';

    protected $keyType = 'string';

    public $incrementing = false;

    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'company_id',
        'failure_category',
        'root_cause',
        'confidence_score',
        'affected_components',
        'evidence',
        'repair_approach',
        'estimated_effort',
        'created_at',
    ];

    protected function casts(): array
    {
        return [
            'repair_approach'      => RepairApproach::class,
            'confidence_score'     => 'float',
            'affected_components'  => 'array',
            'evidence'             => 'array',
            'created_at'           => 'datetime',
        ];
    }

    // Relations

    public function session(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'session_id');
    }
}
