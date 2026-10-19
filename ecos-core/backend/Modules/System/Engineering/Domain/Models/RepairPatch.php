<?php

namespace Modules\System\Engineering\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class RepairPatch extends Model
{
    use HasUuids;

    protected $table = 'engineering_repair_patches';

    public $timestamps = false;

    protected $fillable = [
        'session_id',
        'company_id',
        'response_id',
        'patch_content',
        'patch_format',
        'files_affected',
        'lines_added',
        'lines_removed',
        'is_applied',
        'applied_at',
        'applied_by',
        'verification_status',
        'created_at',
    ];

    public function casts(): array
    {
        return [
            'files_affected' => 'array',
            'lines_added'    => 'integer',
            'lines_removed'  => 'integer',
            'is_applied'     => 'boolean',
            'applied_at'     => 'datetime',
            'created_at'     => 'datetime',
        ];
    }

    public function session(): BelongsTo
    {
        return $this->belongsTo(RepairSession::class, 'session_id');
    }

    public function response(): BelongsTo
    {
        return $this->belongsTo(RepairResponse::class, 'response_id', 'id');
    }
}
