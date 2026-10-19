<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Policies;

use App\Models\User;
use Modules\IAM\Presentation\Policies\BasePolicy;
use Modules\Logistics\Fleet\Domain\Models\FleetUnit;

/**
 * Record-level authorization for Fleet.
 *
 * The ten fleet.* permissions are the coarse gate and are applied as route
 * middleware. This policy adds the part middleware cannot express: the record
 * must belong to the actor's company.
 *
 * Super Admin and other system roles bypass every check via Gate::before() in
 * IamServiceProvider — do not re-check roles here.
 */
class FleetPolicy extends BasePolicy
{
    public function viewAny(User $user): bool
    {
        return $this->can($user, 'fleet.view');
    }

    public function view(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.view') && $this->sameCompany($user, $unit);
    }

    public function manage(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.manage') && $this->sameCompany($user, $unit);
    }

    public function scheduleMaintenance(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.maintenance.schedule') && $this->sameCompany($user, $unit);
    }

    /**
     * Separate from scheduling on purpose: marking work done that was never
     * scheduled or performed is the failure this split prevents.
     */
    public function completeMaintenance(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.maintenance.complete') && $this->sameCompany($user, $unit);
    }

    public function performInspection(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.inspection.perform') && $this->sameCompany($user, $unit);
    }

    /** A driver must not sign off their own failed inspection. */
    public function approveInspection(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.inspection.approve') && $this->sameCompany($user, $unit);
    }

    public function recordFuel(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.fuel.record') && $this->sameCompany($user, $unit);
    }

    /** The person entering a purchase must not clear their own anomaly. */
    public function reconcileFuel(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.fuel.reconcile') && $this->sameCompany($user, $unit);
    }

    public function viewCost(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.cost.view') && $this->sameCompany($user, $unit);
    }

    /** Clearing a safety blocker without repairing anything. Always audited. */
    public function overrideHealth(User $user, FleetUnit $unit): bool
    {
        return $this->can($user, 'fleet.health.override') && $this->sameCompany($user, $unit);
    }

    /**
     * A unit with no company is unscoped reference data and stays visible; a
     * user with no company can only be a system role, which never reaches this
     * method because Gate::before() has already returned true.
     */
    private function sameCompany(User $user, FleetUnit $unit): bool
    {
        return $unit->company_id === null
            || $user->company_id === null
            || (string) $unit->company_id === (string) $user->company_id;
    }
}
