<?php

declare(strict_types=1);

namespace Modules\Hr\Attendance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Hr\Attendance\Domain\Services\WorkforceAvailabilityService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** The workforce availability and department attendance dashboards. */
class WorkforceAvailabilityController extends Controller
{
    use ResolvesHrContext;

    public function __construct(private readonly WorkforceAvailabilityService $availability) {}

    public function today(Request $request): JsonResponse
    {
        $v = $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => $this->availability->forDate($this->companyId($request), $v['date'] ?? null),
        ]);
    }

    public function byDepartment(Request $request): JsonResponse
    {
        $v = $request->validate(['date' => ['nullable', 'date']]);

        return response()->json([
            'data' => [
                'date' => $v['date'] ?? Carbon::now()->toDateString(),
                'departments' => $this->availability->byDepartment($this->companyId($request), $v['date'] ?? null),
            ],
        ]);
    }

    public function departmentTrend(Request $request, string $departmentId): JsonResponse
    {
        $v = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $to = $v['to'] ?? Carbon::now()->toDateString();
        $from = $v['from'] ?? Carbon::parse($to)->subDays(13)->toDateString();

        return response()->json([
            'data' => $this->availability->departmentTrend($this->companyId($request), $departmentId, $from, $to),
        ]);
    }
}
