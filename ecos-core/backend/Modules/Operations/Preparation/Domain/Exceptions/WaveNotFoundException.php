<?php

declare(strict_types=1);

namespace Modules\Operations\Preparation\Domain\Exceptions;

use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

/**
 * Renders as 404, not 500.
 *
 * Follows the platform's established convention for domain not-found errors —
 * ChannelNotFoundException, OrderNotFoundException, ProductMappingNotFoundException
 * and StockMovementNotFoundException all extend NotFoundHttpException. Extending
 * RuntimeException left this one unmapped, so a missing wave — including one
 * belonging to another company — surfaced as a 500 instead of a clean 404.
 *
 * Symfony's HttpException itself extends RuntimeException, so any existing
 * `catch (RuntimeException)` continues to match.
 */
final class WaveNotFoundException extends NotFoundHttpException
{
    public static function forId(string $id): self
    {
        return new self("Preparation wave [{$id}] not found.");
    }
}
