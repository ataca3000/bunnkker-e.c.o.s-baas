<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Finance\Integration\Domain\Models\AccountRole;
use Modules\Finance\Integration\Domain\Services\PostingRuleRegistry;
use Modules\Finance\Presentation\Http\Controllers\Concerns\ResolvesFinanceContext;

/**
 * Account-role mapping — a company binds each posting role ("inventory", "cogs",
 * "vat_output") to one of its GL accounts. This is what lets shared, hardcoded-
 * free posting rules resolve to this company's chart of accounts.
 */
class AccountRoleController extends Controller
{
    use ResolvesFinanceContext;

    public function __construct(private readonly PostingRuleRegistry $registry) {}

    public function index(Request $request): JsonResponse
    {
        $companyId = $this->companyId($request);

        $mapped = AccountRole::query()
            ->where('company_id', $companyId)
            ->with('account')
            ->get()
            ->map(fn (AccountRole $r) => [
                'role' => $r->role,
                'account_id' => $r->account?->uuid,
                'account_code' => $r->account?->code,
                'account_name' => $r->account?->name,
                'description' => $r->description,
            ]);

        // Every role referenced by an active rule — so the UI shows what is still
        // unmapped and would dead-letter.
        $required = $this->rolesReferencedByRules($companyId);
        $mappedRoles = $mapped->pluck('role')->all();
        $missing = array_values(array_diff($required, $mappedRoles));

        return response()->json([
            'data' => $mapped,
            'required_roles' => $required,
            'unmapped_roles' => $missing,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'role' => ['required', 'string', 'max:60'],
            'account_id' => ['required', 'string'], // account uuid
            'description' => ['nullable', 'string', 'max:300'],
        ]);

        $accountId = $this->accountId($request, $validated['account_id']);

        $mapping = AccountRole::query()->updateOrCreate(
            ['company_id' => $this->companyId($request), 'role' => $validated['role']],
            ['account_id' => $accountId, 'description' => $validated['description'] ?? null],
        );

        return response()->json(['data' => [
            'role' => $mapping->role,
            'account_id' => $mapping->account?->uuid,
        ]], 201);
    }

    public function destroy(Request $request, string $role): JsonResponse
    {
        AccountRole::query()
            ->where('company_id', $this->companyId($request))
            ->where('role', $role)
            ->delete();

        return response()->json(['message' => "Role '{$role}' mapping removed."]);
    }

    /** @return list<string> */
    private function rolesReferencedByRules(string $companyId): array
    {
        $roles = [];
        foreach ($this->registry->all($companyId) as $rule) {
            foreach ($rule->legs ?? [] as $leg) {
                $roles[(string) ($leg['role'] ?? '')] = true;
            }
        }

        unset($roles['']);

        return array_keys($roles);
    }
}
