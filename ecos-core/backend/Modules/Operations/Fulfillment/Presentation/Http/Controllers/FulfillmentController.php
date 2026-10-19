<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\FulfillmentEngine;
use Modules\Operations\Fulfillment\Application\Workflows\ApprovePartialReservationWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CancelOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteDeliveryWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ConfirmOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\DispatchOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MarkAwaitingStockWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MarkRescheduledWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToReviewWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ProcessOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReceiveReturnWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\RescheduleOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ResumeOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToPaymentWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToPendingWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToProcessingWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\RevertToConfirmedWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\SetEarlyStatusWorkflow;
use Modules\Operations\Fulfillment\Domain\Contracts\FulfillmentWorkflowInterface;
use Modules\Operations\Fulfillment\Domain\Models\CustomerReturn;

final class FulfillmentController extends Controller
{
    public function __construct(
        private readonly FulfillmentEngine $engine,
        private readonly ConfirmOrderWorkflow $confirmWorkflow,
        private readonly CancelOrderWorkflow $cancelWorkflow,
        private readonly MoveToPreparationWorkflow $prepWorkflow,
        private readonly DispatchOrderWorkflow $dispatchWorkflow,
        private readonly CompleteDeliveryWorkflow $deliveryWorkflow,
        private readonly CompleteOrderWorkflow $completeWorkflow,
        private readonly MarkAwaitingStockWorkflow $awaitingStockWorkflow,
        private readonly ReturnOrderWorkflow $returnWorkflow,
        private readonly ReceiveReturnWorkflow $receiveReturnWorkflow,
        private readonly RescheduleOrderWorkflow $rescheduleWorkflow,
        private readonly ResumeOrderWorkflow $resumeWorkflow,
        private readonly MoveToReviewWorkflow $reviewWorkflow,
        private readonly ReturnToPendingWorkflow $returnToPendingWorkflow,
        private readonly RevertToConfirmedWorkflow $revertToConfirmedWorkflow,
        private readonly ReturnToProcessingWorkflow $returnToProcessingWorkflow,
        // V2 workflows
        private readonly ProcessOrderWorkflow $processWorkflow,
        private readonly ReturnToPaymentWorkflow $returnToPaymentWorkflow,
        private readonly SetEarlyStatusWorkflow $setEarlyStatusWorkflow,
        private readonly MarkRescheduledWorkflow $markRescheduledWorkflow,
        // P1 workflows
        private readonly ApprovePartialReservationWorkflow $approvePartialReservationWorkflow,
    ) {}

