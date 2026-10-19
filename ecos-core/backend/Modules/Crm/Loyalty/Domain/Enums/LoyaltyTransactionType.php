<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Enums;

/**
 * A movement on the loyalty points ledger. Points are stored SIGNED (earn +,
 * redeem/expire −), and the balance is their SUM — never a mutable stored total.
 */
enum LoyaltyTransactionType: string
{
    case Earn = 'earn';
    case Redeem = 'redeem';
    case Reward = 'reward';   // points spent on a catalogue reward
    case Expire = 'expire';
    case Adjust = 'adjust';   // a manual correction (either direction)

    /** Whether this type adds points (+) or removes them (−); adjust is signed by the caller. */
    public function defaultSign(): int
    {
        return match ($this) {
            self::Earn => 1,
            self::Redeem, self::Reward, self::Expire => -1,
            self::Adjust => 1,
        };
    }

    /** @return list<string> */
    public static function values(): array
    {
        return array_map(static fn (self $c) => $c->value, self::cases());
    }
}
