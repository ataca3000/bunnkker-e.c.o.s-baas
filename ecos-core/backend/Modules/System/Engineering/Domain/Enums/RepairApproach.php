<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum RepairApproach: string
{
    case DirectFix            = 'direct_fix';
    case Refactor             = 'refactor';
    case ArchitecturalChange  = 'architectural_change';
    case DocumentationOnly    = 'documentation_only';
    case ConfigurationChange  = 'configuration_change';
    case MultiStep            = 'multi_step';

    public function label(): string
    {
        return match ($this) {
            self::DirectFix           => 'Direct Fix',
            self::Refactor            => 'Refactor',
            self::ArchitecturalChange => 'Architectural Change',
            self::DocumentationOnly   => 'Documentation Only',
            self::ConfigurationChange => 'Configuration Change',
            self::MultiStep           => 'Multi-Step',
        };
    }

    public function estimatedComplexity(): string
    {
        return match ($this) {
            self::DirectFix, self::DocumentationOnly, self::ConfigurationChange => 'low',
            self::Refactor                                                       => 'medium',
            self::ArchitecturalChange                                            => 'high',
            self::MultiStep                                                      => 'very_high',
        };
    }
}
