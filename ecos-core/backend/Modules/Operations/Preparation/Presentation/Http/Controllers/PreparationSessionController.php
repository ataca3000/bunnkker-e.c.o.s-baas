<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Presentation\Http\Controllers;

use App\Core\FeatureFlags\FeatureFlagService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Modules\MasterData\Warehouses\Domain\Models\Warehouse;
use Modules\Operations\Preparation\Application\Actions\AddWaveToSessionAction;
use Modules\Operations\Preparation\Application\Actions\ApproveSessionAction;
use Modules\Operations\Preparation\Application\Actions\CancelSessionAction;
use Modules\Operations\Preparation\Application\Actions\CloseSessionAction;
use Modules\Operations\Preparation\Application\Actions\CompleteSessionAction;
use Modules\Operations\Preparation\Application\Actions\CreateSessionAction;
use Modules\Operations\Preparation\Application\Actions\PlanSessionAction;
use Modules\Operations\Preparation\Application\Actions\StartSessionAction;
use Modules\Operations\Preparation\Application\DTOs\CreateSessionDTO;
use Modules\Operations\Preparation\Application\Services\DailyPreparationSessionManager;
use Modules\Operations\Preparation\Domain\Models\PreparationSession;
use Modules\Operations\Preparation\Domain\Models\PreparationSessionOrder;
use Modules\Operations\Preparation\Domain\Models\PreparationWave;
use Modules\Operations\Preparation\Presentation\Http\Requests\AddWaveToSessionRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\CancelSessionRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\CreateSessionRequest;
use Modules\Operations\Preparation\Presentation\Http\Requests\StartSessionRequest;
use Modules\Operations\Preparation\Presentation\Http\Resources\PreparationSessionResource;

final class PreparationSessionController extends Controller
{
    use HasApiResponse;

    public function __construct(
        private readonly FeatureFlagService $flags,
        private readonly DailyPreparationSessionManager $sessionManager,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $request->validate([
            'status' => ['nullable', 'string'],
            'planning_date' => ['nullable', 'date_format:Y-m-d'],
            'search' => ['nullable', 'string', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
        ]);

        $companyId = $request->user()->company_id;
        $perPage = (int) ($request->query('per_page', 25));

        $query = PreparationSession::with(['waves' => fn ($q) => $q->select('id', 'preparation_session_id', 'wave_number', 'status', 'orders_count', 'completion_pct', 'shortage_detected')])
            ->where('company_id', $companyId)
            ->when($request->query('status'), fn ($q, $v) => $q->where('status', $v))
            ->when($request->query('planning_date'), fn ($q, $v) => $q->whereDate('planning_date', $v))
            ->when($request->query('search'), fn ($q, $v) => $q->where('session_number', 'like', "%{$v}%"))
            ->orderByDesc('created_at');

        $paginator = $query->paginate($perPage);

        return $this->success([
            'data' => PreparationSessionResource::collection($paginator->items()),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function store(CreateSessionRequest $request, CreateSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $validated = $request->validated();
        $companyId = $request->user()->company_id;
        $actorId = (string) $request->user()->id;

        $dto = new CreateSessionDTO(
            companyId: $companyId,
            warehouseId: $validated['warehouse_id'],
            planningDate: $validated['planning_date'],
            operatorId: $validated['operator_id'],
            actorId: $actorId,
            supervisorId: $validated['supervisor_id'] ?? null,
            notes: $validated['notes'] ?? null,
        );

        $session = $action->execute($dto);

        return $this->created(new PreparationSessionResource($session));
    }

    public function show(Request $request, string $sessionId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);

        return $this->success(new PreparationSessionResource($session->load('waves')));
    }

    public function start(StartSessionRequest $request, string $sessionId, StartSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($result));
    }

    public function complete(Request $request, string $sessionId, CompleteSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($result));
    }

    public function cancel(CancelSessionRequest $request, string $sessionId, CancelSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $result = $action->execute($session, (string) $request->user()->id, $request->validated()['reason']);

        return $this->success(new PreparationSessionResource($result));
    }

    public function plan(Request $request, string $sessionId, PlanSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($result));
    }

