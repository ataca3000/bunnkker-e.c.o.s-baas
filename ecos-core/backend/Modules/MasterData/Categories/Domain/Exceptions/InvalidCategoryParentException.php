<?php

declare(strict_types=1);

namespace Modules\MasterData\Categories\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a category is set as its own parent. Maps to HTTP 422.
 */
final class InvalidCategoryParentException extends BusinessException
{
    public function __construct()
    {
        parent::__construct(
            'A category cannot be its own parent.',
            ['parent_id' => ['Invalid parent category.']],
            422,
        );
    }
}
