<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Modules\Organization\Branches\Domain\Models\Branch;
use Modules\Organization\Branches\Domain\Models\BranchCoverageArea;
use Modules\Organization\Branches\Presentation\Http\Requests\StoreCoverageAreaRequest;
use Modules\Organization\Branches\Presentation\Http\Requests\UpdateCoverageAreaRequest;
use Modules\Organization\Branches\Presentation\Http\Resources\CoverageAreaResource;

/**
 * CRUD for branch coverage areas.
 *
 * Routes are nested under /branches/{branch}/coverage.
 */
final class BranchCoverageController extends Controller
{
    use HasApiResponse;

    public function index(string $branch): JsonResponse
    {
        $model = Branch::findOrFail($branch);

        $areas = BranchCoverageArea::query()
            ->where('branch_id', $model->id)
            ->with(['governorate', 'zone'])
            ->orderBy('priority')
            ->get();

        return $this->success(CoverageAreaResource::collection($areas));
    }

    public function store(StoreCoverageAreaRequest $request, string $branch): JsonResponse
    {
        $model = Branch::findOrFail($branch);

        $validated = $request->validated();

        $area = BranchCoverageArea::create([
            'branch_id'             => $model->id,
            'master_governorate_id' => $validated['master_governorate_id'],
            'master_zone_id'        => $validated['master_zone_id'] ?? null,
            'priority'              => (int) ($validated['priority'] ?? 100),
            'is_active'             => (bool) ($validated['is_active'] ?? true),
        ]);

        $area->load(['governorate', 'zone']);

        return $this->created(new CoverageAreaResource($area), 'Coverage area added.');
    }

    public function update(UpdateCoverageAreaRequest $request, string $branch, string $area): JsonResponse
    {
        $branchModel = Branch::findOrFail($branch);

        $coverageArea = BranchCoverageArea::query()
            ->where('branch_id', $branchModel->id)
            ->findOrFail($area);

        $validated = $request->validated();

        $coverageArea->update([
            'master_governorate_id' => $validated['master_governorate_id'],
            'master_zone_id'        => $validated['master_zone_id'] ?? null,
            'priority'              => (int) ($validated['priority'] ?? $coverageArea->priority),
            'is_active'             => (bool) ($validated['is_active'] ?? $coverageArea->is_active),
        ]);

        $coverageArea->load(['governorate', 'zone']);

        return $this->updated(new CoverageAreaResource($coverageArea), 'Coverage area updated.');
    }

    public function destroy(string $branch, string $area): JsonResponse
    {
        $branchModel = Branch::findOrFail($branch);

        $coverageArea = BranchCoverageArea::query()
            ->where('branch_id', $branchModel->id)
            ->findOrFail($area);

        $coverageArea->delete();

        return $this->deleted('Coverage area removed.');
    }
}
