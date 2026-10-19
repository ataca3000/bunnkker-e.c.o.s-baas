<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\SelfHealingPipeline;
use Modules\System\Engineering\Domain\Models\PatchValidation;
use Modules\System\Engineering\Domain\Models\RepairPatch;
use RuntimeException;

class PatchValidationController
{
    use HasApiResponse;

    public function __construct(
        private readonly SelfHealingPipeline $pipeline,
    ) {}

    public function validatePatch(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $patch = RepairPatch::where('company_id', $companyId)->findOrFail($patchId);

        try {
            $validation = $this->pipeline->startValidation($patch, auth()->id());
            $validation = $this->pipeline->execute($validation);
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($validation->load('steps'), 201);
    }

    public function forPatch(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $patch = RepairPatch::where('company_id', $companyId)->findOrFail($patchId);

        $validations = PatchValidation::where('company_id', $companyId)
            ->where('patch_id', $patch->id)
            ->orderByDesc('attempt_number')
            ->with('steps')
            ->get();

        return $this->success($validations);
    }

    public function show(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $validation = PatchValidation::where('company_id', $companyId)
            ->with(['steps', 'report'])
            ->findOrFail($id);

        return $this->success($validation);
    }

    public function steps(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $validation = PatchValidation::where('company_id', $companyId)->findOrFail($id);

        return $this->success($validation->steps()->orderBy('sequence')->get());
    }

    public function cancel(string $id): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $validation = PatchValidation::where('company_id', $companyId)->findOrFail($id);

        try {
            $this->pipeline->cancel($validation, auth()->id());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($validation->fresh());
    }

    public function revalidate(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $patch = RepairPatch::where('company_id', $companyId)->findOrFail($patchId);

        try {
            $validation = $this->pipeline->revalidate($patch, auth()->id());
        } catch (RuntimeException $e) {
            return $this->error($e->getMessage(), 422);
        }

        return $this->success($validation->load('steps'), 201);
    }

    public function latest(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        RepairPatch::where('company_id', $companyId)->findOrFail($patchId);

        $validation = $this->pipeline->latestForPatch($patchId);

        abort_if($validation === null, 404, 'No validation runs for this patch');

        return $this->success($validation->load('steps'));
    }
}
