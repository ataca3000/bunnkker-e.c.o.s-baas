<?php

declare(strict_types=1);

namespace Modules\Marketing\Initiatives\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Modules\Marketing\Connections\Domain\Models\MarketingAuditLog;
use Modules\Marketing\Initiatives\Domain\Models\MarketingInitiative;
use Modules\Marketing\Initiatives\Presentation\Http\Resources\InitiativeResource;

final class InitiativeController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        $query = MarketingInitiative::query()
            ->with('template')
            ->withCount('campaigns');

        if ($search = $request->query('search')) {
            $query->where('name', 'like', "%{$search}%");
        }
        if ($status = $request->query('status')) {
            $query->where('status', $status);
        }
        if ($companyId = $request->query('company_id')) {
            $query->where('company_id', $companyId);
        }
        if ($businessGoal = $request->query('business_goal')) {
            $query->where('business_goal', $businessGoal);
        }
        if ($season = $request->query('season')) {
            $query->where('season', $season);
        }
        if ($ownerId = $request->query('owner_id')) {
            $query->where('owner_id', $ownerId);
        }

        $perPage = min((int) $request->query('per_page', 25), 100);

        return InitiativeResource::collection(
            $query->orderBy('created_at', 'desc')->paginate($perPage),
        );
    }

    public function show(MarketingInitiative $initiative): InitiativeResource
    {
        $initiative->load('template')->loadCount('campaigns');

        return new InitiativeResource($initiative);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $this->validateInitiative($request);
        $validated['created_by'] = $request->user()?->id;
        $validated['updated_by'] = $request->user()?->id;

        $initiative = MarketingInitiative::create($validated);

        MarketingAuditLog::record(
            entityType: 'initiative',
            entityId: $initiative->id,
            action: 'created',
            actorId: $request->user()?->id,
            after: ['name' => $initiative->name, 'status' => $initiative->status->value],
        );

        return response()->json(new InitiativeResource($initiative), 201);
    }

    public function update(Request $request, MarketingInitiative $initiative): JsonResponse
    {
        $before = $initiative->toArray();
        $validated = $this->validateInitiative($request, partial: true);
        $validated['updated_by'] = $request->user()?->id;

        $initiative->update($validated);

        MarketingAuditLog::record(
            entityType: 'initiative',
            entityId: $initiative->id,
            action: 'updated',
            actorId: $request->user()?->id,
            before: $before,
            after: $initiative->fresh()?->toArray() ?? [],
        );

        return response()->json(new InitiativeResource($initiative->fresh() ?? $initiative));
    }

    public function archive(Request $request, MarketingInitiative $initiative): JsonResponse
    {
        $initiative->update(['status' => 'archived', 'updated_by' => $request->user()?->id]);

        MarketingAuditLog::record(
            entityType: 'initiative',
            entityId: $initiative->id,
            action: 'archived',
            actorId: $request->user()?->id,
        );

        return response()->json(['message' => 'Initiative archived.']);
    }

    /** @return array<string, mixed> */
    private function validateInitiative(Request $request, bool $partial = false): array
    {
        $sometimes = $partial ? 'sometimes|' : '';

        return $request->validate([
            'name' => ["{$sometimes}required", 'string', 'max:255'],
            'description' => ['nullable', 'string', 'max:5000'],
            'status' => ['nullable', 'in:draft,active,paused,completed,archived,cancelled'],
            'company_id' => ['nullable', 'string'],
            'brand_id' => ['nullable', 'string'],
            'channel_id' => ['nullable', 'string'],
            'business_unit' => ['nullable', 'string', 'max:100'],
            'season' => ['nullable', 'string'],
            'business_goal' => ['nullable', 'string'],
            'cost_center' => ['nullable', 'string', 'max:100'],
            'budget' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'max:10'],
            'start_date' => ['nullable', 'date_format:Y-m-d'],
            'end_date' => ['nullable', 'date_format:Y-m-d', 'after_or_equal:start_date'],
            'owner_id' => ['nullable', 'string'],
            'marketing_team' => ['nullable', 'string', 'max:100'],
            'internal_notes' => ['nullable', 'string', 'max:5000'],
            'tags' => ['nullable', 'array'],
        ]);
    }
}
