<?php

declare(strict_types=1);

namespace Modules\Operations\Fulfillment\Application;

/**
 * Thread-local flag owned by FulfillmentEngine.
 *
 * FulfillmentEngine::run() sets this true before calling workflow->execute()
 * and resets it false after. The Order model's booted() hook checks this flag
 * in the 'updating' event — any status mutation while the flag is false is an
 * unauthorized bypass of the fulfillment pipeline.
 *
 * LoadVehicleWorkflow (vehicle-level batch dispatcher) must call
 * withAuthorization() to explicitly register its own delegated authority.
 */
final class OrderStatusGuard
{
    private static bool $active = false;

    public static function activate(): void
    {
        self::$active = true;
    }

    public static function deactivate(): void
    {
        self::$active = false;
    }

    public static function isActive(): bool
    {
        return self::$active;
    }

    /**
     * Run a callable with the guard active, then restore to inactive.
     * Use ONLY in explicitly authorized non-workflow code paths
     * (e.g. vehicle-level batch dispatch that ships multiple orders atomically).
     */
    public static function withAuthorization(callable $fn): mixed
    {
        self::$active = true;
        try {
            return $fn();
        } finally {
            self::$active = false;
        }
    }
}