    /** POST /api/fulfillment/orders/{order}/confirm
     *  pending | awaiting_payment | processing | awaiting_stock → confirmed
     */
    public function confirm(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->confirmWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
            'meta' => $result->meta,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/cancel
     *  Any pre-delivery state → cancelled
     */
    public function cancel(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $result = $this->engine->run(
            $this->cancelWorkflow,
            $order,
            ['reason' => $data['reason'] ?? null],
            $actorId,
        );

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/approve-partial-reservation
     *  P1-002 — Manager approval gate: allows PartialReserved → Preparing.
     *  Body: { notes?: string }
     */
    public function approvePartialReservation(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['notes' => ['nullable', 'string', 'max:1000']]);
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $result = $this->engine->run(
            $this->approvePartialReservationWorkflow,
            $order,
            ['notes' => $data['notes'] ?? null],
            $actorId,
        );

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'approved_at' => $result->meta['approved_at'] ?? null,
            'approved_by' => $result->meta['approved_by'] ?? null,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/move-to-preparation
     *  confirmed | processing → preparing
     */
    public function moveToPreparation(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->prepWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/complete-delivery
     *  out_for_delivery → delivered  (triggers revenue recognition)
     */
    public function completeDelivery(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->deliveryWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
            'meta' => $result->meta,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/complete
     *  delivered → completed  (financial completion)
     */
    public function complete(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->completeWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
            'meta' => $result->meta,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/awaiting-stock
     *  processing | confirmed → awaiting_stock
     */
    public function markAwaitingStock(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $result = $this->engine->run(
            $this->awaitingStockWorkflow,
            $order,
            ['reason' => $data['reason'] ?? null],
            $actorId,
        );

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/return
     *  out_for_delivery | delivered → returned
     */
    public function returnOrder(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'return_reason' => ['required', 'string', 'max:200'],
            'driver_notes' => ['nullable', 'string', 'max:1000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.order_line_id' => ['nullable', 'string'],
            'lines.*.product_id' => ['required', 'string'],
            'lines.*.quantity_returned' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.condition' => ['nullable', 'string', 'in:sellable,damaged,destroyed'],
            'lines.*.inspection_notes' => ['nullable', 'string', 'max:500'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->returnWorkflow, $order, $data, $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
            'customer_return_id' => $result->meta['customer_return_id'] ?? null,
            'return_number' => $result->meta['return_number'] ?? null,
        ], 201);
    }

    /** POST /api/fulfillment/orders/{order}/reschedule
     *  Any pre-terminal non-rescheduled state → rescheduled
     */
    public function reschedule(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'next_delivery_date' => ['required', 'date', 'after:today'],
            'reschedule_reason' => ['nullable', 'string', 'max:500'],
            'resume_from_status' => ['nullable', 'string', 'max:50'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $result = $this->engine->run(
            $this->rescheduleWorkflow,
            $order,
            $data,
            $actorId,
        );

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
            'next_delivery_date' => $result->meta['next_delivery_date'] ?? null,
            'resume_from_status' => $result->meta['resume_from_status'] ?? null,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/resume
     *  rescheduled | review → processing (or stored resume_from_status)
     */
    public function resume(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->resumeWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/dispatch
     *  preparing → out_for_delivery (direct dispatch, no loading OS)
     */
    public function dispatch(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->dispatchWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/review
     *  Any pre-terminal non-review state → review
     */
    public function moveToReview(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate(['reason' => ['nullable', 'string', 'max:500']]);
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $result = $this->engine->run(
            $this->reviewWorkflow,
            $order,
            ['reason' => $data['reason'] ?? null],
            $actorId,
        );

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/return-to-pending
     *  confirmed → pending  (releases inventory, unlocks structural edits)
     */
    public function returnToPending(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->returnToPendingWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/revert-to-confirmed
     *  processing | awaiting_stock | review → confirmed  (no inventory change)
     */
    public function revertToConfirmed(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->revertToConfirmedWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /** POST /api/fulfillment/orders/{order}/return-to-processing
     *  preparing → processing
     */
    public function returnToProcessing(Order $order): JsonResponse
    {
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->engine->run($this->returnToProcessingWorkflow, $order, [], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
        ]);
    }

    /**
     * POST /api/fulfillment/orders/{order}/transition
     *
     * Generic transition endpoint: frontend sends target_status (a business state),
     * this method resolves the correct workflow internally.
     * The frontend MUST NOT hardcode workflow names or action keys.
     */
    public function transition(Request $request, Order $order): JsonResponse
    {
        $data = $request->validate([
            'target_status' => ['required', 'string', 'max:50'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $current = $order->status->value;
        $target = $data['target_status'];
        $reason = $data['reason'] ?? null;
        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        $workflow = $this->resolveTransitionWorkflow($current, $target);

        if ($workflow === null) {
            return response()->json([
                'message' => "Transition from [{$current}] to [{$target}] is not allowed.",
            ], 422);
        }

        $result = $this->engine->run($workflow, $order, ['target_status' => $target, 'reason' => $reason], $actorId);

        return response()->json([
            'message' => $result->message,
            'order_id' => $result->order->id,
            'status' => $result->order->status->value,
            'meta' => $result->meta,
        ]);
    }

    /**
     * V2 transition routing table — the ONLY place that maps (current, target) → workflow.
     *
     * Architecture rules (TASK-ORDER-WORKFLOW-V2-001):
     *   - Cancelled is not terminal; orders may be reopened from cancelled.
     *   - Processing and Confirmed both reserve inventory and lock products.
     *   - Delivering from Preparing → OutForDelivery → Delivered → Completed.
     *   - Returning to Pending or Payment releases inventory (products become editable).
     *   - Moving between other early states keeps any existing reservation.
     */
    private function resolveTransitionWorkflow(string $current, string $target): ?FulfillmentWorkflowInterface
    {
        // Block self-transitions
        if ($current === $target) {
            return null;
        }

        // ── Helper sets ───────────────────────────────────────────────────────────
        // Early states: no inventory held (or inventory was released).
        // 'scheduled' is a pre-activation early state; guard in ProcessOrderWorkflow
        // enforces the delivery-date constraint before allowing activation.
        $earlyStates = ['scheduled', 'pending', 'awaiting_payment', 'awaiting_stock', 'rescheduled', 'review', 'cancelled'];
        // Reserved states: inventory is held and products are locked
        $reservedStates = ['processing', 'confirmed'];

        // ── 1. Execution chain ────────────────────────────────────────────────────
        if ($current === 'processing' && $target === 'preparing') {
            return $this->prepWorkflow;
        }
        if ($current === 'preparing' && $target === 'out_for_delivery') {
            return $this->dispatchWorkflow;
        }
        if ($current === 'out_for_delivery' && $target === 'delivered') {
            return $this->deliveryWorkflow;
        }
        if ($current === 'delivered' && $target === 'completed') {
            return $this->completeWorkflow;
        }
        if (in_array($current, ['out_for_delivery', 'delivered'], true) && $target === 'returned') {
            return $this->returnWorkflow;
        }

        // ── 2. Block locked states from using this endpoint ───────────────────────
        $locked = ['preparing', 'out_for_delivery', 'delivered', 'returned', 'completed'];
        if (in_array($current, $locked, true)) {
            return null;
        }

        // ── 3. Cancel → always CancelOrderWorkflow (handles inventory release) ────
        if ($target === 'cancelled') {
            return $this->cancelWorkflow;
        }

        // ── 4. TO confirmed ───────────────────────────────────────────────────────
        // processing → confirmed: both reserved, just a status label change
        if ($current === 'processing' && $target === 'confirmed') {
            return $this->setEarlyStatusWorkflow;
        }
        // early → confirmed: idempotent reservation (reserves if not already held)
        if (in_array($current, $earlyStates, true) && $target === 'confirmed') {
            return $this->confirmWorkflow;
        }

        // ── 5. TO processing ──────────────────────────────────────────────────────
        // confirmed → processing: both reserved, just a status label change
        if ($current === 'confirmed' && $target === 'processing') {
            return $this->setEarlyStatusWorkflow;
        }
        // early → processing: idempotent reservation (reserves if not already held)
        if (in_array($current, $earlyStates, true) && $target === 'processing') {
            return $this->processWorkflow;
        }

        // ── 6. TO pending ─────────────────────────────────────────────────────────
        // reserved → pending: release inventory (products become editable)
        if (in_array($current, $reservedStates, true) && $target === 'pending') {
            return $this->returnToPendingWorkflow;
        }
        // early → pending: simple status change, no inventory
        if (in_array($current, $earlyStates, true) && $target === 'pending') {
            return $this->setEarlyStatusWorkflow;
        }

        // ── 7. TO awaiting_payment (Payment) ──────────────────────────────────────
        // reserved → payment: release inventory (products become editable)
        if (in_array($current, $reservedStates, true) && $target === 'awaiting_payment') {
            return $this->returnToPaymentWorkflow;
        }
        // early → payment: simple status change, no inventory
        if (in_array($current, $earlyStates, true) && $target === 'awaiting_payment') {
            return $this->setEarlyStatusWorkflow;
        }

        // ── 8. TO awaiting_stock ──────────────────────────────────────────────────
        // All allowed sources: keep any existing reservation, just change status
        if (in_array($current, array_merge($earlyStates, $reservedStates), true) && $target === 'awaiting_stock') {
            return $this->awaitingStockWorkflow;
        }

        // ── 9. TO review ──────────────────────────────────────────────────────────
        // All allowed sources: keep any existing reservation, just change status
        if (in_array($current, array_merge($earlyStates, $reservedStates), true) && $target === 'review') {
            return $this->reviewWorkflow;
        }

        // ── 10. TO rescheduled ────────────────────────────────────────────────────
        // All allowed sources: keep any existing reservation, just change status
        if (in_array($current, array_merge($earlyStates, $reservedStates), true) && $target === 'rescheduled') {
            return $this->markRescheduledWorkflow;
        }

        return null;
    }

    /** POST /api/fulfillment/returns/{customerReturn}/receive */
    public function receiveReturn(Request $request, CustomerReturn $customerReturn): JsonResponse
    {
        $data = $request->validate([
            'warehouse_notes' => ['nullable', 'string', 'max:1000'],
            'line_conditions' => ['nullable', 'array'],
            'line_conditions.*' => ['string', 'in:sellable,damaged,destroyed'],
        ]);

        $updated = $this->receiveReturnWorkflow->execute(
            $customerReturn,
            (string) Auth::id(),
            $data['warehouse_notes'] ?? null,
            $data['line_conditions'] ?? [],
        );

        return response()->json([
            'message' => "CustomerReturn #{$updated->return_number} accepted.",
            'customer_return_id' => $updated->id,
            'status' => $updated->status,
            'inventory_restored_at' => $updated->inventory_restored_at?->toIso8601String(),
        ]);
    }
}
