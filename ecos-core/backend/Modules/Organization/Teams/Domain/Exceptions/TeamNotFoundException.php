<?php

declare(strict_types=1);

namespace Modules\Organization\Teams\Domain\Exceptions;

use RuntimeException;

final class TeamNotFoundException extends RuntimeException
{
    public function __construct(string $id = '')
    {
        parent::__construct($id !== '' ? "Team [{$id}] not found." : 'Team not found.');
    }
}
