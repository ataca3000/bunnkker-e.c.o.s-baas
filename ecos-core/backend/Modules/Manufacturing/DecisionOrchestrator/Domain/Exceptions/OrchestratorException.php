<?php

declare(strict_types=1);

namespace Modules\Manufacturing\DecisionOrchestrator\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown by DecisionOrchestrator for configuration or parameter errors.
 *
 * Domain-layer exceptions from the Kernel (NoMatchingRuleException) and
 * Resolver (RecipeResolverException) propagate unchanged. This exception
 * covers only Orchestrator-specific validation failures.
 */
final class OrchestratorException extends RuntimeException
{
    public const MISSING_PRODUCT_ID = 'missing_product_id';

    private function __construct(
        string $message,
        private readonly string $reason,
    ) {
        parent::__construct($message);
    }

    /**
     * Thrown when a builder declares requiresRecipe() = true but
     * no `product_id` key was supplied in $parameters.
     */
    public static function missingProductId(string $contextType): self
    {
        return new self(
            "Context type [{$contextType}] requires recipe resolution, "
            ."but 'product_id' was not supplied in parameters.",
            self::MISSING_PRODUCT_ID,
        );
    }

    public function reason(): string
    {
        return $this->reason;
    }
}
