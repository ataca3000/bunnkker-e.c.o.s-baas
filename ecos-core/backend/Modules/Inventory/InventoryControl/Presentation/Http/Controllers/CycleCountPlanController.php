<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Inventory\InventoryControl\Domain\Models\CycleCountPlan;

final class CycleCountPlanController extends Controller
{
    use HasApiResponse;

    public function index(Request $request): JsonResponse
    {
        $query = CycleCountPlan::query()
            ->with('product:id,name,sku')
            ->orderBy('is_overdue', 'desc')
            ->orderBy('next_due_at');

        if ($request->boolean('overdue')) {
            $query->where('is_overdue', true);
        }

        if ($request->filled('class')) {
            $query->where('abc_class', strtoupper($request->string('class')->toString()));
        }

        $plans = $query->paginate($request->integer('per_page', 50));

        return $this->success($plans);
    }
}
