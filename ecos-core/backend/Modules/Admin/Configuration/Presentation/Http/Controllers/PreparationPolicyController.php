<?php

declare(strict_types=1);

namespace Modules\Admin\Configuration\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Services\ConfigAuditService;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionPolicy;

/**
 * Configuration OS facade over Preparation OS session policies.
 * Reads/writes the existing preparation_session_policies table.
 *
 * GET  /configuration/brands/{brandId}/preparation-policies
 * POST /configuration/brands/{brandId}/preparation-policies
 * PUT  /configuration/brands/{brandId}/preparation-policies/{id}
 */
final class PreparationPolicyController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly ConfigAuditService $audit) {}

    public function index(Request $request, string $brandId): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';

        $policies = PreparationSessionPolicy::where('company_id', $companyId)
            ->orderByRaw('CASE WHEN warehouse_id IS NULL THEN 0 ELSE 1 END')
            ->get();

        return $this->success($policies);
    }

    public function store(Request $request, string $brandId): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';
        $actorId = Auth::id() ?? '';

        $validated = $request->validate([
            'warehouse_id' => 'nullable|uuid|exists:warehouses,id',
            'auto_create_time' => 'required|date_format:H:i',
            'freeze_time' => 'nullable|date_format:H:i',
            'auto_close_time' => 'nullable|date_format:H:i',
            'eligible_order_statuses' => 'required|array|min:1',
            'auto_attach_orders' => 'boolean',
            'auto_recalculate_demand' => 'boolean',
            'is_active' => 'boolean',
        ]);

        if (isset($validated['auto_create_time'])) {
            $validated['auto_create_time'] .= ':00';
        }
        if (isset($validated['freeze_time'])) {
            $validated['freeze_time'] .= ':00';
        }
        if (isset($validated['auto_close_time'])) {
            $validated['auto_close_time'] .= ':00';
        }

        $policy = PreparationSessionPolicy::create([
            ...$validated,
            'company_id' => $companyId,
            'created_by' => $actorId,
            'updated_by' => $actorId,
        ]);

        $this->audit->record(
            companyId: $companyId,
            module: 'preparation_policy',
            category: 'session_policy',
            action: 'create',
            oldValue: null,
            newValue: $policy->toArray(),
            brandId: $brandId,
        );

        return $this->created($policy, 'Preparation policy created.');
    }

    public function update(Request $request, string $brandId, string $id): JsonResponse
    {
        $companyId = Auth::user()?->company_id ?? '';

        $policy = PreparationSessionPolicy::where('company_id', $companyId)->findOrFail($id);

        $validated = $request->validate([
            'auto_create_time' => 'sometimes|required|date_format:H:i',
            'freeze_time' => 'nullable|date_format:H:i',
            'auto_close_time' => 'nullable|date_format:H:i',
            'eligible_order_statuses' => 'sometimes|required|array|min:1',
            'auto_attach_orders' => 'sometimes|boolean',
            'auto_recalculate_demand' => 'sometimes|boolean',
            'is_active' => 'sometimes|boolean',
        ]);

        if (isset($validated['auto_create_time'])) {
            $validated['auto_create_time'] .= ':00';
        }
        if (isset($validated['freeze_time'])) {
            $validated['freeze_time'] .= ':00';
        }
        if (isset($validated['auto_close_time'])) {
            $validated['auto_close_time'] .= ':00';
        }

        $old = $policy->toArray();
        $policy->update([...$validated, 'updated_by' => Auth::id()]);

        $this->audit->record(
            companyId: $companyId,
            module: 'preparation_policy',
            category: 'session_policy',
            action: 'update',
            oldValue: $old,
            newValue: $policy->fresh()?->toArray() ?? [],
            brandId: $brandId,
        );

        return $this->updated($policy, 'Preparation policy updated.');
    }
}
