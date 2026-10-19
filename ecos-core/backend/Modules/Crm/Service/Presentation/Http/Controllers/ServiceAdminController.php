<?php

declare(strict_types=1);

namespace Modules\Crm\Service\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Crm\Customers\Presentation\Http\Controllers\Concerns\ResolvesCustomerContext;
use Modules\Crm\Service\Domain\Models\AssignmentRule;
use Modules\Crm\Service\Domain\Models\EscalationRule;
use Modules\Crm\Service\Domain\Models\SlaPolicy;
use Modules\Crm\Service\Domain\Services\EscalationEngine;

/** Administers SLA policies, assignment rules, escalation rules — and runs the escalation sweep. */
class ServiceAdminController extends Controller
{
    use ResolvesCustomerContext;

    public function __construct(private readonly EscalationEngine $escalation) {}

    // ── SLA policies ─────────────────────────────────────────────────────────────

    public function slaPolicies(Request $request): JsonResponse
    {
        $rows = SlaPolicy::query()->where('company_id', $this->companyId($request))->orderBy('name')->get()
            ->map(fn (SlaPolicy $p) => ['id' => $p->id, 'name' => $p->name, 'priority' => $p->priority, 'first_response_minutes' => $p->first_response_minutes, 'resolution_minutes' => $p->resolution_minutes, 'is_default' => (bool) $p->is_default]);

        return response()->json(['data' => $rows]);
    }

    public function storeSlaPolicy(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'priority' => ['nullable', Rule::in(['low', 'normal', 'high', 'urgent'])],
            'first_response_minutes' => ['required', 'integer', 'min:1'],
            'resolution_minutes' => ['required', 'integer', 'min:1'],
            'is_default' => ['nullable', 'boolean'],
        ]);

        $policy = SlaPolicy::create(array_merge($v, ['company_id' => $this->companyId($request)]));

        return response()->json(['data' => ['id' => $policy->id, 'name' => $policy->name]], 201);
    }

    // ── Assignment rules ─────────────────────────────────────────────────────────

    public function assignmentRules(Request $request): JsonResponse
    {
        $rows = AssignmentRule::query()->where('company_id', $this->companyId($request))->orderBy('order')->get()
            ->map(fn (AssignmentRule $r) => ['id' => $r->id, 'name' => $r->name, 'order' => $r->order, 'strategy' => $r->strategy, 'assignee_id' => $r->assignee_id, 'team_id' => $r->team_id]);

        return response()->json(['data' => $rows]);
    }

    public function storeAssignmentRule(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'order' => ['nullable', 'integer'],
            'match_type' => ['nullable', 'string', 'max:20'],
            'match_category' => ['nullable', 'string', 'max:60'],
            'match_channel' => ['nullable', 'string', 'max:20'],
            'match_priority' => ['nullable', 'string', 'max:10'],
            'strategy' => ['nullable', Rule::in(['direct', 'round_robin'])],
            'assignee_id' => ['nullable', 'integer'],
            'team_id' => ['nullable', 'string'],
            'team_member_ids' => ['nullable', 'array'],
        ]);

        $rule = AssignmentRule::create(array_merge($v, ['company_id' => $this->companyId($request), 'order' => $v['order'] ?? 100, 'strategy' => $v['strategy'] ?? 'direct']));

        return response()->json(['data' => ['id' => $rule->id, 'name' => $rule->name]], 201);
    }

    // ── Escalation rules & run ───────────────────────────────────────────────────

    public function escalationRules(Request $request): JsonResponse
    {
        $rows = EscalationRule::query()->where('company_id', $this->companyId($request))->get()
            ->map(fn (EscalationRule $r) => ['id' => $r->id, 'name' => $r->name, 'trigger' => $r->trigger, 'match_priority' => $r->match_priority, 'idle_minutes' => $r->idle_minutes]);

        return response()->json(['data' => $rows]);
    }

    public function storeEscalationRule(Request $request): JsonResponse
    {
        $v = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'trigger' => ['required', Rule::in(['first_response_breach', 'resolution_breach', 'idle'])],
            'match_priority' => ['nullable', 'string', 'max:10'],
            'idle_minutes' => ['nullable', 'integer', 'min:1'],
            'reassign_to_user_id' => ['nullable', 'integer'],
            'reassign_to_team_id' => ['nullable', 'string'],
        ]);

        $rule = EscalationRule::create(array_merge($v, ['company_id' => $this->companyId($request)]));

        return response()->json(['data' => ['id' => $rule->id, 'name' => $rule->name]], 201);
    }

    /** Run the escalation sweep now (also schedulable). */
    public function runEscalation(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->escalation->evaluate($this->companyId($request))]);
    }
}
