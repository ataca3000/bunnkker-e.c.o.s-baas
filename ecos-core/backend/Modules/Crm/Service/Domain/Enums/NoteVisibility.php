<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Domain\Enums;

/** Whether a ticket note is internal (agents only) or public (visible to the customer). */
enum NoteVisibility: string
{
    case Internal = 'internal';
    case Public = 'public';
}
