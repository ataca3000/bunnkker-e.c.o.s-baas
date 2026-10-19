<?php

declare(strict_types=1);

namespace Modules\Logistics\Fleet\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Routing\Controller;
use Illuminate\Support\Carbon;
use Modules\Logistics\Fleet\Domain\Contracts\FleetUnitRepositoryInterface;
use Modules\Logistics\Fleet\Domain\Exceptions\FleetException;
use Modules\Logistics\Fleet\Domain\Models\FuelTransaction;
use Modules\Logistics\Fleet\Domain\Services\FuelReconciliationService;
use Modules\Logistics\Fleet\Presentation\Http\Resources\FuelTransactionResource;

/**
 * Fuel capture and reconciliation.
 *
 * ┌─ CASH BOUNDARY (D8) ────────────────────────────────────────────────────┐
 * │ These endpoints record an operational EXPENSE and post it to the Fleet   │
 * │ cost ledger, which Accounting consumes. They compute no settlement, and  │
 * │ touch no distribution_* table — Distribution remains the Single Cash     │
 * │ Authority for trip cash.                                                 │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class FuelController extends Controller
{
    public function __construct(
        private readonly FleetUnitRepositoryInterface $units,
        private readonly FuelReconciliationService $fuel,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $query = FuelTransaction::query()
            ->when($request->user()?->company_id, fn ($q, $companyId) => $q->where('company_id', $companyId))
            ->when($request->filled('status'), fn ($q) => $q->where('status', $request->string('status')))
            ->when($request->boolean('anomalies_only'), fn ($q) => $q->where('has_anomaly', true))
            ->latest('transacted_at');

        return FuelTransactionResource::collection($query->paginate(
            max(1, min((int) $request->integer('per_page', 20), 100))
        ));
    }

    public function show(string $id): FuelTransactionResource
    {
        return new FuelTransactionResource($this->transaction($id));
    }

    /**
     * Capture a purchase. Validation runs immediately and raises FLAGS rather
     * than rejecting — most anomalies are real purchases with an unusual
     * pattern, and auto-rejecting teaches operators to ignore the flag.
     *
     * An odometer reading is mandatory: without it, efficiency and every
     * cost-per-kilometre metric are meaningless.
     */
    public function store(Request $request, string $unitId): JsonResponse
    {
        $validated = $request->validate([
            'litres' => ['required', 'numeric', 'min:0.001'],
            'cost' => ['required', 'numeric', 'min:0'],
            'currency' => ['nullable', 'string', 'size:3'],
            'odometer_km' => ['required', 'numeric', 'min:0'],
            'station' => ['nullable', 'string', 'max:150'],
            'reference_number' => ['nullable', 'string', 'max:100'],
            'transacted_at' => ['nullable', 'date'],
            'fuel_card_id' => ['nullable', 'integer', 'exists:fleet_fuel_cards,id'],
            'source' => ['nullable', 'string', 'max:20'],
            'photos' => ['nullable', 'array', 'max:5'],
            'photos.*' => ['string', 'max:500'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $unit = $this->units->findByUuidOrFail($unitId);

        try {
            $transaction = $this->fuel->capture(
                $unit,
                array_filter($validated, static fn ($v) => $v !== null),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return (new FuelTransactionResource($transaction))->response()->setStatusCode(201);
    }

    public function reconcile(Request $request, string $id): JsonResponse|FuelTransactionResource
    {
        try {
            $transaction = $this->fuel->reconcile(
                $this->transaction($id),
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new FuelTransactionResource($transaction);
    }

    public function dispute(Request $request, string $id): JsonResponse|FuelTransactionResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $transaction = $this->fuel->dispute(
                $this->transaction($id),
                $validated['reason'],
                $request->user()?->id,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new FuelTransactionResource($transaction);
    }

    public function writeOff(Request $request, string $id): JsonResponse|FuelTransactionResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $transaction = $this->fuel->writeOff(
                $this->transaction($id),
                $validated['reason'],
                $request->user()?->id,
                $request->user()?->name,
            );
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new FuelTransactionResource($transaction);
    }

    public function reject(Request $request, string $id): JsonResponse|FuelTransactionResource
    {
        $validated = $request->validate([
            'reason' => ['required', 'string', 'max:1000'],
        ]);

        try {
            $transaction = $this->fuel->reject($this->transaction($id), $validated['reason']);
        } catch (FleetException $e) {
            return $this->unprocessable($e);
        }

        return new FuelTransactionResource($transaction);
    }

    /** Efficiency over a window, with the derived per-km figures. */
    public function efficiency(Request $request, string $unitId): JsonResponse
    {
        $validated = $request->validate([
            'from' => ['nullable', 'date'],
            'to' => ['nullable', 'date'],
        ]);

        $unit = $this->units->findByUuidOrFail($unitId);

        $from = isset($validated['from']) ? Carbon::parse($validated['from']) : Carbon::today()->subMonths(3);
        $to = isset($validated['to']) ? Carbon::parse($validated['to']) : Carbon::today();

        return response()->json([
            'data' => $this->fuel->efficiency($unit, $from, $to),
        ]);
    }

    private function transaction(string $id): FuelTransaction
    {
        return FuelTransaction::query()->where('uuid', $id)->firstOrFail();
    }

    private function unprocessable(FleetException $e): JsonResponse
    {
        return response()->json(['message' => $e->getMessage()], 422);
    }
}
