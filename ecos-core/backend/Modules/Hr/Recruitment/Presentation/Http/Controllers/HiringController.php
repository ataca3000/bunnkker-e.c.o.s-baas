<?php

declare(strict_types=1);

namespace Modules\Hr\Recruitment\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Modules\Hr\Recruitment\Domain\Enums\LifecycleEventType;
use Modules\Hr\Recruitment\Domain\Models\Interview;
use Modules\Hr\Recruitment\Domain\Models\JobApplication;
use Modules\Hr\Recruitment\Domain\Services\EmployeeLifecycleService;
use Modules\Hr\Recruitment\Domain\Services\HiringService;
use Modules\Hr\Recruitment\Domain\Services\InterviewService;
use Modules\Hr\Workforce\Presentation\Http\Controllers\Concerns\ResolvesHrContext;

/** Interviews, evaluations, the hire itself, and employment lifecycle. */
class HiringController extends Controller
{
    use ResolvesHrContext;

    public function __construct(
        private readonly InterviewService $interviews,
        private readonly HiringService $hiring,
        private readonly EmployeeLifecycleService $lifecycle,
    ) {}

    // ── Interviews ────────────────────────────────────────────────────────────

    public function upcomingInterviews(Request $request): JsonResponse
    {
        $days = min(90, max(1, (int) $request->integer('days', 14)));

        $rows = $this->interviews->upcoming($this->companyId($request), $days)
            ->map(fn (Interview $i) => $this->interviewPayload($i));

        return response()->json(['data' => ['days' => $days, 'items' => $rows]]);
    }

    public function scheduleInterview(Request $request, string $applicationId): JsonResponse
    {
        $v = $request->validate([
            'scheduled_at' => ['required', 'date'],
            'duration_minutes' => ['nullable', 'integer', 'min:5', 'max:600'],
            'mode' => ['nullable', 'in:onsite,phone,video'],
            'location' => ['nullable', 'string', 'max:300'],
            'title' => ['nullable', 'string', 'max:200'],
            'interviewer_employee_id' => ['nullable', 'string'],
            'stage_id' => ['nullable', 'string'],
            'panel' => ['nullable', 'array', 'max:10'],
        ]);

        $interview = $this->interviews->schedule(
            $this->application($request, $applicationId), $v, $this->actorId($request)
        );

        return response()->json(['data' => $this->interviewPayload($interview)], 201);
    }

