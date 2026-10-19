<?php

declare(strict_types=1);

namespace Modules\Logistics\ShippingCompanies\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompany;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingCompanyMapping;
use Modules\Logistics\ShippingCompanies\Domain\Models\ShippingContract;
use Modules\Logistics\ShippingCompanies\Presentation\Http\Resources\ShippingCompanyMappingResource;
use Modules\Logistics\ShippingCompanies\Presentation\Http\Resources\ShippingCompanyResource;
use Modules\Logistics\ShippingCompanies\Presentation\Http\Resources\ShippingContractResource;

class ShippingCompanyController extends Controller
{
    // ── Dashboard ────────────────────────────────────────────────────────────

    public function stats(): JsonResponse
    {
        return response()->json([
            'total_companies' => ShippingCompany::count(),
            'active_companies' => ShippingCompany::where('status', ShippingCompany::STATUS_ACTIVE)->count(),
            'internal_companies' => ShippingCompany::where('type', ShippingCompany::TYPE_INTERNAL)->count(),
            'external_companies' => ShippingCompany::where('type', ShippingCompany::TYPE_EXTERNAL)->count(),
            'archived_companies' => ShippingCompany::where('status', ShippingCompany::STATUS_ARCHIVED)->count(),
        ]);
    }

    public function nextCode(): JsonResponse
    {
        // Computed in PHP to stay portable across MySQL and PostgreSQL.
        $max = ShippingCompany::query()
            ->where('code', 'like', 'SHC-%')
            ->pluck('code')
            ->map(fn (string $code) => (int) substr($code, 4))
            ->max() ?? 0;

        return response()->json([
            'code' => sprintf('SHC-%03d', $max + 1),
        ]);
    }

    // ── Shipping Companies CRUD ──────────────────────────────────────────────

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = ShippingCompany::withCount(['contracts', 'mappings'])
            ->with('activeContract')
            ->orderBy('name');

