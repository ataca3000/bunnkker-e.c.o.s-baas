<?php

declare(strict_types=1);

namespace Modules\Commerce\Orders\Application\Actions;

use App\Core\Actions\BaseAction;
use App\Core\Responses\OperationResult;
use Illuminate\Support\Facades\Auth;
use Modules\Admin\Configuration\Domain\Services\ConfigurationManager;
use Modules\Commerce\Channels\Domain\Models\Channel;
use Modules\Commerce\Orders\Domain\Enums\OrderStatus;
use Modules\Commerce\Orders\Domain\Models\Order;
use Modules\Commerce\Orders\Domain\Models\OrderEvent;
use ValueError;

/**
 * Verifies payment proof for an order in Awaiting Payment status.
 *
 * Transitions the order to the brand's configured entry status for its source.
 * Called via POST /orders/{order}/verify-payment.
 */
final class VerifyPaymentAction extends BaseAction
{
    public function __construct(
        private readonly ConfigurationManager $config,
    ) {}

    /**
     * @param  mixed  ...$arguments  [0] = Order model, [1] = optional proof path string
     */
    public function execute(mixed ...$arguments): OperationResult
    {
        /** @var Order $order */
        $order = $arguments[0];
        $proofPath = isset($arguments[1]) && $arguments[1] !== '' ? (string) $arguments[1] : null;

        if ($order->status !== OrderStatus::AwaitingPayment->value) {
            abort(422, 'Order must be in Awaiting Payment status to verify payment.');
        }

        $targetStatus = $this->resolveTargetStatus($order);

        $updates = ['status' => $targetStatus];
        if ($proofPath !== null) {
            $updates['payment_proof_path'] = $proofPath;
        }

        $order->update($updates);

        $actorId = Auth::id() !== null ? (string) Auth::id() : null;

        OrderEvent::log($order->id, 'payment_verified', 'Payment proof verified. Order advanced.', [
            'to_status' => $targetStatus,
            'proof_path' => $proofPath,
        ], $actorId);

        return OperationResult::success($order->fresh(), 'Payment verified. Order is now '.$targetStatus.'.');
    }

    private function resolveTargetStatus(Order $order): string
    {
        if ($order->channel_id !== null) {
            $channel = Channel::find($order->channel_id);
            if ($channel !== null) {
                $policy = $this->config->getBrandPolicy((string) $channel->brand_id, 'order');
                $entryStatus = $policy['source_entry_policies']['manual'] ?? null;

                if ($entryStatus !== null && $entryStatus !== 'preserve') {
                    try {
                        $resolved = OrderStatus::from($entryStatus);
                        // Circular guard: never return awaiting_payment as target
                        if ($resolved !== OrderStatus::AwaitingPayment) {
                            return $resolved->value;
                        }
                    } catch (ValueError) { /* fall through */
                    }
                }
            }
        }

        return OrderStatus::InProgress->value;
    }
}
