<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;

class GovernancePolicy extends Model
{
    use HasUuids;

    protected $table = 'marketing_governance_policies';

    protected $fillable = [
        'company_id', 'name', 'description',
        'naming_pattern', 'naming_example',
        'min_daily_budget', 'max_daily_budget', 'min_lifetime_budget', 'max_lifetime_budget',
        'required_utm_params', 'required_assets',
        'pixel_required', 'approval_required',
        'publishing_windows', 'blocked_publishing_days',
        'allowed_objectives', 'brand_restrictions', 'audience_restrictions',
        'max_audience_age_gap', 'is_active', 'is_default',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'required_utm_params' => 'array',
        'required_assets' => 'array',
        'publishing_windows' => 'array',
        'blocked_publishing_days' => 'array',
        'allowed_objectives' => 'array',
        'brand_restrictions' => 'array',
        'audience_restrictions' => 'array',
        'pixel_required' => 'boolean',
        'approval_required' => 'boolean',
        'is_active' => 'boolean',
        'is_default' => 'boolean',
        'min_daily_budget' => 'decimal:2',
        'max_daily_budget' => 'decimal:2',
        'min_lifetime_budget' => 'decimal:2',
        'max_lifetime_budget' => 'decimal:2',
    ];
}
