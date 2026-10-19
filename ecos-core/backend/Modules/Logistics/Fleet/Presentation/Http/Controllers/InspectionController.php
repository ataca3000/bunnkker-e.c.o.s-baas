<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\IAM\Domain\Contracts\PermissionServiceInterface;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Enums\DefectSeverity;
use Modules\Logistics\Fleet\Domain\Enums\InspectionKind;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\Defect;
use Modules\Logistics\Fleet\Domain\Models\Inspection;
use Modules\Logistics\Fleet\Domain\Models\InspectionTemplate;
use Modules\Logistics\Fleet\Domain\Services\DefectService;
use Modules\Logistics\Fleet\Domain\Services\InspectionService;
use Modules\Logistics\Fleet\Presentation\Http\Resources\DefectResource;
use Modules\Logistics\Fleet\Presentation\Http\Resources\InspectionResource;

/**
 * Inspections and the defects they raise.
 *
 * Directive 4: the driver's phone submits a checklist. Whether the outcome
 * makes the vehicle unfit is decided by InspectionService on the server.
 */
class InspectionController extends Controller
{
    public function __construct(
        private readonly FleetUnitRepositoryInterface $units,
        private readonly InspectionService $inspections,
        private readonly DefectService $defects,
        private readonly PermissionServiceInterface $permissions,
    ) {}

    // ── Templates ────────────────────────────────────────────────────────────

    public function templates(Request $request): JsonResponse
    {
        $templates = InspectionTemplate::query()
            ->when($request->user()?->company_id, fn ($q, $companyId) => $q->where('company_id', $companyId))
            ->when($request->filled('kind'), fn ($q) => $q->where('kind', $request->string('kind')))
            ->whereNotNull('active_flag')
            ->with('items')
            ->get()
            ->map(static fn (InspectionTemplate $template) => [
                'id' => $template->uuid,
                'uuid' => $template->uuid,
                'code' => $template->code,
                'name' => $template->name,
                'kind' => $template->kind->value,
                'kind_label' => $template->kind->label(),
                'version' => $template->version,
                'fleet_group_id' => $template->fleet_group_id,
                'items' => $template->items->map(static fn ($item) => [
                    'id' => $item->id,
                    'code' => $item->code,
                    'label' => $item->label,
                    'guidance' => $item->guidance,
                    'is_mandatory' => $item->is_mandatory,
                    'requires_photo_on_fail' => $item->requires_photo_on_fail,
                    'failure_severity' => $item->failure_severity->value,
                    'blocks_fitness_on_fail' => $item->failureBlocksFitness(),
                ])->values(),
            ]);

        return response()->json(['data' => $templates]);
    }

    // ── Inspections ──────────────────────────────────────────────────────────

    public function index(Request $request, string $unitId): AnonymousResourceCollection
    {
        $unit = $this->units->findByUuidOrFail($unitId);

        return InspectionResource::collection(
            $unit->inspections()
                ->with('results')
                ->when($request->filled('kind'), fn ($q) => $q->where('kind', $request->string('kind')))
                ->limit((int) $request->integer('limit', 25))
                ->get()
        );
    }

    public function show(string $unitId, string $id): InspectionResource
    {
        return new InspectionResource($this->inspection($unitId, $id)->load('results'));
    }

    public function store(Request $request, string $unitId): JsonResponse
    {
        $validated = $request->validate([
            'template_id' => ['required', 'string', 'max:36'],
            'kind' => ['required', Rule::in(InspectionKind::values())],
            'odometer_km' => ['nullable', 'numeric', 'min:0'],
        ]);

        $unit = $this->units->findByUuidOrFail($unitId);
        $template = InspectionTemplate::where('uuid', $validated['template_id'])->firstOrFail();

        $inspection = $this->inspections->start(
            $unit,
            $template,
            InspectionKind::from($validated['kind']),
            isset($validated['odometer_km']) ? (float) $validated['odometer_km'] : null,
            $request->user()?->id,
        );

        return (new InspectionResource($inspection))->response()->setStatusCode(201);
    }

