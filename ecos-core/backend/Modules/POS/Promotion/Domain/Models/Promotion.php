<?php

declare(strict_types=1);

namespace Modules\POS\Promotion\Domain\Models;

use DateTimeImmutable;
use Illuminate\Database\Eloquent\Concerns\HasUuids;
use Illuminate\Database\Eloquent\Model;
use InvalidArgumentException;
use Modules\POS\Promotion\Domain\Enums\PromotionStatus;
use Modules\POS\Promotion\Domain\Events\PromotionActivated;
use Modules\POS\Promotion\Domain\Events\PromotionCancelled;
use Modules\POS\Promotion\Domain\Events\PromotionCreated;
use Modules\POS\Promotion\Domain\Events\PromotionExpired;
use Modules\POS\Promotion\Domain\Events\PromotionPaused;
use Modules\POS\Promotion\Domain\Exceptions\InvalidPromotionTransitionException;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionCondition;
use Modules\POS\Promotion\Domain\ValueObjects\PromotionReward;

final class Promotion extends Model
{
    use HasUuids;

    protected $table = 'pos_promotions';

    protected $guarded = [];

    protected $casts = [
        'conditions' => 'array',
        'reward' => 'array',
        'max_uses' => 'integer',
        'use_count' => 'integer',
        'priority' => 'integer',
    ];

    // ── Factory ───────────────────────────────────────────────────────────────

    /**
     * @param  PromotionCondition[]  $conditions  At least one condition is required.
     */
    public static function create(
        string $name,
        array $conditions,
        PromotionReward $reward,
        DateTimeImmutable $validFrom,
        ?DateTimeImmutable $validUntil = null,
        ?int $maxUses = null,
        int $priority = 0,
        ?string $description = null,
    ): self {
        if (trim($name) === '') {
            throw new InvalidArgumentException('Promotion name cannot be empty.');
        }
        if (empty($conditions)) {
            throw new InvalidArgumentException('A promotion must have at least one condition.');
        }
        foreach ($conditions as $condition) {
            if (! $condition instanceof PromotionCondition) {
                throw new InvalidArgumentException('Each condition must be a PromotionCondition instance.');
            }
        }
        if ($validUntil !== null && $validUntil <= $validFrom) {
            throw new InvalidArgumentException('valid_until must be after valid_from.');
        }
        if ($maxUses !== null && $maxUses <= 0) {
            throw new InvalidArgumentException('max_uses must be a positive integer.');
        }
        if ($priority < 0) {
            throw new InvalidArgumentException('priority cannot be negative.');
        }

        $promotion = new self;
        $promotion->name = $name;
        $promotion->description = $description;
        $promotion->status = PromotionStatus::Draft->value;
        $promotion->conditions = array_map(fn (PromotionCondition $c) => $c->toArray(), $conditions);
        $promotion->reward = $reward->toArray();
        $promotion->valid_from = $validFrom->format('Y-m-d H:i:s');
        $promotion->valid_until = $validUntil?->format('Y-m-d H:i:s');
        $promotion->max_uses = $maxUses;
        $promotion->use_count = 0;
        $promotion->priority = $priority;
        $promotion->activated_at = null;
        $promotion->paused_at = null;
        $promotion->expired_at = null;
        $promotion->cancelled_at = null;
        $promotion->cancelled_reason = null;

        $promotion->dispatchDomainEvent(PromotionCreated::now(
            promotionId: $promotion->id ?? '',
            name: $name,
            status: PromotionStatus::Draft->value,
            conditionCount: count($conditions),
            rewardType: $reward->type->value,
            validFrom: $validFrom->format(DATE_ATOM),
            validUntil: $validUntil?->format(DATE_ATOM),
            maxUses: $maxUses,
            priority: $priority,
        ));

        return $promotion;
    }

    // ── Behavior ──────────────────────────────────────────────────────────────

    public function activate(): void
    {
        if (! $this->getStatus()->canActivate()) {
            throw InvalidPromotionTransitionException::cannotActivate(
                (string) $this->id, $this->getStatus(),
            );
        }

        $this->status = PromotionStatus::Active->value;
        $this->activated_at = now();

        $this->dispatchDomainEvent(PromotionActivated::now(
            promotionId: (string) $this->id,
            name: (string) $this->name,
            activatedAt: now()->toIso8601String(),
        ));
    }

