<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum RepairResponseType: string
{
    case Patch                = 'patch';
    case Explanation          = 'explanation';
    case ClarificationRequest = 'clarification_request';
    case Error                = 'error';
    case Timeout              = 'timeout';

    public function label(): string
    {
        return match ($this) {
            self::Patch                => 'Patch',
            self::Explanation          => 'Explanation',
            self::ClarificationRequest => 'Clarification Request',
            self::Error                => 'Error',
            self::Timeout              => 'Timeout',
        };
    }

    public function isPatch(): bool
    {
        return $this === self::Patch;
    }

    public function requiresAction(): bool
    {
        return match ($this) {
            self::ClarificationRequest, self::Error => true,
            default                                 => false,
        };
    }
}
