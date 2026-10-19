<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Presentation\Http\Controllers;

use App\Core\Company\CurrentCompanyService;
use App\Http\Controllers\Controller;
use App\Traits\HasApiResponse;
use GuzzleHttp\TransferStats;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Modules\Commerce\Orders\Application\Actions\CreateManualOrderAction;
use Modules\Commerce\Orders\Application\Actions\CreateOrderAction;
use Modules\Commerce\Orders\Application\Actions\DeleteOrderAction;
use Modules\Commerce\Orders\Application\Actions\GetOrderAction;
use Modules\Commerce\Orders\Application\Actions\ListOrdersAction;
use Modules\Commerce\Orders\Application\Actions\PatchOrderAction;
use Modules\Commerce\Orders\Application\Actions\PrepareOrderAction;
use Modules\Commerce\Orders\Application\Actions\ResolveProductPricingAction;
use Modules\Commerce\Orders\Application\Actions\UpdateOrderAction;
use Modules\Commerce\Orders\Application\Actions\VerifyPaymentAction;
use Modules\Commerce\Orders\Application\DTO\OrderDTO;
use Modules\Commerce\Orders\Application\Services\CreateOrderSnapshotService;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderBusinessContextSnapshot;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use Modules\Commerce\Orders\Domain\Models\OrderFinancialSnapshot;
use Modules\Commerce\Orders\Domain\Models\OrderNote;
use Modules\Commerce\Orders\Presentation\Http\Requests\PatchOrderRequest;
use Modules\Commerce\Orders\Presentation\Http\Requests\StoreManualOrderRequest;
use Modules\Commerce\Orders\Presentation\Http\Requests\StoreOrderRequest;
use Modules\Commerce\Orders\Presentation\Http\Requests\UpdateOrderRequest;
use Modules\Commerce\Orders\Presentation\Http\Resources\OrderFinancialSnapshotResource;
use Modules\Commerce\Orders\Presentation\Http\Resources\OrderResource;
use Modules\Operations\Fulfillment\Application\DTOs\FulfillmentContext;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ConfirmOrderWorkflow;
use Throwable;

final class OrderController extends Controller
{
    use HasApiResponse;

    public function __construct(private readonly CurrentCompanyService $currentCompany) {}

    public function index(Request $request, ListOrdersAction $action): JsonResponse
    {
        $filters = [
            'search' => $request->query('search'),
            'status' => $request->query('status', 'all'),
            'channel_id' => $request->query('channel_id'),
            'customer_id' => $request->query('customer_id'),
            'customer_code' => $request->query('customer_code'),
            'phone' => $request->query('phone'),
            'external_number' => $request->query('external_number'),
            'brand_id' => $request->query('brand_id'),
            'product_id' => $request->query('product_id'),
            'sku' => $request->query('sku'),
            'payment_method' => $request->query('payment_method'),
            'payment_status' => $request->query('payment_status'),   // paid|unpaid|partial
            'shipping_company' => $request->query('shipping_company'),
            'date_from' => $request->query('date_from'),
            'date_to' => $request->query('date_to'),
            'has_location' => $request->query('has_location'),
            'has_payment_proof' => $request->query('has_payment_proof'),
            'reservation_status' => $request->query('reservation_status'), // reserved|not_reserved
            'governorate' => $request->query('governorate'),
            'city' => $request->query('city'),
            'zone' => $request->query('zone'),
            'min_amount' => $request->query('min_amount'),
            'max_amount' => $request->query('max_amount'),
            'customer_filter' => $request->query('customer_filter'),
            'created_by' => $request->query('created_by'),
            'sort_by' => $request->query('sort_by', 'created_at'),
            'sort_dir' => $request->query('sort_dir', 'desc'),
            'per_page' => $request->query('per_page', 10),
            'company_id' => $this->currentCompany->id(),
        ];

        $paginator = $action->execute($filters)->data();

        // KPI cards: sum grand_total for the current company+status scope
        $totalAmount = Order::query()
            ->where('company_id', $filters['company_id'])
            ->when(
                ($filters['status'] ?? 'all') !== 'all',
                fn ($q) => $q->where('status', $filters['status']),
            )
            ->sum('total');

        return $this->success([
            'items' => OrderResource::collection($paginator->items()),
            'meta' => [
                'current_page' => $paginator->currentPage(),
                'per_page' => $paginator->perPage(),
                'total' => $paginator->total(),
                'last_page' => $paginator->lastPage(),
                'total_amount' => (float) $totalAmount,
            ],
        ]);
    }

