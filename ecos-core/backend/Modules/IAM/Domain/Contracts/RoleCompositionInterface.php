<?php

declare(strict_types=1);

namespace Modules\IAM\Domain\Contracts;

use Modules\IAM\Domain\Models\RoleTemplate;
use Modules\IAM\Domain\ValueObjects\EffectiveRoleProfile;

/**
 * Composes multiple role templates into one effective profile using the ADR-039
 * conflict-resolution rules (deny-wins, widest-scope, visibility-intersection,
 * priority for singular UI). Pure and side-effect free.
 */
interface RoleCompositionInterface
{
    /**
     * @param  list<RoleTemplate>  $templates  ordered by descending priority (first = primary)
     */
    public function compose(array $templates): EffectiveRoleProfile;

    /**
     * @param  list<EffectiveRoleProfile>  $profiles ordered by descending priority
     */
    public function composeProfiles(array $profiles): EffectiveRoleProfile;
}
