<?php

declare(strict_types=1);

namespace Modules\Operations\OrderLifecycle\Application\DTOs;

use Modules\Manufacturing\ManufacturingPolicy\Domain\ValueObjects\ManufacturingPolicyResult;
use Modules\Manufacturing\ManufacturingService\Application\DTOs\Responses\ManufactureProductResponse;
use Modules\Operations\OrderLifecycle\Domain\Enums\LifecycleAction;

/**
 * Immutable output of OrderLifecycleCoordinator::handle().
 *
 * Check `action` for the specific outcome:
 *   StatusIgnored               → handled=false, policy_result=null, mfg_result=null
 *   PolicyRejected              → handled=false, policy_result=set,  mfg_result=null
 *   ManufacturingTriggered      → handled=true,  policy_result=set,  mfg_result=set
 *   ManufacturingBlocked        → handled=false, policy_result=set,  mfg_result=set
 *   ManufacturingNotRequired    → handled=false, policy_result=set,  mfg_result=set
 *   ManufacturingAlreadyExecuted → handled=false, policy_result=set, mfg_result=null
 */
final readonly class OrderLifecycleResult
{
    /**
     * @param  array<string, mixed>  $metadata
     */
    public function __construct(
        public string $order_id,
        public string $order_line_id,

        /** True only when manufacturing was successfully triggered. */
        public bool $handled,

        public LifecycleAction $action,

        /** Human-readable explanation of the outcome. */
        public string $reason,

        /** Null when status was ignored (policy never ran). */
        public ?ManufacturingPolicyResult $policy_result,

        /** Null when policy rejected or status was ignored (manufacturing never ran). */
        public ?ManufactureProductResponse $manufacturing_result,

        public array $metadata,
    ) {}

    public static function statusIgnored(
        string $orderId,
        string $orderLineId,
        string $reason,
        array $metadata = [],
    ): self {
        return new self(
            order_id: $orderId,
            order_line_id: $orderLineId,
            handled: false,
            action: LifecycleAction::StatusIgnored,
            reason: $reason,
            policy_result: null,
            manufacturing_result: null,
            metadata: $metadata,
        );
    }

    public static function policyRejected(
        string $orderId,
        string $orderLineId,
        ManufacturingPolicyResult $policyResult,
    ): self {
        return new self(
            order_id: $orderId,
            order_line_id: $orderLineId,
            handled: false,
            action: LifecycleAction::PolicyRejected,
            reason: $policyResult->reason,
            policy_result: $policyResult,
            manufacturing_result: null,
            metadata: $policyResult->metadata,
        );
    }

    public static function manufacturingTriggered(
        string $orderId,
        string $orderLineId,
        ManufacturingPolicyResult $policyResult,
        ManufactureProductResponse $mfgResult,
    ): self {
        return new self(
            order_id: $orderId,
            order_line_id: $orderLineId,
            handled: true,
            action: LifecycleAction::ManufacturingTriggered,
            reason: 'Manufacturing triggered successfully.',
            policy_result: $policyResult,
            manufacturing_result: $mfgResult,
            metadata: $mfgResult->metadata,
        );
    }

    public static function manufacturingBlocked(
        string $orderId,
        string $orderLineId,
        ManufacturingPolicyResult $policyResult,
        ManufactureProductResponse $mfgResult,
    ): self {
        return new self(
            order_id: $orderId,
            order_line_id: $orderLineId,
            handled: false,
            action: LifecycleAction::ManufacturingBlocked,
            reason: 'Manufacturing workflow was blocked: '.($mfgResult->blocking_reason ?? 'unknown'),
            policy_result: $policyResult,
            manufacturing_result: $mfgResult,
            metadata: $mfgResult->metadata,
        );
    }

    public static function manufacturingNotRequired(
        string $orderId,
        string $orderLineId,
        ManufacturingPolicyResult $policyResult,
        ManufactureProductResponse $mfgResult,
    ): self {
        return new self(
            order_id: $orderId,
            order_line_id: $orderLineId,
            handled: false,
            action: LifecycleAction::ManufacturingNotRequired,
            reason: 'Manufacturing is not required: sufficient finished goods already in stock.',
            policy_result: $policyResult,
            manufacturing_result: $mfgResult,
            metadata: $mfgResult->metadata,
        );
    }

    public static function manufacturingAlreadyExecuted(
        string $orderId,
        string $orderLineId,
        ManufacturingPolicyResult $policyResult,
    ): self {
        return new self(
            order_id: $orderId,
            order_line_id: $orderLineId,
            handled: false,
            action: LifecycleAction::ManufacturingAlreadyExecuted,
            reason: 'Manufacturing already completed for this order line.',
            policy_result: $policyResult,
            manufacturing_result: null,
            metadata: $policyResult->metadata,
        );
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'order_id' => $this->order_id,
            'order_line_id' => $this->order_line_id,
            'handled' => $this->handled,
            'action' => $this->action->value,
            'reason' => $this->reason,
            'policy_result' => $this->policy_result?->toArray(),
            'manufacturing_result' => $this->manufacturing_result?->toArray(),
            'metadata' => $this->metadata,
        ];
    }
}
