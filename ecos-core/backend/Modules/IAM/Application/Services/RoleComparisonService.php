<?php

declare(strict_types=1);

namespace Modules\IAM\Application\Services;

use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\ValueObjects\RoleTemplateDiff;

/**
 * Compares two role templates across every dimension (ADR-039). Uses the composed
 * (permission-expanded) profiles so wildcard-vs-explicit definitions diff fairly.
 */
class RoleComparisonService
{
    public function __construct(private readonly RoleCompositionService $composition) {}

    public function compare(RoleTemplate $left, RoleTemplate $right): RoleTemplateDiff
    {
        $a = $this->composition->composeProfiles([$left->profile()]);
        $b = $this->composition->composeProfiles([$right->profile()]);

        return RoleTemplateDiff::between($left->key, $right->key, $a, $b);
    }
}
