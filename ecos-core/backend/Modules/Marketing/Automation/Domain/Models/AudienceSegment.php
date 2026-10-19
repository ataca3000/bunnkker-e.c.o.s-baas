<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Marketing\Automation\Domain\Enums\SegmentType;

class AudienceSegment extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'automation_audience_segments';

    protected $fillable = [
        'name', 'description', 'company_id', 'segment_type', 'rules',
        'entity_type', 'member_count', 'is_dynamic', 'is_active',
        'last_calculated_at', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'segment_type' => SegmentType::class,
        'rules' => 'array',
        'is_dynamic' => 'boolean',
        'is_active' => 'boolean',
        'last_calculated_at' => 'datetime',
    ];

    public function memberships(): HasMany
    {
        return $this->hasMany(SegmentMembership::class, 'segment_id')->where('is_active', true);
    }

    public function allMemberships(): HasMany
    {
        return $this->hasMany(SegmentMembership::class, 'segment_id');
    }
}
