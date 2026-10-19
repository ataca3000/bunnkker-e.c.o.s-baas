<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Modules\System\Engineering\Domain\Enums\RepairResponseType;

class RepairResponse extends Model
{
    protected $table = 'engineering_repair_responses';

    protected $keyType = 'int';

    public $incrementing = true;

    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'prompt_id',
        'response_type',
        'response_content',
        'files_modified',
        'confidence_score',
        'requires_review',
        'received_at',
        'reviewed_by',
        'reviewed_at',
        'review_decision',
    ];

    protected function casts(): array
    {
        return [
            'response_type'    => RepairResponseType::class,
            'files_modified'   => 'array',
            'confidence_score' => 'float',
            'requires_review'  => 'boolean',
            'received_at'      => 'datetime',
            'reviewed_at'      => 'datetime',
        ];
    }

    // Relations

    public function session(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'session_id');
    }

    public function prompt(): BelongsTo
    {
        return $this->belongsTo(RepairPrompt::class, 'prompt_id', 'id');
    }

    public function patch(): HasOne
    {
        return $this->hasOne(RepairPatch::class, 'response_id', 'id');
    }
}