    public function approve(Request $request, string $sessionId, ApproveSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($result));
    }

    public function close(Request $request, string $sessionId, CloseSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $result = $action->execute($session, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($result));
    }

    public function consolidation(Request $request, string $sessionId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);

        // P1E — Cross-Wave Consolidation: find products appearing in more than one wave.
        $opportunities = $session->waves()
            ->with('waveItems')
            ->get()
            ->flatMap(fn ($wave) => $wave->waveItems->map(fn ($item) => [
                'wave_id' => $wave->id,
                'wave_number' => $wave->wave_number,
                'product_id' => $item->product_id,
                'sku_snapshot' => $item->sku_snapshot,
                'name_snapshot' => $item->name_snapshot,
                'quantity' => $item->quantity_required,
            ]))
            ->groupBy('product_id')
            ->filter(fn ($group) => $group->count() > 1)
            ->map(fn ($group) => [
                'product_id' => $group->first()['product_id'],
                'sku_snapshot' => $group->first()['sku_snapshot'],
                'name_snapshot' => $group->first()['name_snapshot'],
                'total_quantity' => $group->sum('quantity'),
                'wave_count' => $group->count(),
                'waves' => $group->map(fn ($w) => [
                    'wave_id' => $w['wave_id'],
                    'wave_number' => $w['wave_number'],
                    'quantity' => $w['quantity'],
                ])->values(),
            ])
            ->values();

        return $this->success(['opportunities' => $opportunities]);
    }

    public function addWave(AddWaveToSessionRequest $request, string $sessionId, AddWaveToSessionAction $action): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $companyId = $request->user()->company_id;

        $wave = PreparationWave::where('id', $request->validated()['wave_id'])
            ->where('company_id', $companyId)
            ->firstOrFail();

        $result = $action->execute($session, $wave, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($result->load('waves')));
    }

    // ── CR-PREP-001: Today's Sessions ────────────────────────────────────────

    public function today(Request $request): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $companyId = $request->user()->company_id;
        $date = $request->query('date', today()->toDateString());

        $warehouses = Warehouse::where('company_id', $companyId)
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $sessions = PreparationSession::where('company_id', $companyId)
            ->whereDate('planning_date', $date)
            ->whereNotIn('status', ['cancelled'])
            ->get()
            ->keyBy('warehouse_id');

        $result = $warehouses->map(function (Warehouse $wh) use ($sessions) {
            /** @var PreparationSession|null $session */
            $session = $sessions->get($wh->id);

            $kpis = $session
                ? $this->computeSessionKpis($session)
                : ['orders' => 0, 'products' => 0, 'prepared' => 0, 'prepared_pct' => 0.0, 'blocked' => 0, 'remaining' => 0];

            return [
                'warehouse_id' => $wh->id,
                'warehouse_name' => $wh->name,
                'session' => $session ? (new PreparationSessionResource($session))->toArray($request) : null,
                'kpis' => $kpis,
            ];
        });

        return $this->success(['data' => $result, 'date' => $date]);
    }

    // ── CR-PREP-001: Freeze ───────────────────────────────────────────────────

    public function freeze(Request $request, string $sessionId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $this->sessionManager->freezeSession($session, (string) $request->user()->id);

        return $this->success(new PreparationSessionResource($session->fresh()));
    }

    // ── CR-PREP-001: Session Orders ───────────────────────────────────────────

    public function sessionOrders(Request $request, string $sessionId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);

        $request->validate([
            'attachment_source' => ['nullable', 'string'],
            'detached' => ['nullable', 'boolean'],
            'per_page' => ['nullable', 'integer', 'min:1', 'max:100'],
            'page' => ['nullable', 'integer', 'min:1'],
        ]);

        $query = PreparationSessionOrder::where('preparation_session_id', $session->id)
            ->when($request->filled('attachment_source'), fn ($q) => $q->where('attachment_source', $request->query('attachment_source')))
            ->when($request->query('detached') === 'true', fn ($q) => $q->whereNotNull('detached_at'))
            ->when($request->query('detached') === 'false', fn ($q) => $q->whereNull('detached_at'))
            ->orderByDesc('attached_at');

        $paginator = $query->paginate((int) ($request->query('per_page', 50)));

        return $this->success([
            'data' => array_map(fn (PreparationSessionOrder $o) => [
                'id' => $o->id,
                'order_id' => $o->order_id,
                'order_number' => $o->order_number_snapshot,
                'customer_name' => $o->customer_name_snapshot,
                'governorate' => $o->governorate_snapshot,
                'area' => $o->area_snapshot,
                'attachment_source' => $o->attachment_source,
                'attached_at' => $o->attached_at->toIso8601String(),
                'attached_by' => $o->attached_by,
                'is_active' => $o->isActive(),
                'detached_at' => $o->detached_at?->toIso8601String(),
                'detachment_reason' => $o->detachment_reason,
            ], $paginator->items()),
            'meta' => [
                'page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
            ],
        ]);
    }

    public function attachOrder(Request $request, string $sessionId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $validated = $request->validate([
            'order_id' => ['required', 'uuid', 'exists:orders,id'],
        ]);

        $session = $this->findSession($sessionId, $request->user()->company_id);
        $order = \Modules\Commerce\Orders\Domain\Models\Order::findOrFail($validated['order_id']);

        $record = $this->sessionManager->attachOrder(
            session: $session,
            order: $order,
            source: 'manual_supervisor',
            attachedBy: (string) $request->user()->id,
        );

        if ($record === null) {
            return $this->error('Session is frozen. Orders cannot be attached.', 422);
        }

        $this->sessionManager->recalculateDemand($session);

        return $this->success(['id' => $record->id, 'order_id' => $record->order_id], 'Order attached.', 201);
    }

    public function detachOrder(Request $request, string $sessionId, string $sessionOrderId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $validated = $request->validate([
            'reason' => ['required', 'string', 'min:3', 'max:500'],
        ]);

        $session = $this->findSession($sessionId, $request->user()->company_id);

        $sessionOrder = PreparationSessionOrder::where('id', $sessionOrderId)
            ->where('preparation_session_id', $session->id)
            ->firstOrFail();

        $this->sessionManager->detachOrder($sessionOrder, $validated['reason'], (string) $request->user()->id);

        return $this->success(null, 'Order detached.', 204);
    }

    // ── CR-PREP-001: Session Products (Aggregated) ────────────────────────────

    public function sessionProducts(Request $request, string $sessionId): JsonResponse
    {
        $this->guardModuleEnabled($request->user()?->company_id);

        $session = $this->findSession($sessionId, $request->user()->company_id);

        $products = DB::table('order_lines')
            ->join('preparation_session_orders', 'order_lines.order_id', '=', 'preparation_session_orders.order_id')
            ->join('products', 'order_lines.product_id', '=', 'products.id')
            ->leftJoin('units', 'products.unit_id', '=', 'units.id')
            ->where('preparation_session_orders.preparation_session_id', $session->id)
            ->whereNull('preparation_session_orders.detached_at')
            ->groupBy('order_lines.product_id', 'products.name', 'products.sku', 'units.symbol')
            ->selectRaw('
                order_lines.product_id,
                products.name AS product_name,
                products.sku,
                units.symbol AS unit,
                SUM(order_lines.quantity) AS total_quantity_needed,
                COUNT(DISTINCT order_lines.order_id) AS orders_count
            ')
            ->orderByRaw('products.name ASC')
            ->get();

        return $this->success([
            'data' => $products->map(fn ($p) => [
                'product_id' => $p->product_id,
                'product_name' => $p->product_name,
                'sku' => $p->sku,
                'unit' => $p->unit,
                'total_quantity_needed' => (float) $p->total_quantity_needed,
                'orders_count' => (int) $p->orders_count,
            ])->all(),
        ]);
    }

    private function computeSessionKpis(PreparationSession $session): array
    {
        $orders = $session->orders_count;
        $products = $session->products_count;

        $prepared = (int) round($products * ($session->completionPct() / 100));
        $remaining = max(0, $products - $prepared);

        return [
            'orders' => $orders,
            'products' => $products,
            'prepared' => $prepared,
            'prepared_pct' => $session->completionPct(),
            'blocked' => 0, // wave-level blocked count — to be wired once waves are attached
            'remaining' => $remaining,
        ];
    }

    private function findSession(string $sessionId, string $companyId): PreparationSession
    {
        return PreparationSession::where('id', $sessionId)
            ->where('company_id', $companyId)
            ->firstOrFail();
    }

    private function guardModuleEnabled(?string $companyId): void
    {
        if ($companyId && ! $this->flags->isEnabled('modules.preparation', $companyId)) {
            abort(503, 'Preparation OS module is not enabled for this company.');
        }
    }
}
