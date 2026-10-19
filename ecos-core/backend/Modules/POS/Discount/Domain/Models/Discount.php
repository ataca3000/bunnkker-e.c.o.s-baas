<?php

declare(strict_types=1);

namespace Modules\POS\Discount\Domain\Models;

use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use Modules\POS\Discount\Domain\Enums\DiscountScope;
use Modules\POS\Discount\Domain\Enums\DiscountStatus;
use Modules\POS\Discount\Domain\Events\DiscountApproved;
use Modules\POS\Discount\Domain\Events\DiscountRejected;
use Modules\POS\Discount\Domain\Events\DiscountRequested;
use Modules\POS\Discount\Domain\Exceptions\InvalidDiscountException;
use Modules\POS\Discount\Domain\Policies\ManualDiscountPolicy;
use Modules\POS\Discount\Domain\Policies\SupervisorApprovalPolicy;
use Modules\POS\Discount\Domain\ValueObjects\DiscountValue;
use Modules\POS\Shared\Domain\ValueObjects\Money;

final class Discount extends Model
{
    use HasUuids;

    protected $table = 'pos_discounts';

    protected $guarded = [];

    protected $casts = [
        'discount_value' => 'array',
        'requires_approval' => 'boolean',
        'auto_approved' => 'boolean',
    ];

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * Request a new discount. The ManualDiscountPolicy:
     *   1. Validates the value does not exceed the supervisor absolute limit.
     *   2. Determines whether supervisor approval is needed.
     *
     * Discounts within the cashier limit are immediately Approved (auto-approved).
     * Discounts between the cashier limit and supervisor limit remain Pending.
     */
    public static function request(
        string $cashierId,
        DiscountScope $scope,
        DiscountValue $value,
        ManualDiscountPolicy $policy,
        ?string $notes = null,
    ): self {
        if (trim($cashierId) === '') {
            throw InvalidDiscountException::emptyCashierId();
        }

        $policy->validate($value);  // throws if exceeds absolute supervisor limit

        $requiresApproval = $policy->requiresApproval($value);

        $discount = new self;
        $discount->cashier_id = $cashierId;
        $discount->scope = $scope->value;
        $discount->discount_type = $value->type->value;
        $discount->discount_value = $value->toArray();
        $discount->notes = $notes;
        $discount->requires_approval = $requiresApproval;
        $discount->auto_approved = ! $requiresApproval;
        $discount->status = $requiresApproval
            ? DiscountStatus::Pending->value
            : DiscountStatus::Approved->value;
        $discount->supervisor_id = null;
        $discount->approved_at = $requiresApproval ? null : now();
        $discount->rejected_at = null;
        $discount->rejection_reason = null;

        $discount->dispatchDomainEvent(DiscountRequested::now(
            discountId: $discount->id ?? '',
            cashierId: $cashierId,
            scope: $scope->value,
            discountType: $value->type->value,
            rawValue: $value->rawValue,
            currency: $value->currency,
            requiresApproval: $requiresApproval,
        ));

        if (! $requiresApproval) {
            $discount->dispatchDomainEvent(DiscountApproved::now(
                discountId: $discount->id ?? '',
                cashierId: $cashierId,
                supervisorId: null,
                autoApproved: true,
            ));
        }

        return $discount;
    }

    // ── Behavior ──────────────────────────────────────────────────────────────

    public function approve(string $supervisorId, SupervisorApprovalPolicy $policy): void
    {
        $this->guardPending();
        $policy->validateApprover($supervisorId);

        $this->supervisor_id = $supervisorId;
        $this->status = DiscountStatus::Approved->value;
        $this->auto_approved = false;
        $this->approved_at = now();

        $this->dispatchDomainEvent(DiscountApproved::now(
            discountId: (string) $this->id,
            cashierId: (string) $this->cashier_id,
            supervisorId: $supervisorId,
            autoApproved: false,
        ));
    }

    public function reject(string $supervisorId, string $reason, SupervisorApprovalPolicy $policy): void
    {
        $this->guardPending();
        $policy->validateApprover($supervisorId);

        if (trim($reason) === '') {
            throw InvalidDiscountException::rejectionReasonRequired();
        }

        $this->supervisor_id = $supervisorId;
        $this->status = DiscountStatus::Rejected->value;
        $this->rejected_at = now();
        $this->rejection_reason = $reason;

        $this->dispatchDomainEvent(DiscountRejected::now(
            discountId: (string) $this->id,
            cashierId: (string) $this->cashier_id,
            supervisorId: $supervisorId,
            reason: $reason,
        ));
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /**
     * Compute the monetary reduction this discount applies to a given base amount.
     * Only callable on approved discounts.
     */
    public function computeAmount(Money $baseAmount): Money
    {
        if (! $this->isApproved()) {
            throw InvalidDiscountException::notApproved((string) $this->id);
        }

        return $this->getDiscountValue()->apply($baseAmount);
    }

    public function getDiscountValue(): DiscountValue
    {
        return DiscountValue::fromArray($this->discount_value);
    }

    public function getScope(): DiscountScope
    {
        return DiscountScope::from($this->scope);
    }

    public function getStatus(): DiscountStatus
    {
        return DiscountStatus::from($this->status);
    }

    public function isPending(): bool
    {
        return $this->getStatus() === DiscountStatus::Pending;
    }

    public function isApproved(): bool
    {
        return $this->getStatus() === DiscountStatus::Approved;
    }

    public function isRejected(): bool
    {
        return $this->getStatus() === DiscountStatus::Rejected;
    }

    public function isEffective(): bool
    {
        return $this->isApproved();
    }

    public function wasAutoApproved(): bool
    {
        return (bool) $this->auto_approved;
    }

    // ── Guards ────────────────────────────────────────────────────────────────

    private function guardPending(): void
    {
        if (! $this->isPending()) {
            throw InvalidDiscountException::notPending((string) $this->id, $this->getStatus());
        }
    }

    // ── Domain Events ─────────────────────────────────────────────────────────

    /** @var array<object> */
    private array $domainEvents = [];

    private function dispatchDomainEvent(object $event): void
    {
        $this->domainEvents[] = $event;
    }

    public function pullDomainEvents(): array
    {
        $events = $this->domainEvents;
        $this->domainEvents = [];

        return $events;
    }
}
