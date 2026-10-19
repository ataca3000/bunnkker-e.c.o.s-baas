<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyProgram;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyTier;

/** Creates loyalty programs and their tiers, and enrols customers. */
final class LoyaltyProgramService
{
    public function __construct(private readonly PointsService $points) {}

    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{name:string, min_points?:int, earn_multiplier?:float, benefits?:array}>  $tiers
     */
    public function create(string $companyId, array $data, array $tiers = []): LoyaltyProgram
    {
        return DB::transaction(function () use ($companyId, $data, $tiers): LoyaltyProgram {
            $program = LoyaltyProgram::create([
                'company_id' => $companyId,
                'name' => $data['name'],
                'points_per_currency' => $data['points_per_currency'] ?? 1,
                'redeem_rate' => $data['redeem_rate'] ?? 0.01,
                'currency' => $data['currency'] ?? 'EGP',
                'is_active' => true,
            ]);

            $order = 0;
            foreach ($tiers as $tier) {
                LoyaltyTier::create([
                    'program_id' => $program->id,
                    'name' => $tier['name'],
                    'min_points' => $tier['min_points'] ?? 0,
                    'earn_multiplier' => $tier['earn_multiplier'] ?? 1,
                    'benefits' => $tier['benefits'] ?? null,
                    'order' => $order++,
                ]);
            }

            return $program->refresh();
        });
    }

    /** Enrol a customer in a program (idempotent — one account per program/customer). */
    public function enroll(string $companyId, LoyaltyProgram $program, string $customerId): LoyaltyAccount
    {
        $account = LoyaltyAccount::query()->firstOrCreate(
            ['program_id' => $program->id, 'customer_id' => $customerId],
            ['company_id' => $companyId, 'status' => 'active', 'enrolled_at' => Carbon::now()],
        );

        $this->points->recomputeTier($account);

        return $account->refresh();
    }
}
