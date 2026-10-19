<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionKernel\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown by DecisionKernel when the rule set contains no rule that matches the
 * given DecisionContext.
 *
 * The caller is responsible for handling this case — the kernel does not assume
 * a default outcome. Different callers may choose to:
 *   - Return a safe default (DEFER)
 *   - Re-throw as a domain exception
 *   - Log and escalate
 */
final class NoMatchingRuleException extends RuntimeException
{
    private function __construct(
        string $message,
        private readonly string $context_type,
    ) {
        parent::__construct($message);
    }

    public static function forContext(string $contextType): self
    {
        return new self(
            "No rule matched for context type [{$contextType}]. Register at least one rule that covers this context.",
            $contextType,
        );
    }

    public function contextType(): string
    {
        return $this->context_type;
    }
}