    public function pause(): void
    {
        if (! $this->getStatus()->canPause()) {
            throw InvalidPromotionTransitionException::cannotPause(
                (string) $this->id, $this->getStatus(),
            );
        }

        $this->status = PromotionStatus::Paused->value;
        $this->paused_at = now();

        $this->dispatchDomainEvent(PromotionPaused::now(
            promotionId: (string) $this->id,
            name: (string) $this->name,
            pausedAt: now()->toIso8601String(),
        ));
    }

    public function expire(): void
    {
        if (! $this->getStatus()->canExpire()) {
            throw InvalidPromotionTransitionException::cannotExpire(
                (string) $this->id, $this->getStatus(),
            );
        }

        $this->status = PromotionStatus::Expired->value;
        $this->expired_at = now();

        $this->dispatchDomainEvent(PromotionExpired::now(
            promotionId: (string) $this->id,
            name: (string) $this->name,
            totalUses: (int) ($this->use_count ?? 0),
            expiredAt: now()->toIso8601String(),
        ));
    }

    public function cancel(?string $reason = null): void
    {
        if (! $this->getStatus()->canCancel()) {
            throw InvalidPromotionTransitionException::cannotCancel(
                (string) $this->id, $this->getStatus(),
            );
        }

        $this->status = PromotionStatus::Cancelled->value;
        $this->cancelled_at = now();
        $this->cancelled_reason = $reason;

        $this->dispatchDomainEvent(PromotionCancelled::now(
            promotionId: (string) $this->id,
            name: (string) $this->name,
            cancelledAt: now()->toIso8601String(),
            reason: $reason,
        ));
    }

    /**
     * Record that this promotion was used once.
     * The Application Layer is responsible for calling this after applying the reward.
     */
    public function recordUse(): void
    {
        if (! $this->isActive()) {
            throw InvalidPromotionTransitionException::promotionNotActive((string) $this->id);
        }
        $this->use_count = ((int) ($this->use_count ?? 0)) + 1;
    }

    // ── Queries ───────────────────────────────────────────────────────────────

    /** @return PromotionCondition[] */
    public function getConditions(): array
    {
        return array_map(
            fn (array $data) => PromotionCondition::fromArray($data),
            $this->conditions ?? [],
        );
    }

    public function getReward(): PromotionReward
    {
        return PromotionReward::fromArray($this->reward);
    }

    public function getStatus(): PromotionStatus
    {
        return PromotionStatus::from($this->status);
    }

    public function getValidFrom(): DateTimeImmutable
    {
        return new DateTimeImmutable($this->valid_from);
    }

    public function getValidUntil(): ?DateTimeImmutable
    {
        return $this->valid_until ? new DateTimeImmutable($this->valid_until) : null;
    }

    public function hasRemainingUses(): bool
    {
        if ($this->max_uses === null) {
            return true;
        }

        return ((int) ($this->use_count ?? 0)) < $this->max_uses;
    }

    public function getRemainingUses(): ?int
    {
        if ($this->max_uses === null) {
            return null;
        }

        return max(0, $this->max_uses - ((int) ($this->use_count ?? 0)));
    }

    public function isDraft(): bool
    {
        return $this->getStatus() === PromotionStatus::Draft;
    }

    public function isActive(): bool
    {
        return $this->getStatus() === PromotionStatus::Active;
    }

    public function isPaused(): bool
    {
        return $this->getStatus() === PromotionStatus::Paused;
    }

    public function isExpired(): bool
    {
        return $this->getStatus() === PromotionStatus::Expired;
    }

    public function isCancelled(): bool
    {
        return $this->getStatus() === PromotionStatus::Cancelled;
    }

    public function isTerminal(): bool
    {
        return $this->getStatus()->isTerminal();
    }

    public function isExpiredByDate(DateTimeImmutable $now): bool
    {
        $until = $this->getValidUntil();

        return $until !== null && $now > $until;
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
