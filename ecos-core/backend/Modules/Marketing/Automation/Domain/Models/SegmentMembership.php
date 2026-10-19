<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SegmentMembership extends Model
{
    use HasUuids;

    protected $table = 'automation_segment_memberships';

    public $timestamps = false;

    protected $fillable = [
        'segment_id', 'entity_type', 'entity_id', 'is_active', 'removed_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'added_at' => 'datetime',
        'removed_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function segment(): BelongsTo
    {
        return $this->belongsTo(AudienceSegment::class, 'segment_id');
    }
}
