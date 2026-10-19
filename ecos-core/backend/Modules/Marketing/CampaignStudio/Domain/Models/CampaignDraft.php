<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Modules\Marketing\CampaignStudio\Domain\Enums\BudgetType;
use Modules\Marketing\CampaignStudio\Domain\Enums\CampaignInternalStatus;

class CampaignDraft extends Model
{
    use HasUuids, SoftDeletes;

    protected $table = 'marketing_campaign_drafts';

    protected $fillable = [
        'name', 'internal_status',
        'initiative_id', 'company_id', 'brand_id', 'channel_id',
        'campaign_owner_id', 'budget_owner', 'marketing_team', 'cost_center',
        'season', 'custom_season', 'business_goal', 'tags', 'internal_notes',
        'objective', 'buying_type', 'budget_type', 'daily_budget', 'lifetime_budget',
        'bid_strategy', 'optimization_goal', 'timezone', 'start_date', 'end_date',
        'connector_type', 'connection_id', 'ad_account_id', 'business_manager_id',
        'page_id', 'instagram_account_id', 'pixel_id', 'catalog_id', 'domain',
        'external_campaign_id', 'external_account_id', 'linked_campaign_id',
        'current_version_number', 'current_version_id',
        'approval_workflow_id', 'template_id', 'governance_policy_id',
        'published_at', 'scheduled_publish_at', 'last_published_at', 'submitted_for_approval_at',
        'created_by', 'updated_by',
    ];

    protected $casts = [
        'tags' => 'array',
        'daily_budget' => 'decimal:2',
        'lifetime_budget' => 'decimal:2',
        'internal_status' => CampaignInternalStatus::class,
        'budget_type' => BudgetType::class,
        'start_date' => 'datetime',
        'end_date' => 'datetime',
        'published_at' => 'datetime',
        'scheduled_publish_at' => 'datetime',
        'last_published_at' => 'datetime',
        'submitted_for_approval_at' => 'datetime',
    ];

    public function audience(): HasOne
    {
        return $this->hasOne(CampaignDraftAudience::class);
    }

    public function creatives(): HasMany
    {
        return $this->hasMany(CampaignDraftCreative::class)->orderBy('sort_order');
    }

    public function placement(): HasOne
    {
        return $this->hasOne(CampaignDraftPlacement::class);
    }

    public function versions(): HasMany
    {
        return $this->hasMany(CampaignVersion::class)->orderByDesc('version_number');
    }

    public function currentApproval(): HasOne
    {
        return $this->hasOne(CampaignApproval::class)->latestOfMany('created_at');
    }

    public function approvals(): HasMany
    {
        return $this->hasMany(CampaignApproval::class);
    }

    public function publishingJobs(): HasMany
    {
        return $this->hasMany(PublishingJob::class)->orderByDesc('created_at');
    }

    public function products(): HasMany
    {
        return $this->hasMany(CampaignProduct::class);
    }

    public function validationResults(): HasMany
    {
        return $this->hasMany(CampaignValidationResult::class)->orderBy('severity');
    }

    public function scheduleTasks(): HasMany
    {
        return $this->hasMany(CampaignScheduleTask::class)->orderBy('scheduled_for');
    }

    public function isEditable(): bool
    {
        return $this->internal_status?->isEditable() ?? true;
    }

    public function hasBlockingErrors(): bool
    {
        return $this->validationResults()
            ->where('severity', 'blocking')
            ->where('is_resolved', false)
            ->exists();
    }
}
