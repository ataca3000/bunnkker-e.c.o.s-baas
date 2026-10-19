<?php

declare(strict_types=1);

namespace Modules\Hr\Performance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Hr\Performance\Domain\Models\BonusRecommendation;
use Modules\Hr\Performance\Domain\Models\EmployeeIncident;
use Modules\Hr\Performance\Domain\Services\BonusRecommendationService;
use Modules\Hr\Performance\Domain\Services\IncidentService;
use Modules\Hr\Performance\Domain\Services\ManagerReviewService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Manager reviews, bonus recommendations and employee incidents. */
class PerformanceReviewController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly ManagerReviewService $reviews,
        private readonly BonusRecommendationService $recommendations,
        private readonly IncidentService $incidents,
    ) {}

    private function month(Request $request): string
    {
        return $request->string('period_month', Carbon::now()->format('Y-m'))->toString();
    }

    // ── Manager reviews ───────────────────────────────────────────────────────

    public function reviews(Request $request): JsonResponse
    {
        $rows = $this->reviews->forPeriod($this->companyId($request), $this->month($request))
            ->map(fn ($r) => [
                'id' => (string) $r->id,
                'employee' => $r->employee === null ? null : [
                    'id' => (string) $r->employee->id,
                    'name' => $r->employee->fullName(),
                    'employee_number' => $r->employee->employee_number,
                ],
                'period_month' => $r->period_month,
                'overall_rating' => $r->overall_rating,
                'strengths' => $r->strengths,
                'improvement_notes' => $r->improvement_notes,
                'manager_comments' => $r->manager_comments,
                'status' => $r->status,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function saveReview(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'period_month' => ['required', 'string', 'regex:/^\d{4}-\d{2}$/'],
            'overall_rating' => ['required', 'integer', 'min:1', 'max:5'],
            'strengths' => ['nullable', 'string'],
            'improvement_notes' => ['nullable', 'string'],
            'manager_comments' => ['nullable', 'string'],
            'status' => ['nullable', 'in:draft,submitted'],
        ]);

        $review = $this->reviews->save(
            $this->employee($request, $employeeId),
            $v['period_month'],
            $v,
            $this->actingEmployee($request),
            $this->actorId($request),
        );

        if (($v['status'] ?? 'draft') === 'submitted') {
            $review = $this->reviews->submit($review);
        }

        return response()->json(['data' => $review], 201);
    }

    // ── Bonus recommendations ─────────────────────────────────────────────────

    public function recommendations(Request $request): JsonResponse
    {
        $rows = $this->recommendations->pending($this->companyId($request), $this->month($request))
            ->map(fn (BonusRecommendation $r) => $this->recommendationPayload($r));

        return response()->json(['data' => ['bands' => $this->recommendations->bands(), 'items' => $rows]]);
    }

    /** Produce recommendations for everyone with measured goals in a month. */
    public function generateRecommendations(Request $request): JsonResponse
    {
        $month = $this->month($request);
        $result = $this->recommendations->recommendPeriod($this->companyId($request), $month);

        return response()->json(['data' => ['period_month' => $month] + $result]);
    }

    /** Approve, reject, or modify the amount — the manager's call, always. */
    public function decideRecommendation(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'decision' => ['required', 'in:approve,reject,modify'],
            'amount' => ['required_if:decision,modify', 'numeric', 'min:0.01'],
            'note' => ['nullable', 'string', 'max:400'],
        ]);

        $recommendation = BonusRecommendation::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        $decidedBy = $this->actingEmployee($request);
        $note = $v['note'] ?? null;

        $recommendation = match ($v['decision']) {
            'approve' => $this->recommendations->approve($recommendation, $decidedBy, $note),
            'modify' => $this->recommendations->modify($recommendation, (float) $v['amount'], $decidedBy, $note),
            default => $this->recommendations->reject($recommendation, $decidedBy, $note),
        };

        return response()->json(['data' => $this->recommendationPayload($recommendation)]);
    }

    // ── Incidents ─────────────────────────────────────────────────────────────

    public function incidents(Request $request): JsonResponse
    {
        $rows = EmployeeIncident::query()
            ->with('employee:id,first_name,last_name,employee_number')
            ->where('company_id', $this->companyId($request))
            ->when($request->filled('employee_id'), fn ($q) => $q->where('employee_id', $request->string('employee_id')))
            ->when($request->filled('category'), fn ($q) => $q->where('category', $request->string('category')))
            ->orderByDesc('occurred_on')->limit(200)->get()
            ->map(fn (EmployeeIncident $i) => $this->incidentPayload($i));

        return response()->json(['data' => $rows]);
    }

    public function storeIncident(Request $request): JsonResponse
    {
        $v = $request->validate([
            'employee_id' => ['required', 'string'],
            'category' => ['required', 'string', 'max:40'],
            'description' => ['required', 'string'],
            'occurred_on' => ['nullable', 'date'],
            'severity' => ['nullable', 'in:info,minor,major,critical'],
            'related_module' => ['nullable', 'string', 'max:40'],
            'related_reference' => ['nullable', 'string', 'max:64'],
            'related_document_type' => ['nullable', 'string', 'max:60'],
            'amount' => ['nullable', 'numeric', 'min:0'],
        ]);

        $incident = $this->incidents->record($this->employee($request, $v['employee_id']), $v, $this->actorId($request));

        return response()->json(['data' => $this->incidentPayload($incident)], 201);
    }

    /** Raise a deduction from an incident — it still has to be approved. */
    public function raiseDeduction(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:0.01'],
            'reason' => ['nullable', 'string', 'max:400'],
            'payroll_period_id' => ['nullable', 'string'],
        ]);

        $incident = EmployeeIncident::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();

        $incident = $this->incidents->raiseDeduction($incident, $v, $this->actorId($request));

        return response()->json(['data' => $this->incidentPayload($incident)]);
    }

    // ── Payloads ──────────────────────────────────────────────────────────────

    /** @return array<string, mixed> */
    private function recommendationPayload(BonusRecommendation $r): array
    {
        return [
            'id' => (string) $r->id,
            'employee' => $r->employee === null ? null : [
                'id' => (string) $r->employee->id,
                'name' => $r->employee->fullName(),
                'employee_number' => $r->employee->employee_number,
            ],
            'period_month' => $r->period_month,
            'achievement_percent' => (float) $r->achievement_percent,
            'recommended_amount' => round((float) $r->recommended_amount, 2),
            'decided_amount' => $r->decided_amount === null ? null : round((float) $r->decided_amount, 2),
            'effective_amount' => $r->effectiveAmount(),
            'was_overridden' => $r->wasOverridden(),
            'currency' => $r->currency,
            'rule_key' => $r->rule_key,
            'rationale' => $r->rationale,
            'explanation' => $r->explanation,
            'status' => $r->status->value,
            'bonus_id' => $r->bonus_id,
            'decided_at' => $r->decided_at?->toDateTimeString(),
        ];
    }

    /** @return array<string, mixed> */
    private function incidentPayload(EmployeeIncident $i): array
    {
        return [
            'id' => (string) $i->id,
            'employee' => $i->employee === null ? null : [
                'id' => (string) $i->employee->id,
                'name' => $i->employee->fullName(),
                'employee_number' => $i->employee->employee_number,
            ],
            'occurred_on' => $i->occurred_on?->toDateString(),
            'category' => $i->category->value,
            'category_label' => $i->category->label(),
            'is_positive' => $i->category->isPositive(),
            'severity' => $i->severity,
            'description' => $i->description,
            'related_module' => $i->related_module,
            'related_reference' => $i->related_reference,
            'related_document_type' => $i->related_document_type,
            'amount' => $i->amount === null ? null : round((float) $i->amount, 2),
            'deduction_id' => $i->deduction_id,
            'bonus_id' => $i->bonus_id,
            'may_justify_deduction' => $i->category->mayJustifyDeduction(),
        ];
    }
}
