<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Presentation\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Operations\Fulfillment\Application\Services\BulkWorkflowEngine;
use Modules\Operations\Fulfillment\Application\Workflows\CancelOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteDeliveryWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\CompleteOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ConfirmOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\DispatchOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MarkAwaitingStockWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToPreparationWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\MoveToReviewWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\RescheduleOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ResumeOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ResumeToConfirmedWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnOrderWorkflow;
use Modules\Operations\Fulfillment\Application\Workflows\ReturnToConfirmedWorkflow;
use Throwable;

/**
 * Bulk fulfillment endpoints — run a workflow across multiple orders in one request.
 *
 * Each order is processed independently: a failure on one does not affect others.
 * Responses always return 200 with a per-order breakdown.
 */
final class BulkFulfillmentController extends Controller
{
    public function __construct(
        private readonly BulkWorkflowEngine $bulk,
        private readonly ConfirmOrderWorkflow $confirmWorkflow,
        private readonly CancelOrderWorkflow $cancelWorkflow,
        private readonly MoveToPreparationWorkflow $prepWorkflow,
        private readonly CompleteDeliveryWorkflow $deliveryWorkflow,
        private readonly CompleteOrderWorkflow $completeWorkflow,
        private readonly DispatchOrderWorkflow $dispatchWorkflow,
        private readonly MarkAwaitingStockWorkflow $awaitingStockWorkflow,
        private readonly ResumeOrderWorkflow $resumeWorkflow,
        private readonly MoveToReviewWorkflow $reviewWorkflow,
        private readonly RescheduleOrderWorkflow $rescheduleWorkflow,
        private readonly ReturnOrderWorkflow $returnWorkflow,
        private readonly ReturnToConfirmedWorkflow $returnToConfirmedWorkflow,
        private readonly ResumeToConfirmedWorkflow $resumeToConfirmedWorkflow,
    ) {}

    /** POST /api/fulfillment/bulk/confirm */
    public function confirmBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->confirmWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/cancel */
    public function cancelBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run(
            $this->cancelWorkflow,
            $data['order_ids'],
            ['reason' => $data['reason'] ?? null],
            $actorId,
        );

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/move-to-preparation */
    public function moveToPreparationBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->prepWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/complete-delivery */
    public function completeDeliveryBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->deliveryWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/complete */
    public function completeBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->completeWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/dispatch */
    public function dispatchBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->dispatchWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/awaiting-stock */
    public function markAwaitingStockBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run(
            $this->awaitingStockWorkflow,
            $data['order_ids'],
            ['reason' => $data['reason'] ?? null],
            $actorId,
        );

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/resume */
    public function resumeBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->resumeWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/review */
    public function moveToReviewBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
            'reason' => ['nullable', 'string', 'max:500'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run(
            $this->reviewWorkflow,
            $data['order_ids'],
            ['reason' => $data['reason'] ?? null],
            $actorId,
        );

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/reschedule */
    public function rescheduleBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
            'next_delivery_date' => ['required', 'date', 'after:today'],
            'reschedule_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run(
            $this->rescheduleWorkflow,
            $data['order_ids'],
            [
                'next_delivery_date' => $data['next_delivery_date'],
                'reschedule_reason' => $data['reschedule_reason'] ?? null,
            ],
            $actorId,
        );

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/return — auto-generates return lines from order items */
    public function returnBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
            'return_reason' => ['nullable', 'string', 'max:200'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $returnReason = $data['return_reason'] ?? 'Bulk return';
        $succeeded = [];
        $failed = [];

        foreach ($data['order_ids'] as $orderId) {
            $order = Order::with('lines.product')->find($orderId);

            if ($order === null) {
                $failed[$orderId] = 'Order not found.';

                continue;
            }

            // Auto-generate lines from order line items
            $lines = $order->lines->map(static fn ($line) => [
                'order_line_id' => $line->id,
                'product_id' => $line->product_id,
                'quantity_returned' => (float) $line->quantity,
                'condition' => 'sellable',
            ])->all();

            if (empty($lines)) {
                $failed[$orderId] = 'Order has no line items.';

                continue;
            }

            try {
                $engine = app(\Modules\Operations\Fulfillment\Application\FulfillmentEngine::class);
                $result = $engine->run(
                    $this->returnWorkflow,
                    $order,
                    ['return_reason' => $returnReason, 'driver_notes' => null, 'lines' => $lines],
                    $actorId,
                );
                $succeeded[$orderId] = $result;
            } catch (\Modules\Operations\Fulfillment\Domain\Exceptions\WorkflowPreconditionException $e) {
                $failed[$orderId] = $e->getMessage();
            } catch (Throwable $e) {
                $failed[$orderId] = 'Execution error: '.$e->getMessage();
            }
        }

        return response()->json([
            'succeeded' => count($succeeded),
            'failed' => count($failed),
            'errors' => $failed,
        ]);
    }

    /** POST /api/fulfillment/bulk/return-to-confirmed */
    public function returnToConfirmedBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->returnToConfirmedWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }

    /** POST /api/fulfillment/bulk/resume-to-confirmed */
    public function resumeToConfirmedBulk(Request $request): JsonResponse
    {
        $data = $request->validate([
            'order_ids' => ['required', 'array', 'min:1', 'max:200'],
            'order_ids.*' => ['required', 'string'],
        ]);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;
        $result = $this->bulk->run($this->resumeToConfirmedWorkflow, $data['order_ids'], [], $actorId);

        return response()->json($result->toArray());
    }
}
