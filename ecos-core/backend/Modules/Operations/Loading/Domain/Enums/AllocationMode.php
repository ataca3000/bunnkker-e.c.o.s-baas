<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum AllocationMode: string
{
    case FullAuto = 'full_auto';
    case PartialAuto = 'partial_auto';
    case Manual = 'manual';
    case AiSuggested = 'ai_suggested';
    case Priority = 'priority';
    case Fifo = 'fifo';
    case CustomPolicy = 'custom_policy';
}
