<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Crm\Loyalty\Domain\Exceptions\LoyaltyException;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyProgram;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyReward;
use Modules\Crm\Loyalty\Domain\Models\RewardRedemption;

/**
 * The reward catalogue and redemption. Redeeming spends points (an append-only
 * ledger movement) and records a redemption with a voucher. The CRM owns the
 * redemption; applying the voucher/discount to an order is done and referenced
 * elsewhere.
 */
final class RewardService
{
    public function __construct(private readonly PointsService $points) {}

    /** @param array<string, mixed> $data */
    public function create(string $companyId, LoyaltyProgram $program, array $data): LoyaltyReward
    {
        return LoyaltyReward::create([
            'company_id' => $companyId,
            'program_id' => $program->id,
            'name' => $data['name'],
            'description' => $data['description'] ?? null,
            'points_cost' => $data['points_cost'],
            'reward_type' => $data['reward_type'] ?? 'voucher',
            'value' => $data['value'] ?? null,
            'stock' => $data['stock'] ?? null,
            'is_active' => true,
        ]);
    }

    public function redeem(LoyaltyAccount $account, LoyaltyReward $reward, ?int $actorId = null): RewardRedemption
    {
        if (! $reward->is_active || ! $reward->inStock()) {
            throw LoyaltyException::rewardUnavailable($reward->name);
        }

        return DB::transaction(function () use ($account, $reward, $actorId): RewardRedemption {
            // Spend the points (guards the balance and is append-only).
            $this->points->spendOnReward($account, (int) $reward->points_cost, (string) $reward->id, $actorId);

            if ($reward->stock !== null) {
                $reward->decrement('stock');
            }

            return RewardRedemption::create([
                'company_id' => $account->company_id,
                'account_id' => $account->id,
                'reward_id' => $reward->id,
                'points_spent' => $reward->points_cost,
                'status' => 'pending',
                'voucher_code' => 'RWD-'.strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 10)),
                'redeemed_at' => Carbon::now(),
                'actor_id' => $actorId,
            ]);
        });
    }

    public function fulfill(RewardRedemption $redemption): RewardRedemption
    {
        $redemption->update(['status' => 'fulfilled', 'fulfilled_at' => Carbon::now()]);

        return $redemption->refresh();
    }
}
