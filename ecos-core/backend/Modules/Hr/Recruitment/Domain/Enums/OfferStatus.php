<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Domain\Enums;

/**
 * Where an offer stands.
 *
 * Only `Accepted` opens the door to hiring. Everything else — including a draft
 * that looks finished — is the company still thinking, and hiring someone the
 * company has not actually committed to is how a start date gets promised twice.
 */
enum OfferStatus: string
{
    case Draft = 'draft';
    case Sent = 'sent';
    case Accepted = 'accepted';
    case Declined = 'declined';
    case Expired = 'expired';
    case Withdrawn = 'withdrawn';

    /** A draft can still be revised freely; once sent, revising is a new version. */
    public function isEditable(): bool
    {
        return $this === self::Draft;
    }

    /** The candidate can still respond. */
    public function isOpen(): bool
    {
        return in_array($this, [self::Draft, self::Sent], true);
    }

    public function isFinal(): bool
    {
        return ! $this->isOpen();
    }

    /** The one state that permits hiring. */
    public function permitsHiring(): bool
    {
        return $this === self::Accepted;
    }

    /** @return array<int, self> */
    public function allowedTransitions(): array
    {
        return match ($this) {
            self::Draft => [self::Sent, self::Withdrawn],
            // Expiry is reached by the calendar, not by a person, but it is still
            // a transition and still recorded.
            self::Sent => [self::Accepted, self::Declined, self::Expired, self::Withdrawn],
            // A declined or expired offer is finished. Going back means a new offer,
            // so that the first one's terms and dates survive intact.
            self::Accepted, self::Declined, self::Expired, self::Withdrawn => [],
        };
    }

    public function canTransitionTo(self $target): bool
    {
        return in_array($target, $this->allowedTransitions(), true);
    }

    public function label(): string
    {
        return match ($this) {
            self::Draft => 'Draft',
            self::Sent => 'Sent',
            self::Accepted => 'Accepted',
            self::Declined => 'Declined',
            self::Expired => 'Expired',
            self::Withdrawn => 'Withdrawn',
        };
    }
}
