<?php

declare(strict_types=1);

namespace Modules\Logistics\Operations\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Enums\ExceptionStatus;
use Modules\Logistics\Operations\Domain\Models\ExceptionNote;
use Modules\Logistics\Operations\Domain\Models\OperationalException;
use Modules\Logistics\Operations\Domain\Services\ExceptionEscalationService;
use Modules\Logistics\Operations\Domain\Services\ExceptionQueryService;
use Modules\Logistics\Operations\Domain\Services\ExceptionRegistryService;
use Modules\Logistics\Operations\Domain\Services\ExceptionResolutionService;
use Modules\Logistics\Operations\Domain\Services\OperationalAlertService;
use Modules\Logistics\Operations\Presentation\Http\Resources\OperationalExceptionResource;

/**
 * The merged exception queue, its escalations, its notes and the alert rules.
 *
 * Resolving is deliberately narrow: an exception owned by Fleet can only be
 * closed as "handled elsewhere", because closing it here would not put the
 * vehicle back on the road — it would only stop anyone being told.
 */
class ExceptionController extends Controller
{
    public function __construct(
        private readonly ExceptionQueryService $queries,
        private readonly ExceptionRegistryService $registry,
        private readonly ExceptionResolutionService $resolution,
        private readonly ExceptionEscalationService $escalation,
        private readonly OperationalAlertService $alerts,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            'sources' => ExceptionSource::options(),
            'categories' => ExceptionCategory::options(),
            'severities' => ExceptionSeverity::options(),
            'statuses' => ExceptionStatus::options(),
            'resolutions' => [
                ['value' => OperationalException::RESOLUTION_FIXED, 'label' => 'Fixed'],
                ['value' => OperationalException::RESOLUTION_HANDLED_ELSEWHERE, 'label' => 'Handled in the owning module'],
                ['value' => OperationalException::RESOLUTION_NOT_A_PROBLEM, 'label' => 'Not a problem'],
                ['value' => OperationalException::RESOLUTION_ACCEPTED, 'label' => 'Accepted as-is'],
            ],
            'note_types' => [
                ['value' => ExceptionNote::TYPE_NOTE, 'label' => 'Note'],
                ['value' => ExceptionNote::TYPE_ACTION, 'label' => 'Action taken'],
                ['value' => ExceptionNote::TYPE_HANDOVER, 'label' => 'Handover'],
            ],
            'max_escalation_level' => ExceptionEscalationService::MAX_LEVEL,
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $paginator = $this->queries->paginate([
            'company_id' => $this->companyId($request),
            'status' => $request->filled('status') ? $request->string('status')->toString() : null,
            'outstanding_only' => $request->boolean('outstanding_only'),
            'source' => $request->filled('source') ? $request->string('source')->toString() : null,
            'category' => $request->filled('category') ? $request->string('category')->toString() : null,
            'severity' => $request->filled('severity') ? $request->string('severity')->toString() : null,
            'search' => $request->filled('search') ? $request->string('search')->toString() : null,
        ], (int) $request->integer('per_page', 25));

        return OperationalExceptionResource::collection($paginator)->response();
    }

    public function show(string $id): OperationalExceptionResource
    {
        return new OperationalExceptionResource(
            $this->exception($id)->load('sourceConflict')->loadCount('notes')
        );
    }

