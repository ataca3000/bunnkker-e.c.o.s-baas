<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\Marketing\CampaignStudio\Domain\Enums\TemplateCategory;

class CampaignTemplate extends Model
{
    use HasUuids;

    protected $table = 'marketing_campaign_templates';

    protected $fillable = [
        'company_id', 'name', 'description', 'category', 'preview_image_url',
        'default_objective', 'default_buying_type', 'default_budget_type',
        'default_daily_budget', 'default_bid_strategy', 'default_optimization_goal',
        'default_audience', 'default_placements',
        'default_business_goal', 'default_season',
        'required_assets', 'required_utm_params', 'approval_workflow_id',
        'is_global', 'is_active', 'usage_count', 'created_by', 'updated_by',
    ];

    protected $casts = [
        'category' => TemplateCategory::class,
        'default_audience' => 'array',
        'default_placements' => 'array',
        'required_assets' => 'array',
        'required_utm_params' => 'array',
        'default_daily_budget' => 'decimal:2',
        'is_global' => 'boolean',
        'is_active' => 'boolean',
    ];
}
