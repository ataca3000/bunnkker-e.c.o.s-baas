<?php

declare(strict_types=1);

namespace Modules\Inventory\InventoryControl\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Inventory\InventoryControl\Application\Services\AbcClassificationService;
use Modules\Inventory\InventoryControl\Domain\Models\InventoryAbcClassification;

final class AbcClassificationController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly AbcClassificationService $service,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $query = InventoryAbcClassification::query()
            ->with('product:id,name,sku')
            ->orderBy('cumulative_percentage');

        if ($request->filled('class')) {
            $query->where('classification', strtoupper($request->string('class')->toString()));
        }

        $classifications = $query->paginate($request->integer('per_page', 50));

        return $this->success($classifications);
    }

    public function recalculate(): JsonResponse
    {
        $summary = $this->service->recalculate();

        return $this->success([
            'summary' => $summary,
            'recalculated_at' => now()->toIso8601String(),
        ], 'ABC classifications recalculated successfully.');
    }
}
