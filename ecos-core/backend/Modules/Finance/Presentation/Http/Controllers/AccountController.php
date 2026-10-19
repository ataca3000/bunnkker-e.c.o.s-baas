<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Finance\Ledger\Domain\Enums\AccountCategory;
use Modules\Finance\Ledger\Domain\Enums\AccountType;
use Modules\Finance\Ledger\Domain\Models\Account;
use Modules\Finance\Ledger\Domain\Services\ChartOfAccountsService;

class AccountController extends Controller
{
    public function __construct(private readonly ChartOfAccountsService $accounts) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'account_types' => AccountType::options(),
            'account_categories' => AccountCategory::options(),
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $accounts = Account::query()
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('type'), fn ($q) => $q->where('account_type', $request->string('type')))
            ->when($request->boolean('postable_only'), fn ($q) => $q->where('is_postable', true)->where('is_active', true))
            ->orderBy('code')
            ->get()
            ->map(fn (Account $a) => $this->payload($a));

        return response()->json(['data' => $accounts]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:200'],
            'name_ar' => ['nullable', 'string', 'max:200'],
            'account_type' => ['required', Rule::in(AccountType::values())],
            'account_category' => ['nullable', Rule::in(AccountCategory::values())],
            'parent_id' => ['nullable', 'integer', 'exists:finance_accounts,id'],
            'is_postable' => ['nullable', 'boolean'],
            'is_control' => ['nullable', 'boolean'],
            'control_subledger' => ['nullable', 'string', 'max:30'],
            'currency' => ['nullable', 'string', 'size:3'],
        ]);

        $validated['company_id'] = $this->companyId($request);

        $account = $this->accounts->create($validated, $request->user()?->id);

        return response()->json(['data' => $this->payload($account)], 201);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        return response()->json(['data' => $this->payload($this->account($request, $uuid))]);
    }

    public function setActive(Request $request, string $uuid): JsonResponse
    {
        $validated = $request->validate(['is_active' => ['required', 'boolean']]);
        $account = $this->account($request, $uuid);
        $account->update(['is_active' => $validated['is_active']]);

        return response()->json(['data' => $this->payload($account->refresh())]);
    }

    private function account(Request $request, string $uuid): Account
    {
        return Account::query()
            ->where('company_id', $this->companyId($request))
            ->where('uuid', $uuid)
            ->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function payload(Account $a): array
    {
        return [
            'id' => $a->uuid,
            'code' => $a->code,
            'name' => $a->name,
            'name_ar' => $a->name_ar,
            'account_type' => $a->account_type->value,
            'account_category' => $a->account_category?->value,
            'normal_balance' => $a->normal_balance->value,
            'statement' => $a->account_type->statement(),
            'is_postable' => $a->is_postable,
            'is_control' => $a->is_control,
            'control_subledger' => $a->control_subledger,
            'currency' => $a->currency,
            'is_active' => $a->is_active,
        ];
    }

    private function companyId(Request $request): ?string
    {
        return $request->user()?->company_id === null ? null : (string) $request->user()->company_id;
    }
}
