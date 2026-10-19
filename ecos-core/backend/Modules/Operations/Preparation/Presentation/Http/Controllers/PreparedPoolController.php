<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Core\FeatureFlags\FeatureFlagService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Operations\Preparation\Application\Actions\UpdatePoolQualityAction;
use Modules\Operations\Preparation\Domain\Models\PreparedProductsPool;
use Modules\Operations\Preparation\Presentation\Http\Requests\UpdatePoolQualityRequest;

final class PreparedPoolController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly FeatureFlagService $flags) {}

    public function index(Request $request): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $this->authorize('viewAny', PreparedProductsPool::class);

        $request->validate([
            'warehouse_id' => ['required', 'uuid'],
            'quality_status' => ['nullable', 'string', 'in:pending_review,passed,failed'],
            'available_only' => ['nullable', 'boolean'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $companyId = $request->user()->company_id;
        $perPage = (int) ($request->query('per_page', 25));

        $query = PreparedProductsPool::where('company_id', $companyId)
            ->where('warehouse_id', $request->query('warehouse_id'))
            ->when($request->query('quality_status'), fn ($q, $v) => $q->where('quality_status', $v))
            ->when($request->boolean('available_only'), fn ($q) => $q->where('quantity_available', '>', 0))
            ->orderByDesc('prepared_at');

        $paginator = $query->paginate($perPage);

        $waveNumberMap = \Illuminate\Support\Facades\DB::table('preparation_waves')
            ->whereIn('id', $paginator->getCollection()->pluck('preparation_wave_id')->unique()->toArray())
            ->pluck('wave_number', 'id')
            ->toArray();

        return $this->success([
            'data' => $paginator->getCollection()->map(fn ($pool) => [
                'id' => $pool->id,
                'product_id' => $pool->product_id,
                'sku' => $pool->sku_snapshot,
                'name' => $pool->name_snapshot,
                'preparation_wave_number' => $waveNumberMap[$pool->preparation_wave_id] ?? null,
                'quantity_available' => $pool->quantity_available,
                'quantity_reserved' => $pool->quantity_reserved,
                'quantity_loaded' => $pool->quantity_loaded,
                'quality_status' => $pool->quality_status?->value,
                'quality_checked_at' => $pool->quality_checked_at?->toIso8601String(),
                'prepared_at' => $pool->prepared_at?->toIso8601String(),
            ])->values()->all(),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function updateQuality(
        UpdatePoolQualityRequest $request,
        string $poolId,
        UpdatePoolQualityAction $action,
    ): JsonResponse {
        $this->guardModuleEnabled($request->user()?->company_id);

        $pool = PreparedProductsPool::where('id', $poolId)
            ->where('company_id', $request->user()->company_id)
            ->first();

        if (! $pool) {
            abort(404, 'Pool entry not found.');
        }

        $this->authorize('updateQuality', $pool);

        $validated = $request->validated();
        $result = $action->execute(
            $pool,
            $validated['quality_result'],
            (string) (string) $request->user()->id,
            $validated['notes'] ?? null,
        );

        return $this->success([
            'id' => $result->id,
            'quality_status' => $result->quality_status?->value,
            'quality_checked_at' => $result->quality_checked_at?->toIso8601String(),
        ]);
    }

    private function guardModuleEnabled(?string $companyId): void
    {
        if ($this->flags->isDisabled('modules.preparation_os', $companyId)) {
            abort(503, 'Preparation OS module is not enabled for this company.');
        }
    }
}
