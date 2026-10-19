<?php

declare(strict_types=1);

namespace Modules\Crm\Customers\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Domain\Models\CustomerGroup;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;

/** Customer groups (retail / wholesale / VIP …). */
class CustomerGroupController extends Controller
{
    use ResolvesCustomerContext;

    public function index(Request $request): JsonResponse
    {
        $groups = CustomerGroup::query()
            ->where('company_id', $this->companyId($request))
            ->orderBy('name')->get()
            ->map(fn (CustomerGroup $g) => ['id' => $g->id, 'name' => $g->name, 'description' => $g->description, 'is_default' => (bool) $g->is_default]);

        return response()->json(['data' => $groups]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'description' => ['nullable', 'string', 'max:500'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $group = CustomerGroup::create([
            'company_id' => $this->companyId($request),
            'name' => $v['name'],
            'description' => $v['description'] ?? null,
            'is_default' => (bool) ($v['is_default'] ?? false),
        ]);

        return response()->json(['data' => ['id' => $group->id, 'name' => $group->name]], 201);
    }
}
