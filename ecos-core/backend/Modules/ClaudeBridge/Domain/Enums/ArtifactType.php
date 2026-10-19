<?php

declare(strict_types=1);

namespace Modules\ClaudeBridge\Domain\Enums;

enum ArtifactType: string
{
    case Diff = 'diff';
    case Report = 'report';
    case Log = 'log';
}
