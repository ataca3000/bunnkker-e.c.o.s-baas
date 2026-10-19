<?php

declare(strict_types=1);

namespace Modules\Marketing\CampaignStudio\Application\Services;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use Illuminate\Support\Arr;
use Modules\Marketing\CampaignStudio\Domain\Enums\CampaignInternalStatus;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraft;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraftAudience;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraftCreative;
use Modules\Marketing\CampaignStudio\Domain\Models\CampaignDraftPlacement;

class CampaignDraftService
{
    public function list(array $filters = [], int $perPage = 25): LengthAwarePaginator
    {
        $query = CampaignDraft::query()->with(['audience', 'placement', 'currentApproval']);

        if ($status = Arr::get($filters, 'status')) {
            $query->where('internal_status', $status);
        }
        if ($companyId = Arr::get($filters, 'company_id')) {
            $query->where('company_id', $companyId);
        }
        if ($brandId = Arr::get($filters, 'brand_id')) {
            $query->where('brand_id', $brandId);
        }
        if ($initiativeId = Arr::get($filters, 'initiative_id')) {
            $query->where('initiative_id', $initiativeId);
        }
        if ($ownerId = Arr::get($filters, 'campaign_owner_id')) {
            $query->where('campaign_owner_id', $ownerId);
        }
        if ($search = Arr::get($filters, 'search')) {
            $query->where('name', 'ilike', "%{$search}%");
        }
        if ($connectorType = Arr::get($filters, 'connector_type')) {
            $query->where('connector_type', $connectorType);
        }

        return $query->orderByDesc('created_at')->paginate($perPage);
    }

    public function find(string $id): CampaignDraft
    {
        return CampaignDraft::with([
            'audience', 'creatives', 'placement', 'versions',
            'currentApproval.decisions', 'publishingJobs',
            'products', 'validationResults', 'scheduleTasks',
        ])->findOrFail($id);
    }

    public function create(array $data, string $userId): CampaignDraft
    {
        $draft = CampaignDraft::create(array_merge($data, [
            'internal_status' => CampaignInternalStatus::DRAFT,
            'current_version_number' => 1,
            'created_by' => $userId,
            'updated_by' => $userId,
        ]));

        // Create empty audience and placement records
        CampaignDraftAudience::create([
            'campaign_draft_id' => $draft->id,
            'age_min' => 18,
            'age_max' => 65,
        ]);

        CampaignDraftPlacement::create([
            'campaign_draft_id' => $draft->id,
            'placement_mode' => 'auto',
            'facebook_feed' => true,
            'instagram_feed' => true,
        ]);

        return $draft->fresh(['audience', 'placement']);
    }

    public function update(CampaignDraft $draft, array $data, string $userId): CampaignDraft
    {
        $draft->update(array_merge($data, ['updated_by' => $userId]));

        return $draft->fresh();
    }

    public function updateAudience(CampaignDraft $draft, array $data): CampaignDraftAudience
    {
        $audience = $draft->audience ?? CampaignDraftAudience::create(['campaign_draft_id' => $draft->id]);
        $audience->update($data);

        return $audience->fresh();
    }

    public function upsertCreative(CampaignDraft $draft, array $data, ?string $creativeId = null): CampaignDraftCreative
    {
        if ($creativeId) {
            $creative = CampaignDraftCreative::where('campaign_draft_id', $draft->id)->findOrFail($creativeId);
            $creative->update($data);

            return $creative->fresh();
        }

        return CampaignDraftCreative::create(array_merge($data, ['campaign_draft_id' => $draft->id]));
    }

    public function deleteCreative(CampaignDraft $draft, string $creativeId): void
    {
        CampaignDraftCreative::where('campaign_draft_id', $draft->id)->findOrFail($creativeId)->delete();
    }

    public function updatePlacements(CampaignDraft $draft, array $data): CampaignDraftPlacement
    {
        $placement = $draft->placement ?? CampaignDraftPlacement::create(['campaign_draft_id' => $draft->id]);
        $placement->update($data);

        return $placement->fresh();
    }

    public function delete(CampaignDraft $draft): void
    {
        $draft->delete();
    }

    public function duplicate(CampaignDraft $draft, string $userId): CampaignDraft
    {
        $newDraft = $draft->replicate(['id', 'external_campaign_id', 'external_account_id', 'linked_campaign_id', 'published_at', 'last_published_at', 'submitted_for_approval_at', 'scheduled_publish_at', 'current_version_id']);
        $newDraft->name = $draft->name.' (Copy)';
        $newDraft->internal_status = CampaignInternalStatus::DRAFT;
        $newDraft->current_version_number = 1;
        $newDraft->current_version_id = null;
        $newDraft->created_by = $userId;
        $newDraft->updated_by = $userId;
        $newDraft->save();

        if ($draft->audience) {
            $draft->audience->replicate(['id', 'campaign_draft_id'])->fill(['campaign_draft_id' => $newDraft->id])->save();
        }
        if ($draft->placement) {
            $draft->placement->replicate(['id', 'campaign_draft_id'])->fill(['campaign_draft_id' => $newDraft->id])->save();
        }
        foreach ($draft->creatives as $creative) {
            $creative->replicate(['id', 'campaign_draft_id'])->fill(['campaign_draft_id' => $newDraft->id])->save();
        }

        return $newDraft->fresh(['audience', 'placement', 'creatives']);
    }

    public function getStudioKpis(array $filters = []): array
    {
        $companyId = Arr::get($filters, 'company_id');

        $query = CampaignDraft::query();
        if ($companyId) {
            $query->where('company_id', $companyId);
        }

        $counts = $query->selectRaw('internal_status, COUNT(*) as total')
            ->groupBy('internal_status')
            ->pluck('total', 'internal_status');

        return [
            'drafts' => (int) ($counts['draft'] ?? 0),
            'pending_review' => (int) ($counts['pending_review'] ?? 0),
            'approved' => (int) ($counts['approved'] ?? 0),
            'scheduled' => (int) ($counts['scheduled'] ?? 0),
            'publishing' => (int) ($counts['publishing'] ?? 0),
            'published' => (int) ($counts['published'] ?? 0),
            'paused' => (int) ($counts['paused'] ?? 0),
            'archived' => (int) ($counts['archived'] ?? 0),
            'failed' => (int) ($counts['failed'] ?? 0),
            'total' => (int) $counts->sum(),
        ];
    }
}