    public function show(string $order, GetOrderAction $action): JsonResponse
    {
        $model = $action->execute($order)->data();

        return $this->success(new OrderResource($model));
    }

    public function store(StoreOrderRequest $request, CreateOrderAction $action): JsonResponse
    {
        $result = $action->execute(OrderDTO::fromArray($request->validated()));

        return $this->created(new OrderResource($result->data()), $result->message());
    }

    public function storeManual(StoreManualOrderRequest $request, CreateManualOrderAction $action): JsonResponse
    {
        $result = $action->execute($request->validated());

        return $this->created(new OrderResource($result->data()), $result->message());
    }

    public function update(
        UpdateOrderRequest $request,
        string $order,
        UpdateOrderAction $action,
    ): JsonResponse {
        $validated = $request->validated();
        $result = $action->execute($order, OrderDTO::fromArray($validated), $validated);

        return $this->updated(new OrderResource($result->data()), $result->message());
    }

    public function quickUpdate(
        PatchOrderRequest $request,
        string $order,
        PatchOrderAction $action,
    ): JsonResponse {
        $result = $action->execute($order, $request->validated());

        return $this->updated(new OrderResource($result->data()), $result->message());
    }

    public function prepare(string $order, PrepareOrderAction $action): JsonResponse
    {
        $result = $action->execute($order);

        return $this->success(new OrderResource($result->data()), $result->message());
    }

    public function destroy(string $order, DeleteOrderAction $action): JsonResponse
    {
        $result = $action->execute($order);

        return $this->deleted($result->message() ?? 'Order deleted successfully.');
    }

    /**
     * Returns the immutable financial snapshot for an order, or null if not yet created.
     * Includes the business context snapshot (TASK-ORDER-006C PART 10).
     * Automatically verifies the SHA-256 integrity hash and exposes hash_verified on the response.
     */
    public function financialSnapshot(string $order, CreateOrderSnapshotService $snapshotService): JsonResponse
    {
        $companyId = $this->currentCompany->id();

        $snapshot = OrderFinancialSnapshot::with('lines')
            ->where('order_id', $order)
            ->where('company_id', $companyId)
            ->first();

        if ($snapshot === null) {
            return $this->success(null);
        }

        // Attach hash_verified as a transient attribute before serialization.
        $snapshot->setAttribute('hash_verified', $snapshotService->verifyIntegrityHash($snapshot));

        // Attach business context snapshot as a transient attribute (PART 10).
        $businessContext = OrderBusinessContextSnapshot::where('order_id', $order)
            ->where('company_id', $companyId)
            ->first();
        $snapshot->setAttribute('business_context', $businessContext);

        return $this->success(new OrderFinancialSnapshotResource($snapshot));
    }

    /**
     * Returns the approved selling price and pending-review status for a product.
     * Used by the Manual Order form to auto-populate unit prices on product selection.
     */
    public function productPricing(
        Request $request,
        string $productId,
        ResolveProductPricingAction $action,
    ): JsonResponse {
        $companyId = $request->user()?->company_id;
        $data = $action->execute($productId, $companyId);

        return $this->success($data);
    }

    /**
     * Returns all OrderStatus enum cases (Phase 3).
     * Also exposes per-source entry_options so the Config OS policy matrix
     * can read valid entry statuses from the canonical PHP enum at runtime.
     */
    public function orderStatuses(): JsonResponse
    {
        $all = array_map(
            static fn (OrderStatus $s): array => ['value' => $s->value, 'label' => $s->label()],
            OrderStatus::cases(),
        );

        $manualValues = [
            OrderStatus::NewOrder->value,
            OrderStatus::AwaitingPayment->value,
            OrderStatus::InProgress->value,
        ];

        $posValues = [
            OrderStatus::InProgress->value,
            OrderStatus::Delivered->value,
        ];

        $entryOptions = [
            'manual' => array_values(array_filter($all, static fn (array $s) => in_array($s['value'], $manualValues, true))),
            'pos' => array_values(array_filter($all, static fn (array $s) => in_array($s['value'], $posValues, true))),
        ];

        return $this->success(['all' => $all, 'entry_options' => $entryOptions]);
    }

