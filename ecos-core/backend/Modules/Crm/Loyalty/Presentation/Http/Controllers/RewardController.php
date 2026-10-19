<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyProgram;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyReward;
use Modules\Crm\Loyalty\Domain\Services\RewardService;

/** The reward catalogue and redemption. */
class RewardController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly RewardService $rewards) {}

    public function index(Request $request): JsonResponse
    {
        $rows = LoyaltyReward::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('program_id'), fn ($q) => $q->where('program_id', $request->string('program_id')))
            ->where('is_active', true)->get()
            ->map(fn (LoyaltyReward $r) => ['id' => $r->id, 'name' => $r->name, 'points_cost' => $r->points_cost, 'reward_type' => $r->reward_type, 'value' => $r->value !== null ? (float) $r->value : null, 'stock' => $r->stock]);

        return response()->json(['data' => $rows]);
    }

    public function store(Request $request): JsonResponse
    {
        $v = $request->validate([
            'program_id' => ['required', 'string'],
            'name' => ['required', 'string', 'max:150'],
            'description' => ['nullable', 'string', 'max:500'],
            'points_cost' => ['required', 'integer', 'min:1'],
            'reward_type' => ['nullable', Rule::in(['discount', 'product', 'voucher', 'cash'])],
            'value' => ['nullable', 'numeric'],
            'stock' => ['nullable', 'integer', 'min:0'],
        ]);

        $program = LoyaltyProgram::query()->where('company_id', $this->companyId($request))->where('id', $v['program_id'])->firstOrFail();
        $reward = $this->rewards->create($this->companyId($request), $program, $v);

        return response()->json(['data' => ['id' => $reward->id, 'name' => $reward->name]], 201);
    }

    public function redeem(Request $request): JsonResponse
    {
        $v = $request->validate(['account_id' => ['required', 'string'], 'reward_id' => ['required', 'string']]);

        $account = LoyaltyAccount::query()->where('company_id', $this->companyId($request))->where('id', $v['account_id'])->firstOrFail();
        $reward = LoyaltyReward::query()->where('company_id', $this->companyId($request))->where('id', $v['reward_id'])->firstOrFail();

        $redemption = $this->rewards->redeem($account, $reward, $this->actorId($request));

        return response()->json(['data' => [
            'id' => $redemption->id, 'reward_id' => $reward->id, 'points_spent' => $redemption->points_spent,
            'voucher_code' => $redemption->voucher_code, 'status' => $redemption->status,
        ]], 201);
    }
}
