<?php

declare(strict_types=1);

namespace Modules\Hr\Workforce\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Workforce\Domain\Enums\ReportingLineType;
use Modules\Hr\Workforce\Domain\Models\ReportingLine;
use Modules\Hr\Workforce\Domain\Policies\EmployeePolicy;
use Modules\Hr\Workforce\Domain\Services\OrganizationChartService;
use Modules\Hr\Workforce\Domain\Services\ReportingLineService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** The organisation chart and the reporting lines behind it. */
class OrganizationChartController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly OrganizationChartService $chart,
        private readonly ReportingLineService $reportingLines,
    ) {}

    public function chart(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->chart->build($this->companyId($request))]);
    }

    public function linesFor(Request $request, string $employeeId): JsonResponse
    {
        $employee = $this->employee($request, $employeeId);

        return response()->json([
            'data' => [
                'employee_id' => $employee->id,
                'manager' => $this->reportingLines->currentManager($employee)?->only(['id', 'first_name', 'last_name', 'employee_number']),
                'direct_reports' => $this->reportingLines->directReports($employee)
                    ->map(fn ($e) => ['id' => $e->id, 'name' => $e->fullName(), 'employee_number' => $e->employee_number])->all(),
                'history' => ReportingLine::query()
                    ->with('manager:id,first_name,last_name')
                    ->where('employee_id', $employee->id)
                    ->orderByDesc('effective_from')->get()
                    ->map(fn (ReportingLine $l) => [
                        'id' => $l->id,
                        'manager' => $l->manager?->fullName(),
                        'type' => $l->type->value,
                        'is_primary' => $l->is_primary,
                        'effective_from' => $l->effective_from?->toDateString(),
                        'effective_to' => $l->effective_to?->toDateString(),
                    ])->all(),
            ],
        ]);
    }

    public function assignManager(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'manager_employee_id' => ['required', 'string'],
            'type' => ['nullable', 'string'],
            'effective_from' => ['nullable', 'date'],
            'note' => ['nullable', 'string', 'max:250'],
        ]);

        $employee = $this->employee($request, $employeeId);

        // Choosing your own manager is not yours to do.
        if (! app(EmployeePolicy::class)->manageReportingLine($request->user(), $employee)) {
            return response()->json(['message' => 'You cannot manage your own reporting line.'], 403);
        }

        $manager = $this->employee($request, $v['manager_employee_id']);
        $type = ReportingLineType::tryFrom((string) ($v['type'] ?? '')) ?? ReportingLineType::Primary;

        $line = $this->reportingLines->assignManager(
            $employee, $manager, $type, $v['effective_from'] ?? null, $v['note'] ?? null
        );

        return response()->json(['data' => $line], 201);
    }

    public function endLine(Request $request, string $id): JsonResponse
    {
        $v = $request->validate(['effective_to' => ['nullable', 'date']]);

        $line = ReportingLine::query()
            ->where('company_id', $this->companyId($request))
            ->where('id', $id)
            ->firstOrFail();

        return response()->json(['data' => $this->reportingLines->end($line, $v['effective_to'] ?? null)]);
    }
}
