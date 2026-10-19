<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyProgram;
use Modules\Crm\Loyalty\Domain\Services\LoyaltyProgramService;
use Modules\Crm\Loyalty\Domain\Services\WalletService;

/** Loyalty programs, tiers, enrolment and the customer wallet. */
class LoyaltyController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(
        private readonly LoyaltyProgramService $programs,
        private readonly WalletService $wallet,
    ) {}

    public function programs(Request $request): JsonResponse
    {
        $rows = LoyaltyProgram::query()->where('company_id', $this->companyId($request))->with('tiers')->get()
            ->map(fn (LoyaltyProgram $p) => [
                'id' => $p->id, 'name' => $p->name, 'points_per_currency' => (float) $p->points_per_currency, 'redeem_rate' => (float) $p->redeem_rate,
                'currency' => $p->currency, 'is_active' => (bool) $p->is_active,
                'tiers' => $p->tiers->map(fn ($t) => ['id' => $t->id, 'name' => $t->name, 'min_points' => $t->min_points, 'earn_multiplier' => (float) $t->earn_multiplier])->all(),
            ]);

        return response()->json(['data' => $rows]);
    }

    public function storeProgram(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'points_per_currency' => ['nullable', 'numeric'],
            'redeem_rate' => ['nullable', 'numeric'],
            'currency' => ['nullable', 'string', 'size:3'],
            'tiers' => ['nullable', 'array'],
            'tiers.*.name' => ['required_with:tiers', 'string', 'max:80'],
            'tiers.*.min_points' => ['nullable', 'integer', 'min:0'],
            'tiers.*.earn_multiplier' => ['nullable', 'numeric'],
        ]);

        $program = $this->programs->create($this->companyId($request), $v, $v['tiers'] ?? []);

        return response()->json(['data' => ['id' => $program->id, 'name' => $program->name]], 201);
    }

    public function enroll(Request $request): JsonResponse
    {
        $v = $request->validate(['program_id' => ['required', 'string'], 'customer_id' => ['required', 'string']]);

        $program = LoyaltyProgram::query()->where('company_id', $this->companyId($request))->where('id', $v['program_id'])->firstOrFail();
        $customer = $this->customer($request, $v['customer_id']); // scopes to company

        $account = $this->programs->enroll($this->companyId($request), $program, (string) $customer->id);

        return response()->json(['data' => $this->wallet->wallet($account)], 201);
    }

    public function wallet(Request $request, string $accountId): JsonResponse
    {
        return response()->json(['data' => $this->wallet->wallet($this->account($request, $accountId))]);
    }

    public function history(Request $request, string $accountId): JsonResponse
    {
        return response()->json(['data' => $this->wallet->history($this->account($request, $accountId))]);
    }

    private function account(Request $request, string $id): LoyaltyAccount
    {
        return LoyaltyAccount::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }
}
