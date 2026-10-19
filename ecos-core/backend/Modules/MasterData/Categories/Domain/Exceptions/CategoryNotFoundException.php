<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a category cannot be found. Maps to HTTP 404.
 */
final class CategoryNotFoundException extends BusinessException
{
    public function __construct()
    {
        parent::__construct('Category not found.', [], 404);
    }
}