    /**
     * Record answers and submit. Refuses while a mandatory item is unanswered,
     * and the inspection becomes immutable on success.
     */
    public function submit(Request $request, string $unitId, string $id): JsonResponse|InspectionResource
    {
        $validated = $request->validate([
            'answers' => ['required', 'array', 'min:1'],
            'answers.*.passed' => ['required', 'boolean'],
            'answers.*.comment' => ['nullable', 'string', 'max:1000'],
            'answers.*.photos' => ['nullable', 'array', 'max:10'],
            'answers.*.photos.*' => ['string', 'max:500'],
        ]);

        try {
            $inspection = $this->inspections->submit(
                $this->inspection($unitId, $id),
                $validated['answers'],
                $request->user()?->id,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new InspectionResource($inspection->load('results'));
    }

    /** Failed items become defects; a critical one flips fitness immediately. */
    public function approve(Request $request, string $unitId, string $id): JsonResponse|InspectionResource
    {
        try {
            $inspection = $this->inspections->approve(
                $this->inspection($unitId, $id),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new InspectionResource($inspection->load('results'));
    }

    public function reject(Request $request, string $unitId, string $id): JsonResponse|InspectionResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $inspection = $this->inspections->reject(
                $this->inspection($unitId, $id),
                $validated['reason'],
                $request->user()?->id,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new InspectionResource($inspection->load('results'));
    }

    // ── Defects ──────────────────────────────────────────────────────────────

    public function defects(Request $request): AnonymousResourceCollection
    {
        $query = Defect::query()
            ->when($request->user()?->company_id, fn ($q, $companyId) => $q->where('company_id', $companyId))
            ->when($request->filled('severity'), fn ($q) => $q->where('severity', $request->string('severity')))
            ->when(
                $request->boolean('outstanding_only', true),
                fn ($q) => $q->whereNull('resolved_at')->whereNull('dismissed_by'),
            )
            ->latest('id');

        return DefectResource::collection($query->paginate(
            max(1, min((int) $request->integer('per_page', 20), 100))
        ));
    }

    /** A driver reporting a fault mid-shift, outside any inspection. */
    public function reportDefect(Request $request, string $unitId): JsonResponse
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:200'],
            'description' => ['nullable', 'string', 'max:2000'],
            'severity' => ['required', Rule::in(DefectSeverity::values())],
            'photos' => ['nullable', 'array', 'max:10'],
            'photos.*' => ['string', 'max:500'],
        ]);

        $unit = $this->units->findByUuidOrFail($unitId);
        $severity = DefectSeverity::from($validated['severity']);
        unset($validated['severity']);

        $defect = $this->inspections->reportDefect(
            $unit,
            array_filter($validated, static fn ($v) => $v !== null),
            $severity,
            $request->user()?->id,
            $request->user()?->name,
        );

        return (new DefectResource($defect))->response()->setStatusCode(201);
    }

    public function acknowledgeDefect(string $id): JsonResponse|DefectResource
    {
        try {
            return new DefectResource($this->defects->acknowledge($this->defect($id)));
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }
    }

    public function repairDefect(string $id): JsonResponse|DefectResource
    {
        try {
            return new DefectResource($this->defects->startRepair($this->defect($id)));
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }
    }

    public function resolveDefect(Request $request, string $id): JsonResponse|DefectResource
    {
        try {
            $defect = $this->defects->resolve(
                $this->defect($id),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new DefectResource($defect);
    }

    /**
     * Dismiss without repairing.
     *
     * A critical defect additionally requires fleet.health.override — checked
     * here rather than in the route because the requirement depends on the
     * record's severity, which middleware cannot see.
     */
    public function dismissDefect(Request $request, string $id): JsonResponse|DefectResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        $user = $request->user();
        $canOverride = $user !== null
            && ($this->permissions->userHasSystemRole($user)
                || $this->permissions->userHasPermission($user, 'fleet.health.override'));

        try {
            $defect = $this->defects->dismiss(
                $this->defect($id),
                $validated['reason'],
                $canOverride,
                $user?->id,
                $user?->name,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new DefectResource($defect);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function inspection(string $unitId, string $id): Inspection
    {
        return Inspection::query()
            ->where('uuid', $id)
            ->whereHas('unit', fn ($q) => $q->where('uuid', $unitId))
            ->firstOrFail();
    }

    private function defect(string $id): Defect
    {
        return Defect::query()->where('uuid', $id)->firstOrFail();
    }

    private function unprocessable(FleetException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }
}
