<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown by RuleProviderRegistry when no provider is registered for a context type.
 *
 * Callers must register at least one RuleProvider per context type they orchestrate.
 */
final class NoProviderForContextException extends RuntimeException
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
            "No rule provider registered for context type [{$contextType}]. "
            .'Call RuleProviderRegistryInterface::register() before orchestrating.',
            $contextType,
        );
    }

    public function contextType(): string
    {
        return $this->context_type;
    }
}
