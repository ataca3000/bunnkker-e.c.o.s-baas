<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Ledger\Domain\Models\CostCenter;

/**
 * Cost centers — the financial dimension Finance owns. Company and Branch are
 * existing org dimensions referenced by id on the journal line, not re-modelled
 * here.
 */
class CostCenterController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $rows = CostCenter::query()->where('company_id', $this->companyId($request))->orderBy('code')->get()
            ->map(fn (CostCenter $c) => [
                'id' => $c->id, 'uuid' => $c->uuid, 'code' => $c->code,
                'name' => $c->name, 'is_active' => $c->is_active,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:200'],
            'name_ar' => ['nullable', 'string', 'max:200'],
            'parent_id' => ['nullable', 'integer', 'exists:finance_cost_centers,id'],
        ]);
        $validated['company_id'] = $this->companyId($request);
        $validated['created_by'] = $request->user()?->id;

        $cc = CostCenter::create($validated);

        return response()->json(['data' => ['id' => $cc->id, 'uuid' => $cc->uuid, 'code' => $cc->code]], 201);
    }

    private function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }
}
