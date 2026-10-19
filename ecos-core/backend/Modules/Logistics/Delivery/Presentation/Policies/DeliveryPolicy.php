<?php

declare(strict_types=1);

namespace Modules\Logistics\Delivery\Presentation\Policies;

use App\Models\User;
use Modules\IAM\Presentation\Policies\BasePolicy;
use Modules\Logistics\Delivery\Domain\Models\Delivery;

/**
 * Record-level authorization for the Delivery OS.
 *
 * The ten `delivery.*` permissions seeded by migration 100009 are the coarse
 * gate and are applied as route middleware. This policy adds the part
 * middleware cannot express: the record must belong to the actor's company.
 *
 * Super Admin and any other system role bypass every check via Gate::before()
 * in IamServiceProvider — do not re-check roles here.
 */
class DeliveryPolicy extends BasePolicy
{
    public function viewAny(User $user): bool
    {
        return $this->can($user, 'delivery.view');
    }

    public function view(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.view') && $this->sameCompany($user, $delivery);
    }

    /** Opening and advancing attempts, and closing them succeeded/failed. */
    public function execute(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.execute') && $this->sameCompany($user, $delivery);
    }

    public function capturePod(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.pod.capture') && $this->sameCompany($user, $delivery);
    }

    /**
     * Validating evidence is deliberately a separate permission from capturing
     * it, so the driver who took the photo cannot also sign it off.
     */
    public function validatePod(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.pod.validate') && $this->sameCompany($user, $delivery);
    }

    public function retry(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.retry') && $this->sameCompany($user, $delivery);
    }

    public function cancel(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.cancel') && $this->sameCompany($user, $delivery);
    }

    public function manageReturn(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.return.manage') && $this->sameCompany($user, $delivery);
    }

    public function collectCod(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.cod.collect') && $this->sameCompany($user, $delivery);
    }

    /** Same separation-of-duties rationale as POD capture vs. validate. */
    public function verifyCod(User $user, Delivery $delivery): bool
    {
        return $this->can($user, 'delivery.cod.verify') && $this->sameCompany($user, $delivery);
    }

    public function viewAnalytics(User $user): bool
    {
        return $this->can($user, 'delivery.analytics.view');
    }

    /**
     * A delivery with no company is unscoped reference data and stays visible;
     * a user with no company can only be a system role, which never reaches
     * this method because Gate::before() has already returned true.
     */
    private function sameCompany(User $user, Delivery $delivery): bool
    {
        return $delivery->company_id === null
            || $user->company_id === null
            || (string) $delivery->company_id === (string) $user->company_id;
    }
}
