<?php

declare(strict_types=1);

namespace Modules\Crm\Loyalty\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Loyalty\Domain\Models\LoyaltyAccount;
use Modules\Crm\Loyalty\Domain\Services\PointsService;
use Modules\Crm\Loyalty\Domain\Services\WalletService;

/** Earning, redeeming and adjusting points on a loyalty account. */
class PointsController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(
        private readonly PointsService $points,
        private readonly WalletService $wallet,
    ) {}

    public function earn(Request $request, string $accountId): JsonResponse
    {
        $v = $request->validate([
            'amount' => ['nullable', 'numeric'],       // earn from a spend
            'points' => ['nullable', 'integer', 'min:1'], // or earn raw points (promotion)
            'source_type' => ['nullable', 'string', 'max:40'],
            'source_reference' => ['nullable', 'string', 'max:64'],
        ]);

        $account = $this->account($request, $accountId);

        if (isset($v['amount'])) {
            $this->points->earnForSpend($account, (float) $v['amount'], $v['source_type'] ?? 'order', $v['source_reference'] ?? null, $this->actorId($request));
        } else {
            $this->points->earn($account, (int) ($v['points'] ?? 0), $v['source_type'] ?? 'manual', $v['source_reference'] ?? null, $this->actorId($request));
        }

        return response()->json(['data' => $this->wallet->wallet($account->refresh())], 201);
    }

    public function redeem(Request $request, string $accountId): JsonResponse
    {
        $v = $request->validate(['points' => ['required', 'integer', 'min:1'], 'source_reference' => ['nullable', 'string', 'max:64']]);
        $account = $this->account($request, $accountId);
        $this->points->redeem($account, (int) $v['points'], 'manual', $v['source_reference'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->wallet->wallet($account->refresh())], 201);
    }

    public function adjust(Request $request, string $accountId): JsonResponse
    {
        $v = $request->validate(['points' => ['required', 'integer'], 'reason' => ['nullable', 'string', 'max:200']]);
        $account = $this->account($request, $accountId);
        $this->points->adjust($account, (int) $v['points'], $v['reason'] ?? null, $this->actorId($request));

        return response()->json(['data' => $this->wallet->wallet($account->refresh())], 201);
    }

    private function account(Request $request, string $id): LoyaltyAccount
    {
        return LoyaltyAccount::query()->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }
}
