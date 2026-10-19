<?php

declare(strict_types=1);

namespace Modules\System\Engineering\Application\Services;

use Modules\System\Engineering\Domain\Enums\ValidatorType;

/**
 * Registry of patch validators for the Self-Healing Pipeline (TASK-ENG-V2-002).
 *
 * NEVER-BYPASS RULE: validators may never be bypassed after failure. Once a
 * validator has executed and failed, the patch is rejected — there is no
 * override, retry-with-skip, or downgrade path. Inapplicability is determined
 * ONLY by patch file extensions, BEFORE execution (via ValidatorType::appliesTo()).
 * A validator that applies to the patch always runs, and its verdict is final.
 */
final class PatchValidatorRegistry
{
    /**
     * All validators in their canonical execution order.
     *
     * @return array<int, ValidatorType>
     */
    public function orderedValidators(): array
    {
        return ValidatorType::ordered();
    }

    /**
     * Validators applicable to the given patch file set, in execution order.
     *
     * Applicability is decided purely by patch file extensions — before any
     * validator runs. This is the only legitimate way a validator is excluded.
     *
     * @param  array<int, string>  $files
     * @return array<int, ValidatorType>
     */
    public function applicableValidators(array $files): array
    {
        return array_values(array_filter(
            $this->orderedValidators(),
            static fn (ValidatorType $type): bool => $type->appliesTo($files)
        ));
    }

    /**
     * Whether the validator is enabled.
     *
     * Single global switch for now; per-validator toggles can extend later.
     */
    public function isEnabled(ValidatorType $type): bool
    {
        return (bool) config('engineering.self_healing.enabled', true);
    }
}
