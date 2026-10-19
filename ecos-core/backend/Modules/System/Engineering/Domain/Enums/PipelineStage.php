<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

enum PipelineStage: string
{
    case DevelopmentGuardian  = 'development_guardian';
    case ArchitectureGuardian = 'architecture_guardian';
    case Build                = 'build';
    case Tests                = 'tests';
    case Commit               = 'commit';
    case Push                 = 'push';
    case GitHubActions        = 'github_actions';
    case DeploymentGuardian   = 'deployment_guardian';
    case Certification        = 'certification';
    case HealthCheck          = 'health_check';
    case Notifications        = 'notifications';

    public function label(): string
    {
        return match($this) {
            self::DevelopmentGuardian  => 'Development Guardian',
            self::ArchitectureGuardian => 'Architecture Guardian',
            self::Build                => 'Build',
            self::Tests                => 'Tests',
            self::Commit               => 'Auto Commit',
            self::Push                 => 'Auto Push',
            self::GitHubActions        => 'GitHub Actions',
            self::DeploymentGuardian   => 'Deployment Guardian',
            self::Certification        => 'Certification',
            self::HealthCheck          => 'Health Check',
            self::Notifications        => 'Notifications',
        };
    }

    public function canAutoRetry(): bool
    {
        return in_array($this, [
            self::Build,
            self::Tests,
            self::GitHubActions,
            self::HealthCheck,
        ], true);
    }

    public function maxRetries(): int
    {
        return match($this) {
            self::Build         => 2,
            self::Tests         => 1,
            self::GitHubActions => 3,
            self::HealthCheck   => 3,
            default             => 0,
        };
    }

    /** @return list<self> */
    public static function orderedStages(): array
    {
        return [
            self::DevelopmentGuardian,
            self::ArchitectureGuardian,
            self::Build,
            self::Tests,
            self::Commit,
            self::Push,
            self::GitHubActions,
            self::DeploymentGuardian,
            self::Certification,
            self::HealthCheck,
            self::Notifications,
        ];
    }

    public function next(): ?self
    {
        $stages = self::orderedStages();
        $idx    = array_search($this, $stages, true);

        return ($idx !== false && isset($stages[$idx + 1])) ? $stages[$idx + 1] : null;
    }
}
