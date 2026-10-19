<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Core\Documents\DocumentService;
use App\Core\FeatureFlags\FeatureFlagService;
use App\Core\Timeline\TimelineService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\Operations\Preparation\Application\Actions\AnalyzeMaterialsAction;
use Modules\Operations\Preparation\Application\Actions\ApproveWaveAction;
use Modules\Operations\Preparation\Application\Actions\AssignWorkerAction;
use Modules\Operations\Preparation\Application\Actions\CancelWaveAction;
use Modules\Operations\Preparation\Application\Actions\CompleteProductAction;
use Modules\Operations\Preparation\Application\Actions\CompleteWaveAction;
use Modules\Operations\Preparation\Application\Actions\CreateWaveAction;
use Modules\Operations\Preparation\Application\Actions\GenerateDemandAction;
use Modules\Operations\Preparation\Application\Actions\RecalculateWaveAction;
use Modules\Operations\Preparation\Application\Actions\ReleaseWorkerAction;
use Modules\Operations\Preparation\Application\Actions\ReportIssueAction;
use Modules\Operations\Preparation\Application\Actions\ResolveShortageAction;
use Modules\Operations\Preparation\Application\Actions\StartPreparationAction;
use Modules\Operations\Preparation\Application\DTOs\CreateWaveDTO;
use Modules\Operations\Preparation\Application\DTOs\RecalculateWaveDTO;
use Modules\Operations\Preparation\Application\DTOs\ReportIssueDTO;
use Modules\Operations\Preparation\Application\DTOs\StartPreparationDTO;
use Modules\Operations\Preparation\Application\Services\WaveEngine\WavePreparationService;
use Modules\Operations\Preparation\Domain\Enums\PreparationIssueType;
use Modules\Operations\Preparation\Domain\Exceptions\WaveItemNotFoundException;
use Modules\Operations\Preparation\Domain\Exceptions\WaveNotFoundException;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Domain\Models\PreparationWaveItem;
use Modules\Operations\Preparation\Presentation\Http\Requests\ApproveWaveRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\AssignWorkerRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\CancelWaveRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\CompleteProductRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\CreateWaveRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\RecalculateWaveRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\ReleaseWorkerRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\ReportIssueRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\ResolveShortageRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\StartPreparationRequest;
use Modules\Operations\Preparation\Presentation\Http\Resources\PreparationWaveResource;

