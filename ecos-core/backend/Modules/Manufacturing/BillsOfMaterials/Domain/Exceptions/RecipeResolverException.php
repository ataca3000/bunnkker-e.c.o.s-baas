<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Domain\Exceptions;

use RuntimeException;

/**
 * Thrown by RecipeResolver when a Recipe cannot be resolved to a valid snapshot.
 *
 * Use the named constructors to create instances with structured reason codes.
 * Callers (Decision Engine, Manufacturing Engine) should catch this exception and
 * map the reason code to the appropriate decision outcome (e.g. FAIL_NO_RECIPE).
 */
final class RecipeResolverException extends RuntimeException
{
    public const NO_ACTIVE_RECIPE = 'no_active_recipe';

    public const NO_COMPONENTS = 'no_components';

    public const COMPONENT_NOT_FOUND = 'component_not_found';

    public const COMPONENT_INACTIVE = 'component_inactive';

    public const COMPONENT_MISSING_UNIT = 'component_missing_unit';

    public const PRODUCT_UNAVAILABLE = 'product_unavailable';

    private function __construct(
        string $message,
        private readonly string $reason,
        private readonly string $context,
    ) {
        parent::__construct($message);
    }

    public static function noActiveRecipe(string $productId): self
    {
        return new self(
            "No active recipe found for product [{$productId}].",
            self::NO_ACTIVE_RECIPE,
            $productId,
        );
    }

    public static function noComponents(string $recipeId): self
    {
        return new self(
            "Recipe [{$recipeId}] has no components.",
            self::NO_COMPONENTS,
            $recipeId,
        );
    }

    /** Component product row is missing (soft-deleted or hard-deleted). */
    public static function componentNotFound(string $componentId): self
    {
        return new self(
            "Component product [{$componentId}] not found or has been deleted.",
            self::COMPONENT_NOT_FOUND,
            $componentId,
        );
    }

    public static function componentInactive(string $sku): self
    {
        return new self(
            "Component product [{$sku}] is inactive and cannot be used in manufacturing.",
            self::COMPONENT_INACTIVE,
            $sku,
        );
    }

    /** Component product exists but has no unit assigned. */
    public static function componentMissingUnit(string $sku): self
    {
        return new self(
            "Component product [{$sku}] has no unit assigned.",
            self::COMPONENT_MISSING_UNIT,
            $sku,
        );
    }

    /** The output product for the recipe is soft-deleted or inactive. */
    public static function productUnavailable(string $productId): self
    {
        return new self(
            "Output product [{$productId}] is unavailable (deleted or inactive).",
            self::PRODUCT_UNAVAILABLE,
            $productId,
        );
    }

    /** Structured reason code for programmatic handling by the Decision Engine. */
    public function reason(): string
    {
        return $this->reason;
    }

    /** The identifier (product ID, recipe ID, SKU) that triggered the failure. */
    public function context(): string
    {
        return $this->context;
    }
}
