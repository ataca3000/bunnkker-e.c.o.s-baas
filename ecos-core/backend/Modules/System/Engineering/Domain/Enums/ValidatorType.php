<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Domain\Enums;

/**
 * Validator identity for the Self-Healing Pipeline validation chain (TASK-ENG-V2-002).
 *
 * Validators run in sequence() order: static policy gates first
 * (SafetyRules, Security, AdrCompliance), then the 10-stage toolchain
 * sequence: PHP Syntax -> Composer -> Laravel Validation -> Pint ->
 * PHPStan -> ESLint -> TypeScript -> Frontend Build -> Backend Tests ->
 * Frontend Tests.
 */
enum ValidatorType: string
{
    case SafetyRules = 'safety_rules';
    case Security = 'security';
    case AdrCompliance = 'adr_compliance';
    case PhpSyntax = 'php_syntax';
    case Composer = 'composer';
    case LaravelValidation = 'laravel_validation';
    case Pint = 'pint';
    case Phpstan = 'phpstan';
    case Eslint = 'eslint';
    case Typescript = 'typescript';
    case Build = 'build';
    case Tests = 'tests';
    case FrontendTests = 'frontend_tests';

    public function label(): string
    {
        return match ($this) {
            self::SafetyRules       => 'Safety Rules',
            self::Security          => 'Security',
            self::AdrCompliance     => 'ADR Compliance',
            self::PhpSyntax         => 'PHP Syntax',
            self::Composer          => 'Composer',
            self::LaravelValidation => 'Laravel Validation',
            self::Pint              => 'Pint',
            self::Phpstan           => 'PHPStan',
            self::Eslint            => 'ESLint',
            self::Typescript        => 'TypeScript',
            self::Build             => 'Frontend Build',
            self::Tests             => 'Backend Tests',
            self::FrontendTests     => 'Frontend Tests',
        };
    }

    public function sequence(): int
    {
        return match ($this) {
            self::SafetyRules       => 1,
            self::Security          => 2,
            self::AdrCompliance     => 3,
            self::PhpSyntax         => 4,
            self::Composer          => 5,
            self::LaravelValidation => 6,
            self::Pint              => 7,
            self::Phpstan           => 8,
            self::Eslint            => 9,
            self::Typescript        => 10,
            self::Build             => 11,
            self::Tests             => 12,
            self::FrontendTests     => 13,
        };
    }

    public function isToolchain(): bool
    {
        return match ($this) {
            self::SafetyRules, self::Security, self::AdrCompliance => false,
            default => true,
        };
    }

    public function isStatic(): bool
    {
        return ! $this->isToolchain();
    }

    /**
     * Whether this validator applies to the given patch file set.
     *
     * @param  array<int, string>  $files
     */
    public function appliesTo(array $files): bool
    {
        $any = static fn (callable $predicate): bool => array_filter($files, $predicate) !== [];

        return match ($this) {
            self::SafetyRules, self::Security, self::AdrCompliance, self::Tests => true,
            self::PhpSyntax, self::Pint, self::Phpstan, self::LaravelValidation => $any(
                static fn (string $file): bool => str_ends_with($file, '.php')
            ),
            self::Composer => $any(
                static fn (string $file): bool => in_array(basename($file), ['composer.json', 'composer.lock'], true)
            ),
            self::Eslint, self::Typescript, self::Build, self::FrontendTests => $any(
                static fn (string $file): bool => str_ends_with($file, '.ts') || str_ends_with($file, '.tsx')
            ),
        };
    }

    public function defaultTimeoutSeconds(): int
    {
        return match ($this) {
            self::Tests, self::FrontendTests => 600,
            self::Build                      => 300,
            self::Phpstan                    => 180,
            default                          => 60,
        };
    }

    /**
     * All cases sorted by sequence().
     *
     * @return array<int, self>
     */
    public static function ordered(): array
    {
        $cases = self::cases();

        usort($cases, static fn (self $a, self $b): int => $a->sequence() <=> $b->sequence());

        return $cases;
    }
}
