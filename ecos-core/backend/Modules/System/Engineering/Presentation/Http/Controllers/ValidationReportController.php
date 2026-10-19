<?php

namespace Modules\System\Engineering\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Modules\Core\Http\Traits\HasApiResponse;
use Modules\System\Engineering\Application\Services\ValidationReportService;

class ValidationReportController
{
    use HasApiResponse;

    public function __construct(
        private readonly ValidationReportService $reportService,
    ) {}

    public function forValidation(string $validationId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        $report = $this->reportService->getForValidation($validationId, $companyId);

        abort_if($report === null, 404, 'No report found for this validation');

        return $this->success($report);
    }

    public function forPatch(string $patchId): JsonResponse
    {
        $companyId = auth()->user()->company_id;

        return $this->success($this->reportService->listForPatch($patchId, $companyId));
    }
}
