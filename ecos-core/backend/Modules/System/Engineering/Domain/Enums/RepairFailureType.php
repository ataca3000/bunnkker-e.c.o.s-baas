<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum RepairFailureType: string
{
    case BuildFailure            = 'build_failure';
    case TestFailure             = 'test_failure';
    case ValidationFailure       = 'validation_failure';
    case SecurityIssue           = 'security_issue';
    case ArchitectureViolation   = 'architecture_violation';
    case QualityIssue            = 'quality_issue';
    case DocumentationGap        = 'documentation_gap';
    case PerformanceIssue        = 'performance_issue';
    case PipelineFailure         = 'pipeline_failure';

    public function label(): string
    {
        return match ($this) {
            self::BuildFailure          => 'Build Failure',
            self::TestFailure           => 'Test Failure',
            self::ValidationFailure     => 'Validation Failure',
            self::SecurityIssue         => 'Security Issue',
            self::ArchitectureViolation => 'Architecture Violation',
            self::QualityIssue          => 'Quality Issue',
            self::DocumentationGap      => 'Documentation Gap',
            self::PerformanceIssue      => 'Performance Issue',
            self::PipelineFailure       => 'Pipeline Failure',
        };
    }

    public function defaultApproach(): RepairApproach
    {
        return match ($this) {
            self::BuildFailure, self::TestFailure, self::ValidationFailure, self::SecurityIssue => RepairApproach::DirectFix,
            self::ArchitectureViolation, self::QualityIssue, self::PerformanceIssue             => RepairApproach::Refactor,
            self::DocumentationGap                                                               => RepairApproach::DocumentationOnly,
            self::PipelineFailure                                                                => RepairApproach::ConfigurationChange,
        };
    }

    public function defaultMaxRetries(): int
    {
        return match ($this) {
            self::BuildFailure, self::TestFailure, self::PipelineFailure => 3,
            self::SecurityIssue, self::ArchitectureViolation             => 1,
            default                                                       => 2,
        };
    }
}
