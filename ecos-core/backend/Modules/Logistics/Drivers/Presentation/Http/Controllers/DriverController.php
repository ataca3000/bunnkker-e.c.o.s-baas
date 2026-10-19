<?php

declare(strict_types=1);

namespace Modules\Logistics\Drivers\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Modules\Logistics\Drivers\Domain\Exceptions\VehicleAssignmentException;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Drivers\Domain\Models\DriverDocument;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Logistics\Drivers\Presentation\Http\Resources\DriverDocumentResource;
use Modules\Logistics\Drivers\Presentation\Http\Resources\DriverResource;
use Modules\Logistics\Drivers\Presentation\Http\Resources\DriverVehicleAssignmentResource;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DriverController extends Controller
{
    private const MAX_DOCUMENT_MB = 10;

    public function __construct(
        private readonly DriverVehicleAssignmentService $assignments,
    ) {}

    // ── Dashboard ────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        $activeAssignment = fn ($q) => $q->whereNotNull('active_flag');

        return response()->json([
            'total_drivers' => Driver::count(),
            'active_drivers' => Driver::where('status', Driver::STATUS_ACTIVE)->count(),
            'inactive_drivers' => Driver::where('status', Driver::STATUS_INACTIVE)->count(),
            'archived_drivers' => Driver::where('status', Driver::STATUS_ARCHIVED)->count(),
            'expired_license_drivers' => Driver::whereNotNull('license_expiry_date')
                ->whereDate('license_expiry_date', '<', Carbon::today())
                ->count(),
            'expiring_license_drivers' => Driver::whereNotNull('license_expiry_date')
                ->whereDate('license_expiry_date', '>=', Carbon::today())
                ->whereDate('license_expiry_date', '<=', Carbon::today()->addDays(Driver::LICENSE_WARNING_DAYS))
                ->count(),
            'drivers_without_vehicle' => Driver::where('status', '!=', Driver::STATUS_ARCHIVED)
                ->whereDoesntHave('assignments', $activeAssignment)
                ->count(),
        ]);
    }

    public function nextCode(): JsonResponse
    {
        // Computed in PHP to stay portable across MySQL and PostgreSQL.
        $max = Driver::query()
            ->where('driver_code', 'like', 'DRV-%')
            ->pluck('driver_code')
            ->map(fn (string $code) => (int) substr($code, 4))
            ->max() ?? 0;

        return response()->json(['code' => sprintf('DRV-%03d', $max + 1)]);
    }

    // ── Drivers ──────────────────────────────────────────────────────────────

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = Driver::withCount(['documents', 'assignments'])
            ->with(['shippingCompany', 'activeAssignment.vehicle'])
            ->orderBy('full_name');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('full_name', 'like', "%{$search}%")
                    ->orWhere('driver_code', 'like', "%{$search}%")
                    ->orWhere('mobile', 'like', "%{$search}%")
                    ->orWhere('national_id', 'like', "%{$search}%")
                    ->orWhere('license_number', 'like', "%{$search}%");
            });
        }

        $status = $request->input('status');
        if ($status && in_array($status, Driver::STATUSES, true)) {
            $query->where('status', $status);
        } elseif ($status !== 'all') {
            // Default view hides archived drivers.
            $query->where('status', '!=', Driver::STATUS_ARCHIVED);
        }

        if ($request->filled('shipping_company_id')) {
            $query->where('shipping_company_id', (int) $request->input('shipping_company_id'));
        }

        // Licence filter — expired / expiring_soon / valid / missing
        match ($request->input('license_status')) {
            Driver::LICENSE_EXPIRED => $query->whereNotNull('license_expiry_date')
                ->whereDate('license_expiry_date', '<', Carbon::today()),
            Driver::LICENSE_EXPIRING => $query->whereNotNull('license_expiry_date')
                ->whereDate('license_expiry_date', '>=', Carbon::today())
                ->whereDate('license_expiry_date', '<=', Carbon::today()->addDays(Driver::LICENSE_WARNING_DAYS)),
            Driver::LICENSE_VALID => $query->whereNotNull('license_expiry_date')
                ->whereDate('license_expiry_date', '>', Carbon::today()->addDays(Driver::LICENSE_WARNING_DAYS)),
            Driver::LICENSE_MISSING => $query->whereNull('license_expiry_date'),
            default => null,
        };

        // Vehicle filter — assigned / unassigned
        match ($request->input('vehicle')) {
            'assigned' => $query->whereHas('assignments', fn ($q) => $q->whereNotNull('active_flag')),
            'unassigned' => $query->whereDoesntHave('assignments', fn ($q) => $q->whereNotNull('active_flag')),
            default => null,
        };

        $perPage = min((int) $request->input('per_page', 20), 100);

        return DriverResource::collection($query->paginate($perPage));
    }

    public function show(int $id): DriverResource
    {
        $driver = Driver::withCount(['documents', 'assignments'])
            ->with([
                'shippingCompany',
                'documents',
                'activeAssignment.vehicle',
                'assignments.vehicle',
            ])
            ->findOrFail($id);

        return new DriverResource($driver);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate($this->rules());

        $driver = Driver::create($validated);

        return (new DriverResource(
            $driver->loadCount(['documents', 'assignments'])->load(['shippingCompany', 'activeAssignment.vehicle'])
        ))->response()->setStatusCode(201);
    }

    public function update(Request $request, int $id): DriverResource
    {
        $driver = Driver::findOrFail($id);

        $validated = $request->validate($this->rules($driver->id, partial: true));

        $driver->update($validated);

        return new DriverResource(
            $driver->loadCount(['documents', 'assignments'])->load(['shippingCompany', 'activeAssignment.vehicle'])
        );
    }

    /**
     * Lifecycle transition: active | inactive | archived.
     *
     * There is deliberately no destroy endpoint — BR-4 and BR-5 mean a driver
     * is archived, never deleted. Archiving also releases any held vehicle so
     * the vehicle returns to the pool.
     */
    public function setStatus(Request $request, int $id): DriverResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(Driver::STATUSES)],
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        $driver = Driver::findOrFail($id);
        $driver->update(['status' => $validated['status']]);

        if ($validated['status'] === Driver::STATUS_ARCHIVED
            && $driver->activeAssignment()->exists()) {
            $this->assignments->release(
                $driver,
                $this->actor($request),
                $validated['reason'] ?? 'Driver archived.'
            );
        }

        return new DriverResource(
            $driver->fresh()
                ->loadCount(['documents', 'assignments'])
                ->load(['shippingCompany', 'activeAssignment.vehicle'])
        );
    }

    // ── Documents ────────────────────────────────────────────────────────────

    public function documents(int $id): AnonymousResourceCollection
    {
        $driver = Driver::findOrFail($id);

        return DriverDocumentResource::collection($driver->documents()->get());
    }

    public function storeDocument(Request $request, int $id): JsonResponse
    {
        $driver = Driver::findOrFail($id);

        if ($driver->isArchived()) {
            return response()->json([
                'message' => 'Archived drivers cannot receive new documents.',
            ], 422);
        }

        $validated = $request->validate([
            'file' => ['required', 'file', 'max:'.(self::MAX_DOCUMENT_MB * 1024), 'mimes:jpg,jpeg,png,pdf'],
            'type' => ['required', Rule::in(DriverDocument::TYPES)],
            'title' => ['nullable', 'string', 'max:150'],
            'issued_at' => ['nullable', 'date'],
            'expires_at' => ['nullable', 'date', 'after_or_equal:issued_at'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $file = $request->file('file');
        $path = $file->store("driver-documents/{$driver->id}", 'local');

        $document = $driver->documents()->create([
            'type' => $validated['type'],
            'title' => $validated['title'] ?? null,
            'file_path' => $path,
            'file_name' => $file->getClientOriginalName(),
            'mime_type' => $file->getMimeType() ?? 'application/octet-stream',
            'size_bytes' => $file->getSize() ?: 0,
            'issued_at' => $validated['issued_at'] ?? null,
            'expires_at' => $validated['expires_at'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'uploaded_by' => $this->actor($request),
        ]);

        return (new DriverDocumentResource($document))->response()->setStatusCode(201);
    }

    public function downloadDocument(int $id, int $documentId): StreamedResponse|JsonResponse
    {
        $driver = Driver::findOrFail($id);
        $document = $driver->documents()->findOrFail($documentId);

        if (! Storage::disk('local')->exists($document->file_path)) {
            return response()->json(['message' => 'The stored file is no longer available.'], 404);
        }

        return Storage::disk('local')->download($document->file_path, $document->file_name);
    }

    public function destroyDocument(int $id, int $documentId): JsonResponse
    {
        $driver = Driver::findOrFail($id);
        $document = $driver->documents()->findOrFail($documentId);

        Storage::disk('local')->delete($document->file_path);
        $document->delete();

        return response()->json(null, 204);
    }

    // ── Vehicle assignment ───────────────────────────────────────────────────

    public function assignmentHistory(int $id): AnonymousResourceCollection
    {
        $driver = Driver::findOrFail($id);

        return DriverVehicleAssignmentResource::collection(
            $driver->assignments()->with('vehicle')->get()
        );
    }

    /**
     * Assign or change the driver's vehicle. Changing releases the previous
     * pairing inside the same transaction, preserving history.
     */
    public function assignVehicle(Request $request, int $id): JsonResponse
    {
        $driver = Driver::findOrFail($id);

        $validated = $request->validate([
            'vehicle_id' => ['required', 'integer', 'exists:logistics_vehicles,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $vehicle = Vehicle::findOrFail($validated['vehicle_id']);

        try {
            $assignment = $this->assignments->assign(
                $driver,
                $vehicle,
                $this->actor($request),
                $validated['notes'] ?? null,
            );
        } catch (VehicleAssignmentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return (new DriverVehicleAssignmentResource($assignment->load('vehicle')))
            ->response()
            ->setStatusCode(201);
    }

    public function releaseVehicle(Request $request, int $id): JsonResponse|DriverVehicleAssignmentResource
    {
        $driver = Driver::findOrFail($id);

        $validated = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        try {
            $assignment = $this->assignments->release(
                $driver,
                $this->actor($request),
                $validated['reason'] ?? null,
            );
        } catch (VehicleAssignmentException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return new DriverVehicleAssignmentResource($assignment->load('vehicle'));
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    /**
     * @return array<string, mixed>
     */
    private function rules(?int $ignoreId = null, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return [
            'driver_code' => [
                $required, 'string', 'max:30',
                Rule::unique('logistics_drivers', 'driver_code')->ignore($ignoreId),
            ],
            'full_name' => [$required, 'string', 'max:150'],
            'mobile' => [
                $required, 'string', 'max:30',
                Rule::unique('logistics_drivers', 'mobile')->ignore($ignoreId),
            ],
            'national_id' => [
                $required, 'string', 'max:30',
                Rule::unique('logistics_drivers', 'national_id')->ignore($ignoreId),
            ],
            'date_of_birth' => ['nullable', 'date', 'before:today'],
            'address' => ['nullable', 'string', 'max:500'],
            'employment_date' => ['nullable', 'date'],
            'shipping_company_id' => ['nullable', 'integer', 'exists:logistics_shipping_companies,id'],
            'license_number' => ['nullable', 'string', 'max:50'],
            'license_type' => ['nullable', 'string', 'max:30'],
            'license_issue_date' => ['nullable', 'date'],
            'license_expiry_date' => ['nullable', 'date', 'after_or_equal:license_issue_date'],
            'license_issuing_authority' => ['nullable', 'string', 'max:150'],
            'status' => ['sometimes', Rule::in(Driver::STATUSES)],
            'notes' => ['nullable', 'string', 'max:2000'],
        ];
    }

    private function actor(Request $request): ?string
    {
        $user = $request->user();

        return $user?->name ?? $user?->email;
    }
}
