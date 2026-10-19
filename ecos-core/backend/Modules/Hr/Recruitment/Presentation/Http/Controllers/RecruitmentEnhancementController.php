<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Recruitment\Domain\Models\Applicant;
use Modules\Hr\Recruitment\Domain\Models\ApplicantTag;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Services\ApplicantTagService;
use Modules\Hr\Recruitment\Domain\Services\ApplicantTimelineService;
use Modules\Hr\Recruitment\Domain\Services\BulkRecruitmentService;
use Modules\Hr\Recruitment\Domain\Services\RecruitmentAnalyticsService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Tags, the applicant timeline, bulk actions and recruitment analytics. */
class RecruitmentEnhancementController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly ApplicantTagService $tags,
        private readonly ApplicantTimelineService $timeline,
        private readonly BulkRecruitmentService $bulk,
        private readonly RecruitmentAnalyticsService $analytics,
    ) {}

    // ── Tags ──────────────────────────────────────────────────────────────────

    public function tagCatalogue(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->tags->catalogue(
                $this->companyId($request),
                $request->boolean('active_only'),
            ),
        ]);
    }

    public function storeTag(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'key' => ['nullable', 'string', 'max:60', 'regex:/^[a-z0-9_]+$/'],
            'description' => ['nullable', 'string', 'max:300'],
            'color' => ['nullable', 'string', 'max:20'],
            'sequence' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $tag = $this->tags->createTag($this->companyId($request), $v, $this->actorId($request));

        return response()->json(['data' => ['id' => (string) $tag->id, 'key' => $tag->key]], 201);
    }

    public function updateTag(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'name' => ['nullable', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:300'],
            'color' => ['nullable', 'string', 'max:20'],
            'sequence' => ['nullable', 'integer', 'min:1', 'max:9999'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $tag = $this->tags->updateTag($this->tag($request, $id), $v);

        return response()->json(['data' => ['id' => (string) $tag->id, 'name' => $tag->name]]);
    }

    public function destroyTag(Request $request, string $id): JsonResponse
    {
        $this->tags->deleteTag($this->tag($request, $id));

        return response()->json(['data' => ['deleted' => true]]);
    }

    public function applicantTags(Request $request, string $applicantId): JsonResponse
    {
        return response()->json(['data' => $this->tags->tagsFor((string) $this->applicant($request, $applicantId)->id)]);
    }

    public function assignTag(Request $request, string $applicantId): JsonResponse
    {
        $v = $request->validate([
            'tag_id' => ['required', 'string'],
            'note' => ['nullable', 'string', 'max:300'],
        ]);

        $this->tags->assign(
            $this->applicant($request, $applicantId),
            $this->tag($request, $v['tag_id']),
            $v['note'] ?? null,
            $this->actorId($request),
        );

        return response()->json(['data' => $this->tags->tagsFor($applicantId)], 201);
    }

    public function removeTag(Request $request, string $applicantId, string $tagId): JsonResponse
    {
        $this->tags->remove(
            $this->applicant($request, $applicantId),
            $this->tag($request, $tagId),
            $this->actorId($request),
        );

        return response()->json(['data' => $this->tags->tagsFor($applicantId)]);
    }

    public function syncTags(Request $request, string $applicantId): JsonResponse
    {
        $v = $request->validate([
            'tag_ids' => ['present', 'array', 'max:20'],
            'tag_ids.*' => ['string'],
        ]);

        $result = $this->tags->sync(
            $this->applicant($request, $applicantId),
            $v['tag_ids'],
            $this->actorId($request),
        );

        return response()->json(['data' => $result + ['tags' => $this->tags->tagsFor($applicantId)]]);
    }

    /** Applicants carrying given tags — the filter behind "show me every VIP". */
    public function searchByTag(Request $request): JsonResponse
    {
        $v = $request->validate([
            'tags' => ['required', 'array', 'min:1', 'max:10'],
            'tags.*' => ['string', 'max:60'],
            'match_all' => ['nullable', 'boolean'],
        ]);

        $companyId = $this->companyId($request);

        $ids = $this->tags->applicantIdsWithTags($companyId, $v['tags'], $request->boolean('match_all'));

        $applicants = Applicant::query()
            ->where('company_id', $companyId)
            ->whereIn('id', $ids)
            ->orderBy('full_name')
            ->limit(200)
            ->get(['id', 'applicant_number', 'full_name', 'mobile', 'email', 'status', 'in_talent_pool']);

        $tagMap = $this->tags->tagsForMany($applicants->pluck('id')->map(fn ($i) => (string) $i)->all());

        return response()->json([
            'data' => [
                'match_all' => $request->boolean('match_all'),
                'tags' => $v['tags'],
                'total' => count($ids),
                'items' => $applicants->map(fn (Applicant $a) => [
                    'id' => (string) $a->id,
                    'applicant_number' => $a->applicant_number,
                    'full_name' => $a->full_name,
                    'mobile' => $a->mobile,
                    'email' => $a->email,
                    'status' => $a->status,
                    'in_talent_pool' => (bool) $a->in_talent_pool,
                    'tags' => $tagMap[(string) $a->id] ?? [],
                ])->all(),
            ],
        ]);
    }

    // ── Timeline ──────────────────────────────────────────────────────────────

    public function applicantTimeline(Request $request, string $applicantId): JsonResponse
    {
        $applicant = $this->applicant($request, $applicantId);

        return response()->json([
            'data' => [
                'events' => $this->timeline->forApplicant(
                    (string) $applicant->company_id,
                    (string) $applicant->id,
                    $this->timelineFilters($request),
                ),
                'filters' => $this->timeline->filterOptions(
                    (string) $applicant->company_id,
                    (string) $applicant->id,
                ),
            ],
        ]);
    }

    public function applicationTimeline(Request $request, string $applicationId): JsonResponse
    {
        $application = JobApplication::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($applicationId);

        return response()->json([
            'data' => [
                'events' => $this->timeline->forApplication($application, $this->timelineFilters($request)),
            ],
        ]);
    }

    // ── Bulk ──────────────────────────────────────────────────────────────────

    /** What the UI needs to build a confirmation dialog before anything happens. */
    public function bulkPreview(Request $request): JsonResponse
    {
        $v = $request->validate([
            'action' => ['required', 'string', 'max:40'],
            'application_ids' => ['required', 'array', 'min:1', 'max:'.BulkRecruitmentService::MAX_SELECTION],
            'application_ids.*' => ['string'],
        ]);

        return response()->json([
            'data' => $this->bulk->preview($this->companyId($request), $v['action'], $v['application_ids']),
        ]);
    }

    public function bulkExecute(Request $request): JsonResponse
    {
        $v = $request->validate([
            'action' => ['required', 'string', 'max:40'],
            'application_ids' => ['required', 'array', 'min:1', 'max:'.BulkRecruitmentService::MAX_SELECTION],
            'application_ids.*' => ['string'],
            'payload' => ['nullable', 'array'],
        ]);

        $result = $this->bulk->execute(
            $this->companyId($request),
            $v['action'],
            $v['application_ids'],
            (array) ($v['payload'] ?? []),
            $this->actorId($request),
        );

        // 207 when some succeeded and some did not — a 200 would let a caller
        // believe the whole selection went through.
        $status = $result['failed'] > 0 && $result['succeeded'] > 0 ? 207 : 200;

        return response()->json(['data' => $result], $status);
    }

    public function bulkActions(): JsonResponse
    {
        return response()->json([
            'data' => [
                'max_selection' => BulkRecruitmentService::MAX_SELECTION,
                'actions' => collect(BulkRecruitmentService::ACTIONS)
                    ->map(fn (array $definition, string $key) => $definition + ['key' => $key])
                    ->values()->all(),
            ],
        ]);
    }

    // ── Analytics ─────────────────────────────────────────────────────────────

    public function analytics(Request $request): JsonResponse
    {
        return response()->json([
            'data' => $this->analytics->dashboard(
                $this->companyId($request),
                $request->query('from') === null ? null : (string) $request->query('from'),
                $request->query('to') === null ? null : (string) $request->query('to'),
            ),
        ]);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function timelineFilters(Request $request): array
    {
        return array_filter([
            'category' => $request->query('category'),
            'event_type' => $request->query('event_type'),
            'application_id' => $request->query('application_id'),
            'from' => $request->query('from'),
            'to' => $request->query('to'),
            'milestones_only' => $request->boolean('milestones_only') ?: null,
        ], fn ($value) => $value !== null);
    }

    private function tag(Request $request, string $id): ApplicantTag
    {
        return ApplicantTag::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }

    private function applicant(Request $request, string $id): Applicant
    {
        return Applicant::query()
            ->where('company_id', $this->companyId($request))
            ->findOrFail($id);
    }
}
