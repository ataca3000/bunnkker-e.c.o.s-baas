<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Sales\Domain\Models\Pipeline;
use Modules\Crm\Sales\Domain\Services\PipelineService;

/** Sales pipelines and their stages. */
class PipelineController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly PipelineService $pipelines) {}

    public function index(Request $request): JsonResponse
    {
        $rows = Pipeline::query()->where('company_id', $this->companyId($request))->with('stages')->get()
            ->map(fn (Pipeline $p) => [
                'id' => $p->id, 'name' => $p->name, 'is_default' => (bool) $p->is_default,
                'stages' => $p->stages->map(fn ($s) => ['id' => $s->id, 'name' => $s->name, 'order' => $s->order, 'probability' => $s->probability, 'is_won' => (bool) $s->is_won, 'is_lost' => (bool) $s->is_lost])->all(),
            ]);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'is_default' => ['nullable', 'boolean'],
            'stages' => ['required', 'array', 'min:1'],
            'stages.*.name' => ['required', 'string', 'max:120'],
            'stages.*.probability' => ['nullable', 'integer', 'between:0,100'],
            'stages.*.is_won' => ['nullable', 'boolean'],
            'stages.*.is_lost' => ['nullable', 'boolean'],
        ]);

        $pipeline = $this->pipelines->create($this->companyId($request), $v['name'], $v['stages'], (bool) ($v['is_default'] ?? false));

        return response()->json(['data' => ['id' => $pipeline->id, 'name' => $pipeline->name]], 201);
    }
}