final class PreparationWaveController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly FeatureFlagService $flags) {}

    public function index(Request $request): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $this->authorize('viewAny', PreparationWave::class);

        $request->validate([
            'status' => ['nullable', 'string'],
            'warehouse_id' => ['nullable', 'uuid'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'sort' => ['nullable', 'string'],
        ]);

        $companyId = $request->user()->company_id;
        $perPage = (int) ($request->query('per_page', 25));

        $sortable = ['wave_number', 'planning_date', 'status', 'orders_count', 'created_at'];
        $sortRaw = $request->query('sort', '-created_at');
        $desc = str_starts_with((string) $sortRaw, '-');
        $sortCol = ltrim((string) $sortRaw, '-');
        $sortCol = in_array($sortCol, $sortable, true) ? $sortCol : 'created_at';

        $query = PreparationWave::with(['workers' => fn ($q) => $q->whereNull('released_at')])
            ->where('company_id', $companyId)
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('warehouse_id'), fn ($q, $v) => $q->where('warehouse_id', $v))
            ->when($request->query('planning_date'), fn ($q, $v) => $q->whereDate('planning_date', $v))
            ->when($request->query('search'), fn ($q, $v) => $q->where('wave_number', 'like', "%{$v}%"))
            ->orderBy($sortCol, $desc ? 'desc' : 'asc');

        $paginator = $query->paginate($perPage);

        return $this->success([
            'data' => PreparationWaveResource::collection($paginator->items()),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(CreateWaveRequest $request, CreateWaveAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $this->authorize('create', PreparationWave::class);

        $validated = $request->validated();
        $companyId = $request->user()->company_id;
        $actorId = (string) $request->user()->id;
        $orderIds = $validated['order_ids'];

        $this->guardOrdersReservable($companyId, $orderIds);

        $orderLines = DB::table('orders')
            ->whereIn('id', $orderIds)
            ->get(['id', 'order_number', 'confirmed_at', 'customer_name', 'delivery_zone',
                'governorate', 'shipping_cost', 'payment_status'])
            ->map(fn ($o) => [
                'order_id' => $o->id,
                'order_number' => $o->order_number ?? $o->id,
                'confirmed_at' => $o->confirmed_at ?? now()->toIso8601String(),
                'customer_name' => $o->customer_name ?? null,
                'delivery_zone' => $o->delivery_zone ?? null,
                'governorate' => $o->governorate ?? null,
                'shipping_cost' => $o->shipping_cost ?? null,
                'is_paid' => in_array($o->payment_status ?? '', ['paid', 'partially_paid'], true),
            ])
            ->toArray();

        $configVersionId = DB::table('configuration_versions')
            ->where('company_id', $companyId)
            ->where('is_active', true)
            ->value('id');

        $dto = new CreateWaveDTO(
            companyId: $companyId,
            warehouseId: $validated['warehouse_id'],
            planningDate: $validated['planning_date'],
            orderLines: $orderLines,
            actorId: $actorId,
            brandId: $validated['brand_id'] ?? null,
            channelId: $validated['channel_id'] ?? null,
            configVersionId: $configVersionId,
            notes: $validated['notes'] ?? null,
        );

        $wave = $action->execute($dto);

        return $this->created(new PreparationWaveResource($wave));
    }

    public function show(Request $request, string $waveId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id, [
            'waveOrders', 'waveItems', 'materialRequirements', 'exceptions', 'workers', 'pickList',
        ]);
        $this->authorize('view', $wave);

        return $this->success(new PreparationWaveResource($wave));
    }

    public function generateDemand(Request $request, string $waveId, GenerateDemandAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('generateDemand', $wave);

        $result = $action->execute($wave, (string) $request->user()->id);

        return $this->success(new PreparationWaveResource($result->load('waveItems')));
    }

    public function analyzeMaterials(Request $request, string $waveId, AnalyzeMaterialsAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('analyzeMaterials', $wave);

        $result = $action->execute($wave, (string) $request->user()->id);

        return $this->success(new PreparationWaveResource($result->load('materialRequirements')));
    }

    public function approve(ApproveWaveRequest $request, string $waveId, ApproveWaveAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('approve', $wave);

        $result = $action->execute($wave, (string) $request->user()->id, $request->validated('notes'));

        return $this->success(new PreparationWaveResource($result));
    }

    public function start(StartPreparationRequest $request, string $waveId, StartPreparationAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id, ['waveItems']);
        $this->authorize('start', $wave);

        $validated = $request->validated();
        $workerIds = $validated['worker_ids'] ?? [];

        $workers = array_map(
            fn ($id) => ['user_id' => $id, 'role' => 'operator'],
            $workerIds,
        );

        if (! empty($validated['supervisor_id'])) {
            $workers[] = ['user_id' => $validated['supervisor_id'], 'role' => 'supervisor'];
        }

        $dto = new StartPreparationDTO(
            actorId: (string) $request->user()->id,
            workers: $workers,
            stationIds: $validated['station_ids'] ?? [],
            overrideShortage: (bool) ($validated['override_shortage'] ?? false),
        );
        $result = $action->execute($wave, $dto);

        return $this->success(new PreparationWaveResource($result->load(['pickList', 'workers'])));
    }

    public function advance(Request $request, string $waveId, WavePreparationService $service): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('start', $wave);

        $result = $service->startPreparation($wave, (string) $request->user()->id);

        return $this->success(new PreparationWaveResource($result));
    }

    public function completeItem(
        CompleteProductRequest $request,
        string $waveId,
        string $itemId,
        CompleteProductAction $action,
    ): JsonResponse {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('completeItem', $wave);

        $item = PreparationWaveItem::where('id', $itemId)
            ->where('preparation_wave_id', $wave->id)
            ->first();

        if (! $item) {
            throw WaveItemNotFoundException::forId($itemId);
        }

        $validated = $request->validated();
        $result = $action->execute(
            $wave,
            $item,
            (float) $validated['quantity_prepared'],
            (string) $request->user()->id,
            $validated['notes'] ?? null,
        );

        return $this->success([
            'id' => $result->id,
            'product_id' => $result->product_id,
            'sku' => $result->sku_snapshot,
            'quantity_required' => $result->quantity_required,
            'quantity_prepared' => $result->quantity_prepared,
            'quantity_short' => $result->quantity_short,
            'status' => $result->status?->value,
            'prepared_at' => $result->prepared_at?->toIso8601String(),
            'prepared_by' => $result->prepared_by,
        ]);
    }

    public function complete(Request $request, string $waveId, CompleteWaveAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id, ['waveItems']);
        $this->authorize('complete', $wave);

        $result = $action->execute($wave, (string) $request->user()->id);

        return $this->success(new PreparationWaveResource($result));
    }

    public function cancel(CancelWaveRequest $request, string $waveId, CancelWaveAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('cancel', $wave);

        $result = $action->execute($wave, (string) $request->user()->id, $request->validated('reason'));

        return $this->success([
            'id' => $result->id,
            'status' => $result->status?->value,
            'cancelled_at' => $result->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $result->cancellation_reason,
        ]);
    }

    public function recalculate(RecalculateWaveRequest $request, string $waveId, RecalculateWaveAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('recalculate', $wave);

        $validated = $request->validated();
        $actorId = (string) $request->user()->id;

        $addOrderLines = [];
        if (! empty($validated['add_order_ids'])) {
            $addOrderLines = DB::table('orders')
                ->whereIn('id', $validated['add_order_ids'])
                ->get(['id', 'order_number', 'confirmed_at', 'customer_name', 'delivery_zone'])
                ->map(fn ($o) => [
                    'order_id' => $o->id,
                    'order_number' => $o->order_number ?? $o->id,
                    'confirmed_at' => $o->confirmed_at ?? now()->toIso8601String(),
                    'customer_name' => $o->customer_name ?? null,
                    'delivery_zone' => $o->delivery_zone ?? null,
                ])
                ->toArray();
        }

        $dto = new RecalculateWaveDTO(
            actorId: $actorId,
            removeOrderIds: $validated['remove_order_ids'] ?? [],
            addOrderLines: $addOrderLines,
        );
        $result = $action->execute($wave, $dto);

        return $this->success(new PreparationWaveResource($result->load('waveItems')));
    }

    public function productQueue(Request $request, string $waveId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('view', $wave);

        $request->validate([
            'status' => ['nullable', 'string'],
            'sort' => ['nullable', 'string'],
        ]);

        $statusFilter = $request->query('status');

        $items = DB::table('preparation_wave_items as pwi')
            ->join('products as p', 'p.id', '=', 'pwi.product_id')
            ->join('units as u', 'u.id', '=', 'p.unit_id')
            ->leftJoin(
                DB::raw('(SELECT bom.product_id, COUNT(*) as material_count FROM bills_of_materials bom JOIN bill_of_material_lines boml ON boml.bom_id = bom.id WHERE bom.is_active = 1 GROUP BY bom.product_id) as bom_summary'),
                'bom_summary.product_id', '=', 'pwi.product_id',
            )
            ->leftJoin(
                DB::raw('(SELECT ol.product_id, COUNT(DISTINCT ol.order_id) as orders_count FROM order_lines ol JOIN preparation_wave_orders pwo ON pwo.order_id = ol.order_id WHERE pwo.preparation_wave_id = '.DB::getPdo()->quote($wave->id).' GROUP BY ol.product_id) as order_summary'),
                'order_summary.product_id', '=', 'pwi.product_id',
            )
            ->where('pwi.preparation_wave_id', $wave->id)
            ->when($statusFilter, fn ($q) => $q->where('pwi.status', $statusFilter))
            ->select([
                'pwi.id',
                'pwi.product_id',
                'pwi.sku_snapshot as sku',
                'pwi.name_snapshot as name',
                'pwi.quantity_required',
                'pwi.quantity_prepared',
                'pwi.quantity_short',
                'pwi.status',
                'pwi.prepared_at',
                'pwi.prepared_by',
                'p.image_url as thumbnail_url',
                'p.stock_status',
                'u.symbol as unit_symbol',
                DB::raw('COALESCE(bom_summary.material_count, 0) as material_count'),
                DB::raw('CASE WHEN bom_summary.product_id IS NOT NULL THEN 1 ELSE 0 END as has_recipe'),
                DB::raw('COALESCE(order_summary.orders_count, 0) as orders_count'),
            ])
            ->get();

        return $this->success($items->map(fn ($i) => [
            'id' => $i->id,
            'product_id' => $i->product_id,
            'sku' => $i->sku,
            'name' => $i->name,
            'thumbnail_url' => $i->thumbnail_url,
            'stock_status' => $i->stock_status,
            'unit_symbol' => $i->unit_symbol,
            'quantity_required' => (float) $i->quantity_required,
            'quantity_prepared' => (float) $i->quantity_prepared,
            'quantity_short' => (float) $i->quantity_short,
            'completion_pct' => $i->quantity_required > 0
                ? round(($i->quantity_prepared / $i->quantity_required) * 100, 1)
                : 0.0,
            'status' => $i->status,
            'has_recipe' => (bool) $i->has_recipe,
            'material_count' => (int) $i->material_count,
            'orders_count' => (int) $i->orders_count,
            'prepared_at' => $i->prepared_at,
            'prepared_by' => $i->prepared_by,
        ])->values()->all());
    }

    public function productWorkspace(Request $request, string $waveId, string $itemId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('view', $wave);

        $item = PreparationWaveItem::where('id', $itemId)
            ->where('preparation_wave_id', $wave->id)
            ->first();

        if (! $item) {
            throw WaveItemNotFoundException::forId($itemId);
        }

        $product = DB::table('products as p')
            ->join('units as u', 'u.id', '=', 'p.unit_id')
            ->where('p.id', $item->product_id)
            ->select(['p.id', 'p.sku', 'p.name', 'p.image_url', 'p.stock_status', 'u.id as unit_id', 'u.name as unit_name', 'u.symbol as unit_symbol'])
            ->first();

        $bom = DB::table('bills_of_materials')
            ->where('product_id', $item->product_id)
            ->where('is_active', true)
            ->first();

        $recipe = null;
        if ($bom) {
            $lines = DB::table('bill_of_material_lines as boml')
                ->join('raw_materials as rm', 'rm.id', '=', 'boml.raw_material_id')
                ->leftJoin('units as u', 'u.id', '=', 'rm.unit_id')
                ->where('boml.bom_id', $bom->id)
                ->select([
                    'boml.id',
                    'boml.raw_material_id',
                    'rm.name as material_name',
                    'rm.sku as material_sku',
                    'boml.quantity',
                    'boml.waste_percentage',
                    'u.symbol as unit_symbol',
                ])
                ->get();

            $recipe = [
                'bom_id' => $bom->id,
                'recipe_cost' => $bom->recipe_cost ?? null,
                'material_lines' => $lines->map(fn ($l) => [
                    'id' => $l->id,
                    'raw_material_id' => $l->raw_material_id,
                    'material_name' => $l->material_name,
                    'material_sku' => $l->material_sku,
                    'quantity' => (float) $l->quantity,
                    'waste_percentage' => (float) $l->waste_percentage,
                    'unit_symbol' => $l->unit_symbol,
                ])->values()->all(),
            ];
        }

        $materialRequirements = DB::table('preparation_material_requirements')
            ->where('preparation_wave_id', $wave->id)
            ->whereExists(function ($q) use ($bom) {
                if (! $bom) {
                    $q->selectRaw('0')->whereRaw('1 = 0');

                    return;
                }
                $q->select(DB::raw(1))
                    ->from('bill_of_material_lines')
                    ->where('bom_id', $bom->id)
                    ->whereColumn('bill_of_material_lines.raw_material_id', 'preparation_material_requirements.raw_material_id');
            })
            ->get();

        $orders = DB::table('order_lines as ol')
            ->join('orders as o', 'o.id', '=', 'ol.order_id')
            ->join('preparation_wave_orders as pwo', 'pwo.order_id', '=', 'o.id')
            ->where('pwo.preparation_wave_id', $wave->id)
            ->where('ol.product_id', $item->product_id)
            ->select(['o.id as order_id', 'o.order_number', 'ol.quantity', 'o.customer_name', 'o.delivery_zone', 'o.status as order_status'])
            ->get();

        return $this->success([
            'item' => [
                'id' => $item->id,
                'product_id' => $item->product_id,
                'sku' => $item->sku_snapshot,
                'name' => $item->name_snapshot,
                'quantity_required' => $item->quantity_required,
                'quantity_prepared' => $item->quantity_prepared,
                'quantity_short' => $item->quantity_short,
                'status' => $item->status?->value,
                'prepared_at' => $item->prepared_at?->toIso8601String(),
                'prepared_by' => $item->prepared_by,
            ],
            'product' => $product,
            'recipe' => $recipe,
            'materials' => $materialRequirements->map(fn ($mr) => [
                'id' => $mr->id,
                'raw_material_id' => $mr->raw_material_id,
                'quantity_needed' => (float) $mr->quantity_needed,
                'quantity_on_hand' => (float) ($mr->quantity_on_hand ?? 0),
                'shortage_qty' => (float) ($mr->shortage_qty ?? 0),
                'shortage_flag' => (bool) ($mr->shortage_flag ?? false),
                'status' => $mr->status ?? null,
            ])->values()->all(),
            'orders' => $orders->map(fn ($o) => [
                'order_id' => $o->order_id,
                'order_number' => $o->order_number,
                'quantity' => (float) $o->quantity,
                'customer_name' => $o->customer_name,
                'delivery_zone' => $o->delivery_zone,
                'order_status' => $o->order_status,
            ])->values()->all(),
        ]);
    }

    public function reportIssue(ReportIssueRequest $request, string $waveId, ReportIssueAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('view', $wave);

        $validated = $request->validated();

        $dto = new ReportIssueDTO(
            waveId: $wave->id,
            companyId: $request->user()->company_id,
            actorId: (string) $request->user()->id,
            issueType: PreparationIssueType::from($validated['issue_type']),
            description: $validated['description'],
            entityType: $validated['entity_type'] ?? null,
            entityId: $validated['entity_id'] ?? null,
        );

        $exception = $action->execute($dto);

        return $this->created([
            'id' => $exception->id,
            'issue_type' => $exception->issue_type?->value,
            'severity' => $exception->severity?->value,
            'description' => $exception->description,
            'status' => $exception->status?->value,
            'raised_at' => $exception->raised_at?->toIso8601String(),
            'raised_by' => $exception->raised_by,
        ]);
    }

    public function assignWorker(
        AssignWorkerRequest $request,
        string $waveId,
        AssignWorkerAction $action,
    ): JsonResponse {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('assignWorker', $wave);

        $validated = $request->validated();
        $worker = $action->execute(
            $wave,
            (string) $validated['user_id'],
            $validated['role'],
            (string) (string) $request->user()->id,
        );

        return $this->created([
            'id' => $worker->id,
            'user_id' => $worker->user_id,
            'role' => $worker->role,
            'assigned_at' => $worker->assigned_at?->toIso8601String(),
        ]);
    }

    public function releaseWorker(
        ReleaseWorkerRequest $request,
        string $waveId,
        string $userId,
        ReleaseWorkerAction $action,
    ): JsonResponse {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('releaseWorker', $wave);

        $action->execute($wave, $userId, (string) (string) $request->user()->id);

        return $this->success(['message' => 'Worker released successfully.']);
    }

    public function resolveShortage(
        ResolveShortageRequest $request,
        string $waveId,
        ResolveShortageAction $action,
    ): JsonResponse {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('resolveShortage', $wave);

        $validated = $request->validated();
        $result = $action->execute(
            $wave,
            (string) (string) $request->user()->id,
            $validated['requirement_ids'] ?? [],
            $validated['resolution_notes'] ?? null,
        );

        return $this->success(new PreparationWaveResource($result));
    }

    public function timeline(Request $request, string $waveId, TimelineService $timeline): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('view', $wave);

        $entries = $timeline->getFor('PreparationWave', $waveId);

        return $this->success($entries->map(fn ($e) => [
            'id' => $e->id,
            'event_type' => $e->event_type,
            'title' => $e->title,
            'description' => $e->description,
            'actor_id' => $e->actor_id,
            'actor_name' => $e->actor_name,
            'source_module' => $e->source_module,
            'occurred_at' => $e->occurred_at?->toIso8601String(),
            'metadata' => $e->metadata,
        ])->values()->all());
    }

    public function documents(Request $request, string $waveId, DocumentService $documents): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);
        $wave = $this->findWave($waveId, $request->user()->company_id);
        $this->authorize('view', $wave);

        $docs = $documents->getFor('PreparationWave', $waveId);

        return $this->success($docs->map(fn ($d) => [
            'id' => $d->id,
            'document_type' => $d->document_type,
            'name' => $d->name,
            'mime_type' => $d->mime_type,
            'file_size' => $d->file_size,
            'version' => $d->version,
            'notes' => $d->notes,
            'uploaded_by' => $d->uploaded_by,
            'created_at' => $d->created_at?->toIso8601String(),
        ])->values()->all());
    }

    private function findWave(string $waveId, string $companyId, array $relations = []): PreparationWave
    {
        $query = PreparationWave::where('id', $waveId)->where('company_id', $companyId);

        if (! empty($relations)) {
            $query->with($relations);
        }

        $wave = $query->first();

        if (! $wave) {
            throw WaveNotFoundException::forId($waveId);
        }

        return $wave;
    }

    /** @param list<string> $orderIds */
    private function guardOrdersReservable(string $companyId, array $orderIds): void
    {
        $alreadyInWave = DB::table('preparation_wave_orders as pwo')
            ->join('preparation_waves as pw', 'pw.id', '=', 'pwo.preparation_wave_id')
            ->where('pw.company_id', $companyId)
            ->whereIn('pwo.order_id', $orderIds)
            ->whereNotIn('pw.status', ['completed', 'cancelled'])
            ->pluck('pwo.order_id')
            ->toArray();

        if (! empty($alreadyInWave)) {
            abort(422, 'One or more orders are already in an active wave.', ['code' => 'order_already_in_wave']);
        }
    }

    private function guardModuleEnabled(?string $companyId): void
    {
        if ($this->flags->isDisabled('modules.preparation_os', $companyId)) {
            abort(503, 'Preparation OS module is not enabled for this company.');
        }
    }
}
