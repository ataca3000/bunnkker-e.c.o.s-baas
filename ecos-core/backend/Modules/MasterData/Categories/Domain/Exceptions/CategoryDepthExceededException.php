<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when creating/moving a category would exceed the maximum depth of
 * 3 levels. Maps to HTTP 422.
 */
final class CategoryDepthExceededException extends BusinessException
{
    public function __construct()
    {
        parent::__construct(
            'Categories cannot be nested deeper than 3 levels.',
            ['parent_id' => ['Maximum category depth (3 levels) exceeded.']],
            422,
        );
    }
}
