<?php

declare(strict_types=1);

namespace Modules\Marketing\Automation\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Marketing\Automation\Application\Services\AudienceSegmentService;
use Modules\Marketing\Automation\Domain\Models\AudienceSegment;
use Modules\Marketing\Automation\Domain\Models\SegmentMembership;
use Modules\Marketing\Automation\Presentation\Http\Resources\AudienceSegmentResource;

class AudienceSegmentController extends Controller
{
    public function __construct(private readonly AudienceSegmentService $service) {}

    public function index(Request $request): JsonResponse
    {
        $filters = array_merge(
            $request->only(['segment_type', 'search']),
            ['company_id' => $request->user()?->company_id],
        );

        $segments = $this->service->list($filters);

        return response()->json(AudienceSegmentResource::collection($segments)->response()->getData(true));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'segment_type' => 'required|string',
            'rules' => 'required|array',
            'entity_type' => 'nullable|string',
            'is_dynamic' => 'boolean',
        ]);

        $validated['company_id'] = $request->user()?->company_id;

        $segment = $this->service->create($validated, (string) $request->user()->id);

        return response()->json(new AudienceSegmentResource($segment), 201);
    }

    public function show(AudienceSegment $segment): JsonResponse
    {
        return response()->json(new AudienceSegmentResource($segment));
    }

    public function update(Request $request, AudienceSegment $segment): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'rules' => 'sometimes|array',
            'is_dynamic' => 'boolean',
        ]);

        $segment = $this->service->update($segment, $validated, (string) $request->user()->id);

        return response()->json(new AudienceSegmentResource($segment));
    }

    public function destroy(AudienceSegment $segment): JsonResponse
    {
        $this->service->delete($segment);

        return response()->json(null, 204);
    }

    public function recalculate(AudienceSegment $segment): JsonResponse
    {
        $result = $this->service->recalculate($segment);

        return response()->json($result);
    }

    public function memberships(Request $request, AudienceSegment $segment): JsonResponse
    {
        $memberships = SegmentMembership::where('segment_id', $segment->id)
            ->when($request->boolean('active_only', true), fn ($q) => $q->where('is_active', true))
            ->orderByDesc('created_at')
            ->paginate((int) $request->get('per_page', 50));

        return response()->json($memberships);
    }
}
