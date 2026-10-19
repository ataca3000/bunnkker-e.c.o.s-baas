<?php

declare(strict_types=1);

namespace Modules\Operations\Loading\Domain\Enums;

enum SessionType: string
{
    case Standard = 'standard';
    case Rush = 'rush';
    case Rerun = 'rerun';
    case Supplementary = 'supplementary';
}
