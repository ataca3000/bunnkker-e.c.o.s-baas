<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\ValueObjects;

/**
 * Structured reason attached to a decision.
 *
 * Callers (Decision Log, Command Center, AI Engine) read `code` programmatically
 * and `message` for display. `context` carries the dynamic values that produced
 * this specific reason (e.g. shortage quantities, threshold values).
 */
final readonly class DecisionReason
{
    /**
     * @param  array<string, mixed>  $context  Dynamic values that explain the reason.
     */
    public function __construct(
        /** Machine-readable reason code (e.g. "INSUFFICIENT_STOCK", "RECIPE_INVALID"). */
        public string $code,

        /** Human-readable explanation. */
        public string $message,

        public array $context = [],
    ) {}

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'code' => $this->code,
            'message' => $this->message,
            'context' => $this->context,
        ];
    }
}