    /** Returns distinct payment methods used in orders for this company (for filter dropdown). */
    public function paymentMethods(): JsonResponse
    {
        $companyId = $this->currentCompany->id() ?? '';
        $methods = app(\Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface::class)
            ->listPaymentMethods($companyId);

        return $this->success($methods);
    }

    /** Returns distinct shipping companies (shipping_method) used in orders for this company. */
    public function shippingCompanies(): JsonResponse
    {
        $companyId = $this->currentCompany->id() ?? '';
        $companies = app(\Modules\Commerce\Orders\Domain\Contracts\OrderRepositoryInterface::class)
            ->listShippingCompanies($companyId);

        return $this->success($companies);
    }

    /**
     * Verifies payment proof and advances the order from Awaiting Payment (Phase 1).
     */
    public function verifyPayment(Request $request, string $order, VerifyPaymentAction $action): JsonResponse
    {
        $validated = $request->validate([
            'payment_proof_path' => 'nullable|string|max:500',
        ]);

        $model = Order::where('id', $order)
            ->where('company_id', $this->currentCompany->id())
            ->firstOrFail();

        $result = $action->execute($model, $validated['payment_proof_path'] ?? null);

        return $this->success(new OrderResource($result->data()), $result->message());
    }

    /**
     * Resolves a Google Maps short URL (maps.app.goo.gl) to its final URL so the
     * Manual Order form can extract embedded coordinates from short links.
     */
    public function resolveMapsUrl(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'url' => ['required', 'string', 'max:2000'],
        ]);

        $url = $validated['url'];

        if (! preg_match('/maps\.app\.goo\.gl|goo\.gl\/maps|google\.com\/maps|maps\.google\.com/', $url)) {
            return $this->success(['resolved_url' => $url]);
        }

        $finalUrl = $url;

        try {
            Http::withOptions([
                'allow_redirects' => ['max' => 10],
                'on_stats' => function (TransferStats $stats) use (&$finalUrl): void {
                    $finalUrl = (string) $stats->getEffectiveUri();
                },
            ])->withHeaders(['User-Agent' => 'Mozilla/5.0 (compatible; ECOS/1.0)'])
                ->timeout(8)
                ->head($url);
        } catch (Throwable) {
            // Network or resolution failure — return the original URL unchanged.
        }

        return $this->success(['resolved_url' => $finalUrl]);
    }

    /**
     * Records that a CRM operator called the customer and confirmed the order.
     * POST /orders/{order}/confirm-customer
     *
     * When result = 'confirmed' and the order is in a pre-execution status
     * (Pending | AwaitingPayment | Review | Rescheduled), the order status is
     * automatically transitioned to Confirmed via the canonical ConfirmOrderWorkflow
     * (inventory reservation + financial snapshot + audit trail).
     * Both the confirmation update and the status transition are committed atomically.
     */
    public function confirmCustomer(
        Request $request,
        string $order,
        FulfillmentEngine $engine,
        ConfirmOrderWorkflow $confirmWorkflow,
    ): JsonResponse {
        $validated = $request->validate([
            'communication_method' => ['required', 'string', 'in:phone,whatsapp,sms,email'],
            'result' => ['required', 'string', 'in:confirmed,not_answered,rejected,postponed'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $model = Order::where('id', $order)
            ->where('company_id', $this->currentCompany->id())
            ->firstOrFail();

        $actorId = $request->user()?->id !== null ? (string) $request->user()->id : null;
        $actorName = $request->user()?->name ?? 'system';

        // Pre-execution states where customer confirmation triggers automatic order status transition
        $preExecutionStatuses = [
            OrderStatus::NewOrder,
            OrderStatus::AwaitingPayment,
            OrderStatus::OnHold,
            OrderStatus::Scheduled,
        ];

        $shouldAutoConfirm = $validated['result'] === 'confirmed'
            && in_array($model->status, $preExecutionStatuses, true);

        // Guard outside transaction — precondition failure is a cheap fast-fail
        if ($shouldAutoConfirm) {
            $confirmWorkflow->guard(new FulfillmentContext($model, [], $actorId));
        }

        // Atomic: confirmation fields + order status transition (if applicable)
        DB::transaction(function () use ($model, $validated, $actorName, $actorId, $shouldAutoConfirm, $engine, $confirmWorkflow): void {
            $model->update([
                'confirmation_result' => $validated['result'],
                'customer_confirmed_at' => $validated['result'] === 'confirmed' ? now() : null,
                'customer_confirmed_by' => $actorName,
            ]);

            if ($shouldAutoConfirm) {
                $model->refresh();
                // engine->run() wraps execute() in its own savepoint (nested tx = savepoint in PostgreSQL)
                // Events and audit trail from the workflow are dispatched before the outer commit —
                // if the outer tx rolls back, all inventory + status writes roll back with it.
                $engine->run($confirmWorkflow, $model, [], $actorId);
            }
        });

        $model->refresh();

        // Post-commit: log the customer confirmation timeline event
        OrderEvent::logFromRequest(
            $request,
            orderId: $model->id,
            type: 'customer_confirmed',
            description: "Customer confirmation recorded via {$validated['communication_method']}. Result: {$validated['result']}."
                .($shouldAutoConfirm ? ' Order automatically transitioned to Confirmed.' : ''),
            actorId: $actorId,
            actorName: $actorName,
            actionType: 'customer',
            metadata: [
                'method' => $validated['communication_method'],
                'result' => $validated['result'],
                'notes' => $validated['notes'] ?? null,
                'auto_confirmed' => $shouldAutoConfirm,
            ],
        );

        return $this->updated(new OrderResource($model), 'Customer confirmation recorded.');
    }

    /**
     * Returns the enterprise audit timeline for an order.
     * GET /orders/{order}/activities
     *
     * Query params:
     *   action_type — filter by action category (workflow|payment|inventory|customer|shipping|system|automation|created|updated|deleted)
     *   module      — filter by module (orders|fulfillment)
     *   search      — full-text search in description and event_type
     */
    public function activities(Request $request, string $order): JsonResponse
    {
        $companyId = $this->currentCompany->id();

        $model = Order::where('id', $order)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->firstOrFail();

        $query = OrderEvent::where('order_id', $model->id);

        if ($actionType = $request->query('action_type')) {
            $query->where('action_type', $actionType);
        }

        if ($module = $request->query('module')) {
            $query->where('module', $module);
        }

        if ($search = $request->query('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('description', 'ilike', "%{$search}%")
                    ->orWhere('event_type', 'ilike', "%{$search}%")
                    ->orWhere('actor_name', 'ilike', "%{$search}%");
            });
        }

        $events = $query->orderBy('created_at', 'asc')
            ->get()
            ->map(fn ($e) => [
                'id' => $e->id,
                'event_type' => $e->event_type,
                'description' => $e->description,
                'actor_id' => $e->actor_id,
                'actor_name' => $e->actor_name,
                'actor_role' => $e->actor_role,
                'actor_email' => $e->actor_email,
                'actor_type' => $e->actor_type,
                'source' => $e->source,
                'action_type' => $e->action_type,
                'previous_value' => $e->previous_value,
                'new_value' => $e->new_value,
                'changed_fields' => $e->changed_fields,
                'reason' => $e->reason,
                'ip_address' => $e->ip_address,
                'user_agent' => $e->user_agent,
                'module' => $e->module ?? 'orders',
                'payload' => $e->payload,
                'metadata' => $e->metadata,
                'created_at' => $e->created_at?->toIso8601String(),
            ]);

        return $this->success($events);
    }

    /**
     * Adds a note to an order.
     * POST /orders/{order}/notes
     */
    public function addNote(Request $request, string $order): JsonResponse
    {
        $validated = $request->validate([
            'content' => ['required', 'string', 'max:2000'],
            'type' => ['nullable', 'string', 'in:internal,customer,ai'],
        ]);

        $companyId = $this->currentCompany->id();
        $model = Order::where('id', $order)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->firstOrFail();

        $type = $validated['type'] ?? 'internal';
        $actorId = $request->user()?->id !== null ? (string) $request->user()->id : null;
        $actorName = $request->user()?->name ?? 'system';
        $actorRole = $request->user()?->role ?? null;

        OrderNote::create([
            'order_id' => $model->id,
            'type' => $type === 'ai' ? 'system' : $type,
            'content' => $validated['content'],
            'user_id' => $actorId,
            'user_name' => $actorName,
            'user_role' => $actorRole,
        ]);

        OrderEvent::logFromRequest(
            $request,
            orderId: $model->id,
            type: 'note_added',
            description: "Note added ({$type}) by {$actorName}.",
            actorId: $actorId,
            actorName: $actorName,
            actionType: 'note',
            metadata: ['type' => $type, 'content' => $validated['content']],
        );

        $model->refresh();
        $model->load('orderNotes');

        return $this->updated(new OrderResource($model), 'Note added.');
    }

    /**
     * Edits an existing note.
     * PATCH /orders/{order}/notes/{note}
     */
    public function updateNote(Request $request, string $order, string $note): JsonResponse
    {
        $validated = $request->validate(['content' => ['required', 'string', 'max:2000']]);

        $companyId = $this->currentCompany->id();
        $model = Order::where('id', $order)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->firstOrFail();

        $noteModel = OrderNote::where('id', $note)->where('order_id', $model->id)->firstOrFail();

        $actorId = $request->user()?->id !== null ? (string) $request->user()->id : null;
        $actorName = $request->user()?->name ?? 'system';
        $oldContent = $noteModel->content;

        $noteModel->update([
            'content' => $validated['content'],
            'is_edited' => true,
            'edited_by_id' => $actorId,
            'edited_by_name' => $actorName,
            'edited_at' => now(),
        ]);

        OrderEvent::logFromRequest(
            $request,
            orderId: $model->id,
            type: 'note_updated',
            description: "Note edited by {$actorName}.",
            actorId: $actorId,
            actorName: $actorName,
            actionType: 'note',
            previousValue: ['content' => $oldContent],
            newValue: ['content' => $validated['content']],
        );

        return $this->success([
            'id' => $noteModel->id,
            'content' => $noteModel->content,
            'is_edited' => $noteModel->is_edited,
            'edited_by_name' => $noteModel->edited_by_name,
            'edited_at' => $noteModel->edited_at?->toIso8601String(),
        ], 'Note updated.');
    }

    /**
     * Soft-deletes a note.
     * DELETE /orders/{order}/notes/{note}
     */
    public function deleteNote(Request $request, string $order, string $note): JsonResponse
    {
        $companyId = $this->currentCompany->id();
        $model = Order::where('id', $order)
            ->when($companyId, fn ($q) => $q->where('company_id', $companyId))
            ->firstOrFail();

        $noteModel = OrderNote::where('id', $note)->where('order_id', $model->id)->firstOrFail();

        $actorId = $request->user()?->id !== null ? (string) $request->user()->id : null;
        $actorName = $request->user()?->name ?? 'system';
        $content = $noteModel->content;

        $noteModel->delete();

        OrderEvent::logFromRequest(
            $request,
            orderId: $model->id,
            type: 'note_deleted',
            description: "Note deleted by {$actorName}.",
            actorId: $actorId,
            actorName: $actorName,
            actionType: 'note',
            metadata: ['content_preview' => mb_substr($content, 0, 200)],
        );

        return $this->deleted('Note deleted.');
    }

    /**
     * Inline zone assignment — PATCH /orders/{order}/zone
     *
     * Accepts either a structured zone (id + label) or a free-text zone name.
     * Always creates an immutable audit entry so the change is traceable.
     */
    public function updateZone(Request $request, string $order): JsonResponse
    {
        $validated = $request->validate([
            'delivery_zone_id' => ['nullable', 'string', 'max:100'],
            'delivery_zone' => ['required', 'string', 'max:255'],
        ]);

        $model = Order::where('id', $order)
            ->where('company_id', $this->currentCompany->id())
            ->firstOrFail();

        $previousZone = $model->delivery_zone;

        $model->update([
            'delivery_zone_id' => $validated['delivery_zone_id'] ?? null,
            'delivery_zone' => $validated['delivery_zone'],
        ]);

        $model->refresh();

        OrderEvent::log(
            $model->id,
            'order_zone_updated',
            "Delivery zone updated from [{$previousZone}] to [{$model->delivery_zone}].",
            [
                'previous_zone' => $previousZone,
                'new_zone' => $model->delivery_zone,
                'new_zone_id' => $model->delivery_zone_id,
                'actor_id' => $request->user()?->id,
            ],
            $request->user()?->id !== null ? (string) $request->user()->id : null,
        );

        return $this->updated(new OrderResource($model));
    }
}