    public function completeInterview(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'decision' => ['nullable', 'in:proceed,reject,hold,undecided'],
            'notes' => ['nullable', 'string'],
        ]);

        return response()->json(['data' => $this->interviewPayload($this->interviews->complete($this->interview($request, $id), $v))]);
    }

    public function cancelInterview(Request $request, string $id): JsonResponse
    {
        $v = $request->validate([
            'action' => ['nullable', 'in:cancel,no_show'],
            'note' => ['nullable', 'string', 'max:400'],
        ]);

        $interview = $this->interview($request, $id);

        $interview = ($v['action'] ?? 'cancel') === 'no_show'
            ? $this->interviews->markNoShow($interview)
            : $this->interviews->cancel($interview, $v['note'] ?? null);

        return response()->json(['data' => $this->interviewPayload($interview)]);
    }

    // ── Evaluation ────────────────────────────────────────────────────────────

    public function evaluate(Request $request, string $applicationId): JsonResponse
    {
        $v = $request->validate([
            'rating' => ['nullable', 'in:excellent,very_good,good,average,weak'],
            'score' => ['nullable', 'integer', 'min:0', 'max:100'],
            'comments' => ['nullable', 'string'],
            'stage_id' => ['nullable', 'string'],
        ]);

        if (! isset($v['rating']) && ! isset($v['score'])) {
            return response()->json(['message' => 'A rating or a score is required.'], 422);
        }

        $evaluation = $this->interviews->evaluate(
            $this->application($request, $applicationId),
            $v,
            $this->actingEmployee($request),
            $this->actorId($request),
        );

        return response()->json([
            'data' => [
                'id' => (string) $evaluation->id,
                'rating' => $evaluation->rating->value,
                'rating_label' => $evaluation->rating->label(),
                'score' => $evaluation->effectiveScore(),
                'comments' => $evaluation->comments,
                'evaluated_at' => $evaluation->evaluated_at?->toDateTimeString(),
            ],
        ], 201);
    }

    // ── Hiring ────────────────────────────────────────────────────────────────

    /** Everything already known, so the hire form does not ask for it twice. */
    public function prefill(Request $request, string $applicationId): JsonResponse
    {
        $application = $this->application($request, $applicationId);
        $application->load(['applicant', 'jobOpening']);

        return response()->json(['data' => $this->hiring->prefillFor($application)]);
    }

    /** Turn an accepted applicant into an employee. */
    public function hire(Request $request, string $applicationId): JsonResponse
    {
        $v = $request->validate([
            'hire_date' => ['nullable', 'date'],
            'department_id' => ['nullable', 'string'],
            'position_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'employment_type_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'basic_salary' => ['nullable', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'contract_type' => ['nullable', 'in:permanent,fixed_term,probation,contractor'],
            'contract_end_date' => ['nullable', 'date'],
            'probation_end_date' => ['nullable', 'date'],
            'weekly_hours' => ['nullable', 'numeric', 'min:0', 'max:168'],
            'reporting_manager_employee_id' => ['nullable', 'string'],
            'work_email' => ['nullable', 'email', 'max:150'],
            'status' => ['nullable', 'in:probation,active'],
        ]);

        $application = $this->application($request, $applicationId);
        $application->load(['applicant', 'jobOpening']);

        $employee = $this->hiring->hire($application, $v, $this->actorId($request));

        return response()->json([
            'data' => [
                'employee_id' => (string) $employee->id,
                'employee_number' => $employee->employee_number,
                'name' => $employee->fullName(),
                'status' => $employee->status->value,
                'hire_date' => $employee->hire_date?->toDateString(),
                'department_id' => $employee->department_id === null ? null : (string) $employee->department_id,
                'position_id' => $employee->position_id === null ? null : (string) $employee->position_id,
            ],
        ], 201);
    }

    // ── Employee lifecycle ────────────────────────────────────────────────────

    public function history(Request $request, string $employeeId): JsonResponse
    {
        $employee = $this->employee($request, $employeeId);

        $rows = $this->lifecycle->historyFor($employee)->map(fn ($e) => [
            'id' => (string) $e->id,
            'event_type' => $e->event_type->value,
            'label' => $e->event_type->label(),
            'effective_date' => $e->effective_date?->toDateString(),
            'reason' => $e->reason,
            'notes' => $e->notes,
            'from_values' => $e->from_values,
            'to_values' => $e->to_values,
            'source_module' => $e->source_module,
            'source_reference' => $e->source_reference,
        ]);

        return response()->json(['data' => ['employee_id' => (string) $employee->id, 'events' => $rows]]);
    }

    /** Transfer, position change or promotion — the movement and its history entry. */
    public function move(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'department_id' => ['nullable', 'string'],
            'position_id' => ['nullable', 'string'],
            'branch_id' => ['nullable', 'string'],
            'job_grade_id' => ['nullable', 'string'],
            'effective_date' => ['nullable', 'date'],
            'reason' => ['nullable', 'string', 'max:400'],
            'promotion' => ['nullable', 'boolean'],
        ]);

        $employee = $this->employee($request, $employeeId);

        $moved = ($v['promotion'] ?? false)
            ? $this->lifecycle->promote($employee, $v, $v['reason'] ?? null, $this->actorId($request))
            : $this->lifecycle->transfer($employee, $v, $v['reason'] ?? null, $this->actorId($request));

        return response()->json([
            'data' => [
                'employee_id' => (string) $moved->id,
                'department_id' => $moved->department_id === null ? null : (string) $moved->department_id,
                'position_id' => $moved->position_id === null ? null : (string) $moved->position_id,
                'status' => $moved->status->value,
            ],
        ]);
    }

    public function passProbation(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate(['effective_date' => ['nullable', 'date']]);

        $employee = $this->lifecycle->passProbation(
            $this->employee($request, $employeeId), $v['effective_date'] ?? null, $this->actorId($request)
        );

        return response()->json(['data' => ['employee_id' => (string) $employee->id, 'status' => $employee->status->value]]);
    }

    public function separate(Request $request, string $employeeId): JsonResponse
    {
        $v = $request->validate([
            'reason' => ['required', 'string', 'max:400'],
            'resigned' => ['nullable', 'boolean'],
            'effective_date' => ['nullable', 'date'],
        ]);

        $employee = $this->employee($request, $employeeId);

        // Nobody ends their own employment — the same rule H1 applies.
        if (! app(\Modules\Hr\Workforce\Domain\Policies\EmployeePolicy::class)->terminate($request->user(), $employee)) {
            return response()->json(['message' => 'You cannot end your own employment.'], 403);
        }

        $separated = $this->lifecycle->separate(
            $employee,
            $v['reason'],
            (bool) ($v['resigned'] ?? false),
            $v['effective_date'] ?? null,
            $this->actorId($request),
        );

        return response()->json([
            'data' => [
                'employee_id' => (string) $separated->id,
                'status' => $separated->status->value,
                'termination_date' => $separated->termination_date?->toDateString(),
            ],
        ]);
    }

    /** Company-wide movement over a window — what turnover reporting reads. */
    public function movements(Request $request): JsonResponse
    {
        $v = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $to = $v['to'] ?? now()->toDateString();
        $from = $v['from'] ?? now()->subMonthsNoOverflow(11)->startOfMonth()->toDateString();

        return response()->json([
            'data' => $this->lifecycle->movementsBetween($this->companyId($request), $from, $to),
        ]);
    }

    /** @noinspection PhpUnused */
    public function lifecycleTypes(): JsonResponse
    {
        return response()->json([
            'data' => array_map(fn (LifecycleEventType $t) => [
                'value' => $t->value,
                'label' => $t->label(),
                'is_movement' => $t->isMovement(),
                'is_separation' => $t->isSeparation(),
            ], LifecycleEventType::cases()),
        ]);
    }

    // ── Lookups ───────────────────────────────────────────────────────────────

    private function application(Request $request, string $id): JobApplication
    {
        return JobApplication::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    private function interview(Request $request, string $id): Interview
    {
        return Interview::query()
            ->where('company_id', $this->companyId($request))->where('id', $id)->firstOrFail();
    }

    /** @return array<string, mixed> */
    private function interviewPayload(Interview $interview): array
    {
        return [
            'id' => (string) $interview->id,
            'application_id' => (string) $interview->application_id,
            'applicant_name' => $interview->application?->applicant?->full_name,
            'job_title' => $interview->application?->jobOpening?->title,
            'title' => $interview->title,
            'scheduled_at' => $interview->scheduled_at?->toDateTimeString(),
            'duration_minutes' => $interview->duration_minutes,
            'mode' => $interview->mode,
            'location' => $interview->location,
            'status' => $interview->status->value,
            'status_label' => $interview->status->label(),
            'decision' => $interview->decision,
            'notes' => $interview->notes,
            'interviewer' => $interview->interviewer === null ? null : $interview->interviewer->fullName(),
        ];
    }
}
