<?php

declare(strict_types=1);

namespace Modules\Logistics\Vehicles\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Modules\Logistics\Vehicles\Domain\Contracts\VehicleRepositoryInterface;
use Modules\Logistics\Vehicles\Domain\Enums\FuelType;
use Modules\Logistics\Vehicles\Domain\Enums\MaintenanceType;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleDocumentType;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleStatus;
use Modules\Logistics\Vehicles\Domain\Enums\VehicleType;
use Modules\Logistics\Vehicles\Domain\Events\VehicleDocumentUploaded;
use Modules\Logistics\Vehicles\Domain\Exceptions\VehicleException;
use Modules\Logistics\Vehicles\Domain\Services\VehicleService;
use Modules\Logistics\Vehicles\Presentation\Http\Resources\VehicleDocumentResource;
use Modules\Logistics\Vehicles\Presentation\Http\Resources\VehicleResource;
use Symfony\Component\HttpFoundation\StreamedResponse;

class VehicleController extends Controller
{
    private const MAX_DOCUMENT_MB = 10;

    public function __construct(
        private readonly VehicleRepositoryInterface $vehicles,
        private readonly VehicleService $service,
    ) {}

    // ── Reference data ───────────────────────────────────────────────────────

    /** Enum catalogue so the UI never hardcodes vocabularies. */
    public function options(): JsonResponse
    {
        return response()->json([
            'types' => VehicleType::options(),
            'statuses' => VehicleStatus::options(),
            'operator_settable_statuses' => array_map(
                static fn (VehicleStatus $s) => ['value' => $s->value, 'label' => $s->label()],
                VehicleStatus::operatorSettable(),
            ),
            'fuel_types' => FuelType::options(),
            'maintenance_types' => MaintenanceType::options(),
            'document_types' => VehicleDocumentType::options(),
        ]);
    }

    public function stats(): JsonResponse
    {
        return response()->json($this->vehicles->statistics());
    }

    public function nextCode(): JsonResponse
    {
        return response()->json(['code' => $this->vehicles->nextCode()]);
    }

    // ── Vehicles ─────────────────────────────────────────────────────────────

    public function index(Request $request): AnonymousResourceCollection
    {
        $perPage = min((int) $request->input('per_page', 20), 100);

        return VehicleResource::collection(
            $this->vehicles->paginate($request->all(), $perPage)
        );
    }

    public function show(int $id): VehicleResource
    {
        return new VehicleResource($this->vehicles->findByIdOrFail($id));
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $vehicle = $this->service->create($validated, $this->actor($request));

        return (new VehicleResource($this->vehicles->findByIdOrFail($vehicle->id)))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, int $id): VehicleResource
    {
        $vehicle = $this->vehicles->findByIdOrFail($id);

        $validated = $request->validate($this->rules($vehicle->id, partial: true));

        $this->service->update($vehicle, $validated, $this->actor($request));

        return new VehicleResource($this->vehicles->findByIdOrFail($id));
    }

    /**
     * Lifecycle transition. Invalid moves are rejected by the transition table
     * rather than silently applied (BR-4).
     */
    public function setStatus(Request $request, int $id): JsonResponse|VehicleResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(VehicleStatus::values())],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $vehicle = $this->vehicles->findByIdOrFail($id);

        try {
            $this->service->changeStatus(
                $vehicle,
                VehicleStatus::from($validated['status']),
                $validated['reason'] ?? null,
                $this->actor($request),
            );
        } catch (VehicleException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new VehicleResource($this->vehicles->findByIdOrFail($id));
    }

    // ── Documents ────────────────────────────────────────────────────────────

    public function documents(int $id): AnonymousResourceCollection
    {
        $vehicle = $this->vehicles->findByIdOrFail($id);

        return VehicleDocumentResource::collection($vehicle->documents()->get());
    }

    public function storeDocument(Request $request, int $id): JsonResponse
    {
        $vehicle = $this->vehicles->findByIdOrFail($id);

        if ($vehicle->isArchived()) {
            return response()->json([
                'message' => 'Archived vehicles cannot receive new documents.',
            ], 422);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:'.(self::MAX_DOCUMENT_MB * 1024), 'mimes:jpg,jpeg,png,pdf'],
            'type' => ['required', Rule::in(VehicleDocumentType::values())],
            'title' => ['nullable', 'string', 'max:150'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $file = $request->file('file');
        $path = $file->store("vehicle-documents/{$vehicle->id}", 'local');

        $document = $vehicle->documents()->create([
            'type' => $validated['type'],
            'title' => $validated['title'] ?? null,
            'reference_number' => $validated['reference_number'] ?? null,
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'size_bytes' => $file->getSize() ?: 0,
            'issued_at' => $validated['issued_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'uploaded_by' => $this->actor($request),
        ]);

        VehicleDocumentUploaded::dispatch($vehicle, $document, $this->actor($request));

        return (new VehicleDocumentResource($document))->response()->setStatusCode(201);
    }

    public function downloadDocument(int $id, int $documentId): StreamedResponse|JsonResponse
    {
        $vehicle = $this->vehicles->findByIdOrFail($id);
        $document = $vehicle->documents()->findOrFail($documentId);

        if (! Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['message' => 'The stored file is no longer available.'], 404);
        }

        return Storage::disk('local')->download($document->file_path, $document->file_name);
    }

    public function destroyDocument(int $id, int $documentId): JsonResponse
    {
        $vehicle = $this->vehicles->findByIdOrFail($id);
        $document = $vehicle->documents()->findOrFail($documentId);

        Storage::disk('local')->delete($document->file_path);
        $document->delete();

        return response()->json(null, 204);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function rules(?int $ignoreId = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'vehicle_code' => [
                $required, 'string', 'max:30',
                Rule::unique('logistics_vehicles', 'vehicle_code')->ignore($ignoreId),
            ],
            'plate_number' => [
                $required, 'string', 'max:30',
                Rule::unique('logistics_vehicles', 'plate_number')->ignore($ignoreId),
            ],
            'name' => ['nullable', 'string', 'max:150'],
            'type' => [$required, Rule::in(VehicleType::values())],
            'shipping_company_id' => ['nullable', 'integer', 'exists:logistics_shipping_companies,id'],
            'company_id' => ['nullable', 'uuid', 'exists:companies,id'],
            'branch_id' => ['nullable', 'uuid', 'exists:branches,id'],
            // BR-6 — capacities must be greater than zero when supplied.
            'capacity_orders' => [$required, 'integer', 'min:1', 'max:10000'],
            'capacity_weight_kg' => ['nullable', 'numeric', 'gt:0', 'max:99999999'],
            'capacity_volume_m3' => ['nullable', 'numeric', 'gt:0', 'max:9999999'],
            'fuel_type' => ['nullable', Rule::in(FuelType::values())],
            'manufacturer' => ['nullable', 'string', 'max:80'],
            'model' => ['nullable', 'string', 'max:50'],
            'year' => ['nullable', 'integer', 'min:1950', 'max:2100'],
            'color' => ['nullable', 'string', 'max:40'],
            'vin' => ['nullable', 'string', 'max:40'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function actor(Request $request): ?string
    {
        $user = $request->user();

        return $user?->name ?? $user?->email;
    }
}
