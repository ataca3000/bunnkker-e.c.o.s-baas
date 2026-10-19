<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Category of a Guardian check (TASK-ENG-V2-003 Autonomous Engineering Guardian).
 *
 * Note: individual check step status reuses ValidationStepStatus.
 */
enum GuardianCheckCategory: string
{
    case Security      = 'security';
    case AdrCompliance = 'adr_compliance';
    case Safety        = 'safety';
    case Toolchain     = 'toolchain';

    public function label(): string
    {
        return match ($this) {
            self::Security      => 'Security',
            self::AdrCompliance => 'ADR Compliance',
            self::Safety        => 'Safety',
            self::Toolchain     => 'Toolchain',
        };
    }

    /**
     * The RepairFailureType string value used when orchestrating repair
     * for a failed check in this category.
     */
    public function defaultFailureType(): string
    {
        return match ($this) {
            self::Security      => RepairFailureType::SecurityIssue->value,
            self::AdrCompliance => RepairFailureType::ArchitectureViolation->value,
            self::Safety        => RepairFailureType::ValidationFailure->value,
            self::Toolchain     => RepairFailureType::BuildFailure->value,
        };
    }

    /**
     * @return array<int, self>
     */
    public static function all(): array
    {
        return self::cases();
    }
}
