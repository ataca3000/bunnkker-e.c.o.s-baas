<?php

declare(strict_types=1);

namespace Modules\Logistics\Carriers\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Logistics\Carriers\Domain\Exceptions\CarrierException;
use Modules\Logistics\Carriers\Domain\Models\CarrierAccount;
use Modules\Logistics\Carriers\Domain\Services\CarrierAdapterFactory;
use Modules\Logistics\Carriers\Domain\ValueObjects\CarrierCapabilitySet;
use Modules\Logistics\Carriers\Presentation\Http\Resources\CarrierAccountResource;

/**
 * Carrier accounts, capabilities and status mappings.
 *
 * Phase 2 is the FOUNDATION: the adapter registry, the internal fleet adapter,
 * and account configuration. No provider-specific integration, no tendering,
 * no webhooks yet.
 *
 * Credentials never appear here — they live in the Provider Platform's
 * encrypted store and `provider_reference` is hidden on the model.
 */
class CarrierController extends Controller
{
    public function __construct(
        private readonly CarrierAdapterFactory $adapters,
    ) {}

    public function options(): JsonResponse
    {
        return response()->json([
            // The registry is the ONE place carriers are named.
            'adapters' => $this->adapters->catalogue(),
            'capabilities' => array_map(
                static fn (string $capability) => [
                    'value' => $capability,
                    'absence_meaning' => CarrierCapabilitySet::absenceMeaning($capability),
                ],
                CarrierCapabilitySet::ALL,
            ),
            'modes' => [
                ['value' => CarrierAccount::MODE_INTERNAL, 'label' => 'Own Fleet'],
                ['value' => CarrierAccount::MODE_EXTERNAL, 'label' => 'External Carrier'],
            ],
            'statuses' => [
                ['value' => CarrierAccount::STATUS_DRAFT, 'label' => 'Draft'],
                ['value' => CarrierAccount::STATUS_ACTIVE, 'label' => 'Active'],
                ['value' => CarrierAccount::STATUS_DISABLED, 'label' => 'Disabled'],
            ],
        ]);
    }

    public function index(Request $request): JsonResponse
    {
        $query = CarrierAccount::query()
            ->when($this->companyId($request), fn ($q, $id) => $q->where('company_id', $id))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->filled('mode'), fn ($q) => $q->where('mode', $request->string('mode')))
            ->with(['capabilities', 'shippingCompany'])
            ->orderByDesc('is_default')
            ->orderByDesc('priority');

        return CarrierAccountResource::collection(
            $query->paginate(max(1, min((int) $request->integer('per_page', 20), 100)))
        )->response();
    }

    public function show(string $id): CarrierAccountResource
    {
        return new CarrierAccountResource(
            $this->account($id)->load(['capabilities', 'statusMappings', 'shippingCompany'])
        );
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'adapter_key' => ['required', 'string', 'max:60'],
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:150'],
            'mode' => ['nullable', Rule::in([
                CarrierAccount::MODE_INTERNAL,
                CarrierAccount::MODE_EXTERNAL,
            ])],
            'shipping_company_id' => ['nullable', 'integer', 'exists:logistics_shipping_companies,id'],
            'priority' => ['nullable', 'integer', 'min:0', 'max:1000'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        // Refuse an unknown adapter rather than falling back — silently
        // substituting a different carrier would send shipments to the wrong
        // place.
        if (! $this->adapters->has($validated['adapter_key'])) {
            return $this->unprocessable(CarrierException::unknownAdapter($validated['adapter_key']));
        }

        $validated['company_id'] = $this->companyId($request);
        $validated['created_by'] = $request->user()?->id;

        $account = CarrierAccount::create(array_filter($validated, static fn ($v) => $v !== null));

        // Seed declared capabilities from the adapter so the account is
        // immediately queryable without a round trip.
        $adapter = $this->adapters->for($account);
        foreach ($adapter->capabilities($account)->toArray() as $capability => $supported) {
            $account->capabilities()->create([
                'capability' => $capability,
                'is_supported' => $supported,
            ]);
        }

        return (new CarrierAccountResource($account->load('capabilities')))
            ->response()
            ->setStatusCode(201);
    }

    /** Declared capabilities, straight from the adapter. */
    public function capabilities(string $id): JsonResponse
    {
        $account = $this->account($id);

        try {
            $set = $this->adapters->for($account)->capabilities($account);
        } catch (CarrierException $e) {
            return $this->unprocessable($e);
        }

        return response()->json([
            'data' => [
                'supported' => $set->supportedList(),
                'all' => array_map(
                    static fn (string $capability) => [
                        'capability' => $capability,
                        'is_supported' => $set->supports($capability),
                        'absence_meaning' => $set->supports($capability)
                            ? null
                            : CarrierCapabilitySet::absenceMeaning($capability),
                    ],
                    CarrierCapabilitySet::ALL,
                ),
            ],
        ]);
    }

    public function testConnection(string $id): JsonResponse
    {
        $account = $this->account($id);

        try {
            $result = $this->adapters->for($account)->testConnection($account);
        } catch (CarrierException $e) {
            return $this->unprocessable($e);
        }

        return response()->json(['data' => $result]);
    }

    /** Status mappings are DATA — a new carrier status needs no deploy. */
    public function statusMappings(string $id): JsonResponse
    {
        $mappings = $this->account($id)->statusMappings()->get()
            ->map(static fn ($mapping) => [
                'id' => $mapping->id,
                'carrier_status' => $mapping->carrier_status,
                'delivery_status' => $mapping->delivery_status,
                'failure_reason' => $mapping->failure_reason,
                'is_complete' => $mapping->isComplete(),
                'description' => $mapping->description,
            ]);

        return response()->json(['data' => $mappings]);
    }

    public function upsertStatusMapping(Request $request, string $id): JsonResponse
    {
        $validated = $request->validate([
            'carrier_status' => ['required', 'string', 'max:80'],
            'delivery_status' => ['nullable', 'string', 'max:40'],
            'failure_reason' => ['nullable', 'string', 'max:40'],
            'description' => ['nullable', 'string', 'max:500'],
        ]);

        $account = $this->account($id);

        $mapping = $account->statusMappings()->updateOrCreate(
            ['carrier_status' => $validated['carrier_status']],
            [
                'delivery_status' => $validated['delivery_status'] ?? null,
                'failure_reason' => $validated['failure_reason'] ?? null,
                'description' => $validated['description'] ?? null,
            ],
        );

        return response()->json([
            'data' => [
                'id' => $mapping->id,
                'carrier_status' => $mapping->carrier_status,
                'delivery_status' => $mapping->delivery_status,
                'is_complete' => $mapping->isComplete(),
            ],
        ]);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private function account(string $id): CarrierAccount
    {
        return CarrierAccount::where('uuid', $id)->firstOrFail();
    }

    private function unprocessable(CarrierException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }

    private function companyId(Request $request): ?string
    {
        $companyId = $request->user()?->company_id;

        return $companyId === null ? null : (string) $companyId;
    }
}