        if ($search = $request->input('search')) {
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('code', 'like', "%{$search}%")
                    ->orWhere('contact_person', 'like', "%{$search}%")
                    ->orWhere('phone', 'like', "%{$search}%");
            });
        }

        if ($request->filled('type') && in_array($request->input('type'), ShippingCompany::TYPES, true)) {
            $query->where('type', $request->input('type'));
        }

        $status = $request->input('status');
        if ($status && in_array($status, ShippingCompany::STATUSES, true)) {
            $query->where('status', $status);
        } elseif ($status !== 'all') {
            // Default view hides archived carriers.
            $query->where('status', '!=', ShippingCompany::STATUS_ARCHIVED);
        }

        $perPage = min((int) $request->input('per_page', 20), 100);

        return ShippingCompanyResource::collection($query->paginate($perPage));
    }

    public function show(int $id): ShippingCompanyResource
    {
        $company = ShippingCompany::withCount(['contracts', 'mappings'])
            ->with(['contracts', 'activeContract', 'mappings.company'])
            ->findOrFail($id);

        return new ShippingCompanyResource($company);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'code' => 'required|string|max:30|unique:logistics_shipping_companies,code',
            'type' => ['required', Rule::in(ShippingCompany::TYPES)],
            'contact_person' => 'nullable|string|max:150',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
            'status' => ['sometimes', Rule::in([ShippingCompany::STATUS_ACTIVE, ShippingCompany::STATUS_INACTIVE])],
        ]);

        $company = ShippingCompany::create($validated);

        // ->response() keeps the standard "data" envelope; response()->json($resource)
        // would serialise the resource without it and break API consistency.
        return (new ShippingCompanyResource($company->loadCount(['contracts', 'mappings'])))
            ->response()
            ->setStatusCode(201);
    }

    public function update(Request $request, int $id): JsonResponse|ShippingCompanyResource
    {
        $company = ShippingCompany::findOrFail($id);

        // Business rule: type is immutable after creation.
        if ($request->filled('type') && $request->input('type') !== $company->type) {
            return response()->json([
                'message' => 'Shipping company type cannot be changed after creation.',
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'code' => [
                'sometimes', 'string', 'max:30',
                Rule::unique('logistics_shipping_companies', 'code')->ignore($company->id),
            ],
            'contact_person' => 'nullable|string|max:150',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:150',
            'address' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:2000',
        ]);

        $company->update($validated);

        return new ShippingCompanyResource(
            $company->loadCount(['contracts', 'mappings'])->load('activeContract')
        );
    }

    /**
     * Set lifecycle status: active | inactive | archived.
     * Archive is reversible — restoring an archived carrier sets it inactive
     * (explicit activation is a separate, deliberate step).
     */
    public function setStatus(Request $request, int $id): ShippingCompanyResource
    {
        $validated = $request->validate([
            'status' => ['required', Rule::in(ShippingCompany::STATUSES)],
        ]);

        $company = ShippingCompany::findOrFail($id);
        $company->update(['status' => $validated['status']]);

        return new ShippingCompanyResource(
            $company->loadCount(['contracts', 'mappings'])->load('activeContract')
        );
    }

    // ── Contracts ────────────────────────────────────────────────────────────

    public function contracts(int $id): AnonymousResourceCollection
    {
        $company = ShippingCompany::findOrFail($id);

        return ShippingContractResource::collection($company->contracts()->get());
    }

    public function storeContract(Request $request, int $id): JsonResponse
    {
        $company = ShippingCompany::findOrFail($id);

        // Business rule: archived companies cannot receive new assignments.
        if ($company->isArchived()) {
            return response()->json([
                'message' => 'Archived shipping companies cannot receive new contracts.',
            ], 422);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:150',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'payment_terms' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
            'status' => ['sometimes', Rule::in(ShippingContract::STATUSES)],
        ]);

        $contract = DB::transaction(function () use ($company, $validated) {
            if (($validated['status'] ?? null) === ShippingContract::STATUS_ACTIVE) {
                // Business rule: at most one active contract per company.
                $company->contracts()->update(['status' => ShippingContract::STATUS_INACTIVE]);
            }

            return $company->contracts()->create($validated);
        });

        return (new ShippingContractResource($contract))
            ->response()
            ->setStatusCode(201);
    }

    public function updateContract(Request $request, int $id, int $contractId): ShippingContractResource
    {
        $company = ShippingCompany::findOrFail($id);
        $contract = $company->contracts()->findOrFail($contractId);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:150',
            'start_date' => 'nullable|date',
            'end_date' => 'nullable|date|after_or_equal:start_date',
            'payment_terms' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:2000',
            'status' => ['sometimes', Rule::in(ShippingContract::STATUSES)],
        ]);

        DB::transaction(function () use ($company, $contract, $validated) {
            if (($validated['status'] ?? null) === ShippingContract::STATUS_ACTIVE) {
                $company->contracts()->whereKeyNot($contract->id)
                    ->update(['status' => ShippingContract::STATUS_INACTIVE]);
            }

            $contract->update($validated);
        });

        return new ShippingContractResource($contract->refresh());
    }

    public function destroyContract(int $id, int $contractId): JsonResponse
    {
        $company = ShippingCompany::findOrFail($id);
        $company->contracts()->findOrFail($contractId)->delete();

        return response()->json(null, 204);
    }

    /** Promote one contract to active; all sibling contracts become inactive. */
    public function activateContract(int $id, int $contractId): ShippingContractResource
    {
        $company = ShippingCompany::findOrFail($id);
        $contract = $company->contracts()->findOrFail($contractId);

        DB::transaction(function () use ($company, $contract) {
            $company->contracts()->whereKeyNot($contract->id)
                ->update(['status' => ShippingContract::STATUS_INACTIVE]);
            $contract->update(['status' => ShippingContract::STATUS_ACTIVE]);
        });

        return new ShippingContractResource($contract->refresh());
    }

    // ── Company Mappings ─────────────────────────────────────────────────────

    public function mappings(int $id): AnonymousResourceCollection
    {
        $company = ShippingCompany::findOrFail($id);

        return ShippingCompanyMappingResource::collection(
            $company->mappings()->with('company')->get()
        );
    }

    public function storeMapping(Request $request, int $id): JsonResponse
    {
        $company = ShippingCompany::findOrFail($id);

        // Business rule: archived companies cannot receive new assignments.
        if ($company->isArchived()) {
            return response()->json([
                'message' => 'Archived shipping companies cannot be linked to ECOS companies.',
            ], 422);
        }

        $validated = $request->validate([
            'company_id' => [
                'required', 'uuid', 'exists:companies,id',
                Rule::unique('logistics_shipping_company_mappings', 'company_id')
                    ->where('shipping_company_id', $company->id),
            ],
        ]);

        $mapping = $company->mappings()->create($validated);

        return (new ShippingCompanyMappingResource($mapping->load('company')))
            ->response()
            ->setStatusCode(201);
    }

    public function destroyMapping(int $id, int $mappingId): JsonResponse
    {
        ShippingCompanyMapping::where('shipping_company_id', $id)
            ->findOrFail($mappingId)
            ->delete();

        return response()->json(null, 204);
    }
}
