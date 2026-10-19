<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Modules\Marketing\CampaignStudio\Domain\Enums\ValidationSeverity;

class CampaignValidationResult extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_validation_results';

    public $timestamps = false;

    protected $fillable = [
        'campaign_draft_id', 'validation_type', 'severity',
        'message', 'field_path', 'context',
        'is_resolved', 'resolved_at', 'validated_at', 'created_at',
    ];

    protected $casts = [
        'severity' => ValidationSeverity::class,
        'context' => 'array',
        'is_resolved' => 'boolean',
        'resolved_at' => 'datetime',
        'validated_at' => 'datetime',
        'created_at' => 'datetime',
    ];

    public function draft(): BelongsTo
    {
        return $this->belongsTo(CampaignDraft::class, 'campaign_draft_id');
    }
}
