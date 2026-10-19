<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Modules\Marketing\CampaignStudio\Domain\Enums\CampaignInternalStatus;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraftAudience;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraftPlacement;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignTemplate;

class CampaignTemplateService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $query = CampaignTemplate::where('is_active', true);

        if ($companyId = Arr::get($filters, 'company_id')) {
            $query->where(fn ($q) => $q->where('company_id', $companyId)->orWhere('is_global', true));
        }
        if ($category = Arr::get($filters, 'category')) {
            $query->where('category', $category);
        }
        if ($search = Arr::get($filters, 'search')) {
            $query->where('name', 'ilike', "%{$search}%");
        }

        return $query->orderBy('usage_count', 'desc')->paginate($perPage);
    }

    public function create(array $data, string $userId): CampaignTemplate
    {
        return CampaignTemplate::create(array_merge($data, [
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));
    }

    public function update(CampaignTemplate $template, array $data, string $userId): CampaignTemplate
    {
        $template->update(array_merge($data, ['updated_by' => $userId]));

        return $template->fresh();
    }

    public function delete(CampaignTemplate $template): void
    {
        $template->delete();
    }

    public function createDraftFromTemplate(CampaignTemplate $template, array $overrides, string $userId): CampaignDraft
    {
        $draft = CampaignDraft::create(array_merge([
            'name' => $overrides['name'] ?? "New {$template->name}",
            'objective' => $template->default_objective,
            'buying_type' => $template->default_buying_type,
            'budget_type' => $template->default_budget_type,
            'daily_budget' => $template->default_daily_budget,
            'bid_strategy' => $template->default_bid_strategy,
            'optimization_goal' => $template->default_optimization_goal,
            'business_goal' => $template->default_business_goal,
            'season' => $template->default_season,
            'template_id' => $template->id,
            'internal_status' => CampaignInternalStatus::DRAFT,
            'current_version_number' => 1,
            'created_by' => $userId,
            'updated_by' => $userId,
        ], array_filter($overrides)));

        // Apply default audience
        $defaultAudience = $template->default_audience ?? [];
        CampaignDraftAudience::create(array_merge([
            'campaign_draft_id' => $draft->id,
            'age_min' => 18,
            'age_max' => 65,
        ], $defaultAudience));

        // Apply default placements
        $defaultPlacements = $template->default_placements ?? [];
        CampaignDraftPlacement::create(array_merge([
            'campaign_draft_id' => $draft->id,
            'placement_mode' => 'auto',
            'facebook_feed' => true,
            'instagram_feed' => true,
        ], $defaultPlacements));

        // Increment usage count
        $template->increment('usage_count');

        return $draft->fresh(['audience', 'placement']);
    }
}
