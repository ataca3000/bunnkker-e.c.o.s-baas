<?php

declare(strict_types=1);

namespace Modules\Organization\Branches\Domain\Exceptions;

use App\Core\Exceptions\BusinessException;

/**
 * Thrown when a second head-office branch is created for the same company.
 * Maps to HTTP 422.
 */
final class DuplicateHeadOfficeException extends BusinessException
{
    public function __construct()
    {
        parent::__construct(
            'This company already has a head office branch.',
            ['is_head_office' => ['Only one head office is allowed per company.']],
            422,
        );
    }
}
