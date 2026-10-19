<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Services;

use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;

/**
 * The wallet — a customer's loyalty account read model. Every figure is derived
 * from the append-only ledger; nothing is stored.
 */
final class WalletService
{
    /** @return array<string, mixed> */
    public function wallet(LoyaltyAccount $account): array
    {
        $account->loadMissing('program', 'tier');

        $earned = (int) $account->transactions()->where('points', '>', 0)->sum('points');
        $spent = (int) abs((int) $account->transactions()->where('points', '<', 0)->sum('points'));
        $balance = $earned - $spent;

        $redeemRate = (float) ($account->program->redeem_rate ?? 0);

        return [
            'account_id' => $account->id,
            'customer_id' => $account->customer_id,
            'program' => $account->program?->name,
            'status' => $account->status,
            'points_balance' => $balance,
            'lifetime_earned' => $earned,
            'lifetime_redeemed' => $spent,
            'redeem_value' => round($balance * $redeemRate, 2),
            'currency' => $account->program?->currency,
            'tier' => $account->tier !== null ? ['id' => $account->tier->id, 'name' => $account->tier->name, 'earn_multiplier' => (float) $account->tier->earn_multiplier] : null,
        ];
    }

    /** @return list<array<string, mixed>> */
    public function history(LoyaltyAccount $account, int $limit = 100): array
    {
        return $account->transactions()
            ->orderByDesc('occurred_at')->limit($limit)->get()
            ->map(fn ($t) => [
                'id' => $t->id,
                'type' => $t->type->value,
                'points' => $t->points,
                'source_type' => $t->source_type,
                'source_reference' => $t->source_reference,
                'description' => $t->description,
                'occurred_at' => $t->occurred_at?->toIso8601String(),
            ])->all();
    }
}