    public function summary(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->queries->summary($this->companyId($request))]);
    }

    // ── Working an exception ─────────────────────────────────────────────────

    public function acknowledge(Request $request, string $id): OperationalExceptionResource
    {
        return new OperationalExceptionResource(
            $this->resolution->acknowledge(
                $this->exception($id),
                $request->user()?->id,
                $request->user()?->name,
            )
        );
    }

    public function resolve(Request $request, string $id): OperationalExceptionResource
    {
        $validated = $request->validate([
            'resolution' => ['required', Rule::in([
                OperationalException::RESOLUTION_FIXED,
                OperationalException::RESOLUTION_HANDLED_ELSEWHERE,
                OperationalException::RESOLUTION_NOT_A_PROBLEM,
                OperationalException::RESOLUTION_ACCEPTED,
            ])],
            // Mandatory: an exception closed with no note teaches the next
            // person nothing, and the same problem arrives again next week.
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return new OperationalExceptionResource(
            $this->resolution->resolve(
                $this->exception($id),
                $validated['resolution'],
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            )
        );
    }

    public function suppress(Request $request, string $id): OperationalExceptionResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        return new OperationalExceptionResource(
            $this->resolution->suppress(
                $this->exception($id),
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            )
        );
    }

    // ── Notes ────────────────────────────────────────────────────────────────

    public function notes(string $id): JsonResponse
    {
        $notes = $this->resolution->notesFor($this->exception($id));

        return response()->json([
            'data' => array_map(static fn (ExceptionNote $note) => [
                'id' => $note->uuid,
                'body' => $note->body,
                'note_type' => $note->note_type,
                'is_pinned' => $note->is_pinned,
                'written_at' => $note->written_at?->toIso8601String(),
                'author_name' => $note->author_name,
            ], $notes),
        ]);
    }

    public function addNote(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'body' => ['required', 'string', 'max:5000'],
            'note_type' => ['nullable', Rule::in([
                ExceptionNote::TYPE_NOTE,
                ExceptionNote::TYPE_ACTION,
                ExceptionNote::TYPE_HANDOVER,
            ])],
            'is_pinned' => ['nullable', 'boolean'],
        ]);

        $note = $this->resolution->addNote(
            $this->exception($id),
            $validated['body'],
            $validated['note_type'] ?? ExceptionNote::TYPE_NOTE,
            (bool) ($validated['is_pinned'] ?? false),
            $request->user()?->id,
            $request->user()?->name,
        );

        return response()->json([
            'data' => [
                'id' => $note->uuid,
                'body' => $note->body,
                'note_type' => $note->note_type,
                'is_pinned' => $note->is_pinned,
                'written_at' => $note->written_at?->toIso8601String(),
                'author_name' => $note->author_name,
            ],
        ], 201);
    }

    // ── Escalation ───────────────────────────────────────────────────────────

    public function escalate(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
            'to_role' => ['nullable', 'string', 'max:60'],
            'to_user_id' => ['nullable', 'integer'],
        ]);

        $escalation = $this->escalation->escalate(
            $this->exception($id),
            $validated['reason'],
            $validated['to_role'] ?? null,
            isset($validated['to_user_id']) ? (int) $validated['to_user_id'] : null,
            $request->user()?->id,
            $request->user()?->name,
        );

        return response()->json([
            'data' => [
                'id' => $escalation->uuid,
                'level' => $escalation->level,
                'reason' => $escalation->reason,
                'trigger' => $escalation->trigger,
                'escalated_to_role' => $escalation->escalated_to_role,
                'escalated_at' => $escalation->escalated_at?->toIso8601String(),
                'escalated_by_name' => $escalation->escalated_by_name,
            ],
        ], 201);
    }

    public function escalationHistory(string $id): JsonResponse
    {
        $history = $this->escalation->historyFor($this->exception($id));

        return response()->json([
            'data' => array_map(static fn ($e) => [
                'id' => $e->uuid,
                'level' => $e->level,
                'reason' => $e->reason,
                'trigger' => $e->trigger,
                'was_automatic' => $e->wasAutomatic(),
                'escalated_to_role' => $e->escalated_to_role,
                'escalated_at' => $e->escalated_at?->toIso8601String(),
                'escalated_by_name' => $e->escalated_by_name,
                'acknowledged_at' => $e->acknowledged_at?->toIso8601String(),
            ], $history),
        ]);
    }

    /** Escalate everything that has waited past its threshold. */
    public function escalateOverdue(Request $request): JsonResponse
    {
        $raised = $this->escalation->escalateOverdue($this->companyId($request));

        return response()->json(['escalated' => count($raised)]);
    }

    /** Close exceptions whose originating conflict Dispatch has since settled. */
    public function reconcile(): JsonResponse
    {
        return response()->json(['closed' => $this->registry->reconcileResolvedConflicts()]);
    }

    // ── Alerts ───────────────────────────────────────────────────────────────

    public function alerts(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->alerts->active($this->companyId($request))]);
    }

    public function alertSummary(Request $request): JsonResponse
    {
        return response()->json(['data' => $this->alerts->summary($this->companyId($request))]);
    }

    public function alertRules(Request $request): JsonResponse
    {
        return response()->json([
            'data' => array_map(static fn ($rule) => [
                'id' => $rule->uuid,
                'name' => $rule->name,
                'source' => $rule->source?->value,
                'category' => $rule->category?->value,
                'exception_type' => $rule->exception_type,
                'min_severity' => $rule->min_severity->value,
                'is_active' => $rule->is_active,
                'escalate_after_minutes' => $rule->escalate_after_minutes,
                'escalate_to_role' => $rule->escalate_to_role,
                'suppress' => $rule->suppress,
                'suppress_reason' => $rule->suppress_reason,
            ], $this->alerts->rules($this->companyId($request))),
        ]);
    }

    public function storeAlertRule(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:150'],
            'source' => ['nullable', Rule::in(ExceptionSource::values())],
            'category' => ['nullable', Rule::in(ExceptionCategory::values())],
            'exception_type' => ['nullable', 'string', 'max:60'],
            'min_severity' => ['required', Rule::in(ExceptionSeverity::values())],
            'is_active' => ['nullable', 'boolean'],
            'escalate_after_minutes' => ['nullable', 'integer', 'min:1', 'max:1440'],
            'escalate_to_role' => ['nullable', 'string', 'max:60'],
            'suppress' => ['nullable', 'boolean'],
            'suppress_reason' => ['nullable', 'string', 'max:500'],
        ]);

        $validated['company_id'] = $this->companyId($request);

        $rule = $this->alerts->createRule($validated, $request->user()?->id);

        return response()->json(['data' => ['id' => $rule->uuid, 'name' => $rule->name]], 201);
    }

    // ── Internals ─────────────────────────────────────────────────────────────

    private function exception(string $id): OperationalException
    {
        return OperationalException::query()->where('uuid', $id)->firstOrFail();
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
