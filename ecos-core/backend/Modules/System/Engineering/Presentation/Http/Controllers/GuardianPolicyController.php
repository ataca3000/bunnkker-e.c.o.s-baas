<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\GuardianPolicyService;
use Modules\System\Engineering\Domain\Models\GuardianPolicy;

class GuardianPolicyController
{
    use HasApiResponse;

    public function __construct(
        private readonly GuardianPolicyService $policyService,
    ) {}

    public function index(): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->policyService->list($companyId));
    }

    public function active(): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->policyService->resolveFor($companyId));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'                => 'required|string|max:120',
            'description'         => 'nullable|string|max:500',
            'is_default'          => 'nullable|boolean',
            'auto_repair'         => 'nullable|boolean',
            'block_on'            => 'nullable|array',
            'block_on.*'          => 'in:security,adr_compliance,safety,toolchain',
            'enabled_checks'      => 'nullable|array',
            'enabled_checks.*'    => 'string',
            'max_repair_attempts' => 'nullable|integer|min:1|max:10',
            'require_revalidation' => 'nullable|boolean',
        ]);

        $companyId = auth()->user()->company_id;

        return $this->success($this->policyService->create($companyId, $data), 201);
    }

    public function update(Request $request, string $id): JsonResponse
    {
        $data = $request->validate([
            'name'                => 'nullable|string|max:120',
            'description'         => 'nullable|string|max:500',
            'is_default'          => 'nullable|boolean',
            'auto_repair'         => 'nullable|boolean',
            'block_on'            => 'nullable|array',
            'block_on.*'          => 'in:security,adr_compliance,safety,toolchain',
            'enabled_checks'      => 'nullable|array',
            'enabled_checks.*'    => 'string',
            'max_repair_attempts' => 'nullable|integer|min:1|max:10',
            'require_revalidation' => 'nullable|boolean',
        ]);

        $policy = $this->findPolicy($id);

        return $this->success($this->policyService->update($policy, $data));
    }

    public function activate(string $id): JsonResponse
    {
        return $this->success($this->policyService->activate($this->findPolicy($id)));
    }

    public function deactivate(string $id): JsonResponse
    {
        return $this->success($this->policyService->deactivate($this->findPolicy($id)));
    }

    public function destroy(string $id): JsonResponse
    {
        $this->findPolicy($id)->delete();

        return $this->success(['deleted' => true]);
    }

    private function findPolicy(string $id): GuardianPolicy
    {
        return GuardianPolicy::where('company_id', auth()->user()->company_id)->findOrFail($id);
    }
}
