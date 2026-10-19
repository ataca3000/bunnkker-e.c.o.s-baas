<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Domain\Exceptions;

use RuntimeException;

final class BusinessAccountNotFoundException extends RuntimeException
{
    public function __construct(string $id = '')
    {
        parent::__construct($id !== '' ? "Business account [{$id}] not found." : 'Business account not found.');
    }
}
