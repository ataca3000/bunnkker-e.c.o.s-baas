<?php
declare(strict_types=1);
namespace Modules\System\Engineering\Domain\Enums;

enum ReviewDimension: string
{
    case Architecture    = 'architecture';
    case Backend         = 'backend';
    case Frontend        = 'frontend';
    case Database        = 'database';
    case Security        = 'security';
    case Testing         = 'testing';
    case Documentation   = 'documentation';
    case Performance     = 'performance';
    case Maintainability = 'maintainability';

    public function weight(): float
    {
        return match($this) {
            self::Architecture    => 20.0,
            self::Backend         => 15.0,
            self::Frontend        => 15.0,
            self::Database        => 10.0,
            self::Security        => 10.0,
            self::Testing         => 10.0,
            self::Documentation   => 10.0,
            self::Performance     => 5.0,
            self::Maintainability => 5.0,
        };
    }

    public function label(): string
    {
        return match($this) {
            self::Architecture    => 'Architecture',
            self::Backend         => 'Backend',
            self::Frontend        => 'Frontend',
            self::Database        => 'Database',
            self::Security        => 'Security',
            self::Testing         => 'Testing',
            self::Documentation   => 'Documentation',
            self::Performance     => 'Performance',
            self::Maintainability => 'Maintainability',
        };
    }

    public static function all(): array
    {
        return self::cases();
    }
}
