<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Controls\Domain\Models\ControlException;
use Modules\Finance\Controls\Domain\Services\ControlExceptionService;
use Modules\Finance\Controls\Domain\Services\FinancialValidationEngine;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Financial controls: run the report-only validation checks, view the exception
 * register and the control dashboard, and acknowledge/resolve exceptions. The
 * checks never modify financial data — they only write findings to the register.
 */
class FinancialControlsController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(
        private readonly FinancialValidationEngine $engine,
        private readonly ControlExceptionService $exceptions,
    ) {}

    public function run(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->engine->run($this->companyId($request))]);
    }

    public function dashboard(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->exceptions->dashboard($this->companyId($request))]);
    }

    public function index(Request $request): JsonResponse
    {
        $rows = ControlException::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')), fn ($q) => $q->where('status', 'open'))
            ->latest('id')->limit(200)->get()
            ->map(fn (ControlException $e) => $this->exceptions->payload($e));

        return response()->json(['data' => $rows]);
    }

    public function acknowledge(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->exceptions->payload($this->exceptions->acknowledge($this->find($request, $uuid), $this->actorId($request)))]);
    }

    public function resolve(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->exceptions->payload($this->exceptions->resolve($this->find($request, $uuid), $this->actorId($request)))]);
    }

    private function find(Request $request, string $uuid): ControlException
    {
        return ControlException::query()->where('company_id', $this->companyId($request))->where('uuid', $uuid)->firstOrFail();
    }
}
