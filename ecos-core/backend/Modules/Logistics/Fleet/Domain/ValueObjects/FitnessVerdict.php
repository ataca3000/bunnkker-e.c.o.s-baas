<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Domain\ValueObjects;

use Modules\Logistics\Fleet\Domain\Enums\FitnessLevel;

/**
 * Whether a vehicle may be dispatched, and — always — why not.
 *
 * Follows the shape LOG-005 proved with Delivery::retryBlockers(): a verdict
 * plus ordered, human-readable reasons. A screen that says "unfit" without
 * saying why is not acceptable, so the reasons travel with the verdict rather
 * than requiring a second call.
 */
final class FitnessVerdict
{
    /**
     * @param  list<string>  $blockers  Hard reasons; any one makes the vehicle unfit
     * @param  list<string>  $warnings  Advisory reasons; do not block
     */
    private function __construct(
        public readonly FitnessLevel $level,
        public readonly array $blockers,
        public readonly array $warnings,
    ) {}

    /**
     * @param  list<string>  $blockers
     * @param  list<string>  $warnings
     */
    public static function from(array $blockers, array $warnings = []): self
    {
        $level = match (true) {
            $blockers !== [] => FitnessLevel::Unfit,
            $warnings !== [] => FitnessLevel::FitWithWarnings,
            default => FitnessLevel::Fit,
        };

        return new self($level, array_values($blockers), array_values($warnings));
    }

    public static function fit(): self
    {
        return new self(FitnessLevel::Fit, [], []);
    }

    /** Used when Fleet has no opinion — e.g. the vehicle has no FleetUnit yet. */
    public static function noOpinion(): self
    {
        return self::fit();
    }

    public function isAssignable(): bool
    {
        return $this->level->isAssignable();
    }

    public function isUnfit(): bool
    {
        return $this->level === FitnessLevel::Unfit;
    }

    /** @return array<string, mixed> */
    public function toArray(): array
    {
        return [
            'level' => $this->level->value,
            'level_label' => $this->level->label(),
            'tone' => $this->level->tone(),
            'is_assignable' => $this->isAssignable(),
            'blockers' => $this->blockers,
            'warnings' => $this->warnings,
        ];
    }
}
