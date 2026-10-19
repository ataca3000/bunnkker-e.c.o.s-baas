<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Dispatch\Domain\Enums\AllocationStatus;
use Modules\Logistics\Dispatch\Domain\Enums\ConflictType;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictDetected;
use Modules\Logistics\Dispatch\Domain\Events\DispatchConflictResolved;
use Modules\Logistics\Dispatch\Domain\Models\DispatchConflict;
use Modules\Logistics\Dispatch\Domain\Models\ResourceAllocation;
use Modules\Logistics\Dispatch\Domain\Services\ConflictDetectionService;
use Modules\Logistics\Dispatch\Domain\Services\ConflictResolutionService;
use Modules\Logistics\Operations\Domain\Enums\ExceptionCategory;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSeverity;
use Modules\Logistics\Operations\Domain\Enums\ExceptionSource;
use Modules\Logistics\Operations\Domain\Events\DiagnosticsGenerated;
use Modules\Logistics\Operations\Domain\Events\ExecutiveSummaryGenerated;
use Modules\Logistics\Operations\Domain\Events\LogisticsHealthCalculated;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionRaised;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionResolved;
use Modules\Logistics\Operations\Domain\Events\ReadinessValidated;
use Modules\Logistics\Operations\Domain\Models\OperationalException;
use Modules\Logistics\Operations\Domain\Services\ExceptionRegistryService;
use Modules\Logistics\Operations\Domain\Services\ExceptionResolutionService;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use ReflectionClass;
use Tests\TestCase;

/**
 * TASK-LOG-V2-EVENTS-001 — Enterprise Operational Domain Events.
 *
 * These tests verify the events layer WITHOUT any behavioural change:
 *
 *   • Correct dispatch at each milestone
 *   • Correct, immutable scalar payload
 *   • No duplicated dispatch (the reason DiagnosticsService was consolidated)
 *   • Deduplicated recurrences do NOT raise a new event
 *   • The response is unchanged whether or not anyone is listening
 */
class OperationalEventsTest extends TestCase
{
    use DatabaseTransactions;

    private const OPS = '/api/logistics/operations';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Events Test Admin',
            'slug' => 'events-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    private function suffix(): string
    {
        return substr(md5(uniqid('', true)), 0, 8);
    }

    // ═══ READ-PROJECTION MILESTONES ══════════════════════════════════════════

    public function test_validation_dispatches_readiness_validated_once(): void
    {
        Event::fake([ReadinessValidated::class]);

        $this->auth()->getJson(self::OPS.'/readiness/validate')->assertOk();

        Event::assertDispatchedTimes(ReadinessValidated::class, 1);
        Event::assertDispatched(ReadinessValidated::class, function (ReadinessValidated $e) {
            // Empty company → not ready. The event carries the verdict as scalars.
            return $e->overallStatus === 'not_ready'
                && is_int($e->readyCount)
                && $e->companyId === (string) $this->company->id;
        });
    }

    public function test_health_score_dispatches_logistics_health_calculated_once(): void
    {
        Event::fake([LogisticsHealthCalculated::class]);

        $this->auth()->getJson(self::OPS.'/readiness/health-score')->assertOk();

        Event::assertDispatchedTimes(LogisticsHealthCalculated::class, 1);
        Event::assertDispatched(LogisticsHealthCalculated::class, function (LogisticsHealthCalculated $e) {
            return is_int($e->score) && $e->score >= 0 && $e->score <= 100 && $e->grade !== '';
        });
    }

    /**
     * The diagnostics center builds two sections from the validation report;
     * consolidating it to compute the report once is what keeps this at one.
     */
    public function test_diagnostics_dispatches_each_event_exactly_once(): void
    {
        Event::fake([DiagnosticsGenerated::class, ReadinessValidated::class]);

        $this->auth()->getJson(self::OPS.'/diagnostics')->assertOk();

        Event::assertDispatchedTimes(DiagnosticsGenerated::class, 1);
        // The critical assertion: NOT twice, despite two sections using the report.
        Event::assertDispatchedTimes(ReadinessValidated::class, 1);
    }

    public function test_executive_summary_dispatches_its_event_once(): void
    {
        Event::fake([ExecutiveSummaryGenerated::class]);

        $this->auth()->getJson(self::OPS.'/summary/executive')->assertOk();

        Event::assertDispatchedTimes(ExecutiveSummaryGenerated::class, 1);
        Event::assertDispatched(ExecutiveSummaryGenerated::class, function (ExecutiveSummaryGenerated $e) {
            return is_int($e->healthScore) && $e->overallStatus !== '';
        });
    }

    /** The dashboard does not fire the health-calculated milestone — only the
     *  dedicated health-score endpoint (and the executive summary) does. */
    public function test_the_dashboard_does_not_fire_health_calculated(): void
    {
        Event::fake([LogisticsHealthCalculated::class]);

        $this->auth()->getJson(self::OPS.'/readiness')->assertOk();

        Event::assertNotDispatched(LogisticsHealthCalculated::class);
    }

    // ═══ EXCEPTION MILESTONES ════════════════════════════════════════════════

    public function test_a_new_exception_raises_the_event(): void
    {
        Event::fake([OperationalExceptionRaised::class]);

        $exception = $this->recordException('unique:'.$this->suffix());

        Event::assertDispatchedTimes(OperationalExceptionRaised::class, 1);
        Event::assertDispatched(OperationalExceptionRaised::class, function (OperationalExceptionRaised $e) use ($exception) {
            return $e->exceptionUuid === $exception->uuid
                && $e->source === 'operations'
                && $e->severity === 'warning';
        });
    }

    /** A deduplicated recurrence bumps a counter and raises NOTHING. */
    public function test_a_deduplicated_recurrence_does_not_raise_again(): void
    {
        $key = 'dedup:'.$this->suffix();
        $this->recordException($key); // first — outside the fake

        Event::fake([OperationalExceptionRaised::class]);

        $this->recordException($key); // recurrence
        $this->recordException($key); // and again

        Event::assertNotDispatched(OperationalExceptionRaised::class);
    }

    public function test_resolving_an_exception_dispatches_the_resolved_event(): void
    {
        $exception = $this->recordException('resolve:'.$this->suffix());

        Event::fake([OperationalExceptionResolved::class]);

        app(ExceptionResolutionService::class)->resolve(
            $exception,
            OperationalException::RESOLUTION_FIXED,
            'Dealt with.',
        );

        Event::assertDispatchedTimes(OperationalExceptionResolved::class, 1);
        Event::assertDispatched(OperationalExceptionResolved::class, function (OperationalExceptionResolved $e) {
            // A human resolution — distinct from auto-resolution.
            return $e->status === 'resolved' && $e->resolution === OperationalException::RESOLUTION_FIXED;
        });
    }

    public function test_auto_resolution_marks_the_event_as_auto(): void
    {
        $exception = $this->recordException('auto:'.$this->suffix());

        Event::fake([OperationalExceptionResolved::class]);

        app(ExceptionRegistryService::class)->autoResolve($exception, 'The condition cleared.');

        Event::assertDispatched(OperationalExceptionResolved::class, function (OperationalExceptionResolved $e) {
            return $e->status === 'auto_resolved';
        });
    }

    // ═══ DISPATCH CONFLICT MILESTONES ════════════════════════════════════════

    public function test_detecting_a_conflict_dispatches_the_detected_event(): void
    {
        $vehicle = $this->makeVehicle();

        // A is holding the vehicle; B tries to take the same one → double-booking.
        $this->makeAllocation($vehicle->id, AllocationStatus::Confirmed);
        $b = $this->makeAllocation($vehicle->id, AllocationStatus::Proposed);

        Event::fake([DispatchConflictDetected::class]);

        app(ConflictDetectionService::class)->detectFor($b);

        Event::assertDispatched(DispatchConflictDetected::class, function (DispatchConflictDetected $e) {
            return $e->conflictType === ConflictType::VehicleDoubleBooked->value
                && $e->severity === 'blocking'
                && $e->authority === 'dispatch';
        });
    }

    public function test_resolving_a_conflict_dispatches_the_resolved_event(): void
    {
        $conflict = DispatchConflict::create([
            'company_id' => $this->company->id,
            // ResourceLocked is dispatch-owned, so resolve is permitted.
            'conflict_type' => ConflictType::ResourceLocked->value,
            'description' => 'Held by another session.',
        ]);

        Event::fake([DispatchConflictResolved::class]);

        app(ConflictResolutionService::class)->resolve(
            $conflict,
            DispatchConflict::RESOLUTION_CONDITION_CLEARED,
        );

        Event::assertDispatchedTimes(DispatchConflictResolved::class, 1);
        Event::assertDispatched(DispatchConflictResolved::class, function (DispatchConflictResolved $e) use ($conflict) {
            return $e->conflictUuid === $conflict->uuid
                && $e->authority === 'dispatch'
                && $e->resolution === DispatchConflict::RESOLUTION_CONDITION_CLEARED;
        });
    }

    // ═══ IMMUTABILITY & PURITY ═══════════════════════════════════════════════

    /** Every event property is readonly — the payload cannot be mutated. */
    public function test_every_event_is_immutable(): void
    {
        $events = [
            ReadinessValidated::class,
            LogisticsHealthCalculated::class,
            DiagnosticsGenerated::class,
            ExecutiveSummaryGenerated::class,
            OperationalExceptionRaised::class,
            OperationalExceptionResolved::class,
            DispatchConflictDetected::class,
            DispatchConflictResolved::class,
        ];

        foreach ($events as $event) {
            $reflection = new ReflectionClass($event);
            $properties = $reflection->getProperties();

            $this->assertNotEmpty($properties, "{$event} should carry a payload.");

            foreach ($properties as $property) {
                $this->assertTrue(
                    $property->isReadOnly(),
                    "{$event}::\${$property->getName()} must be readonly."
                );
            }
        }
    }

    /** Events carry no service, no model, no closure — immutable scalars only. */
    public function test_events_carry_only_immutable_context(): void
    {
        foreach ([
            ReadinessValidated::class,
            LogisticsHealthCalculated::class,
            DiagnosticsGenerated::class,
            ExecutiveSummaryGenerated::class,
            OperationalExceptionRaised::class,
            OperationalExceptionResolved::class,
            DispatchConflictDetected::class,
            DispatchConflictResolved::class,
        ] as $event) {
            $reflection = new ReflectionClass($event);

            foreach ($reflection->getConstructor()->getParameters() as $param) {
                $type = $param->getType();
                $this->assertNotNull($type, "{$event}::\${$param->getName()} must be typed.");

                $name = (string) $type;
                // Only scalars (optionally nullable) — never a model or service.
                $this->assertMatchesRegularExpression(
                    '/^\??(string|int|bool|float)$/',
                    $name,
                    "{$event}::\${$param->getName()} must be a scalar, got {$name}."
                );
            }
        }
    }

    // ═══ NO BEHAVIOURAL CHANGE ═══════════════════════════════════════════════

    /**
     * The endpoints return exactly what they did before events existed — the
     * dispatch is a pure notification and changes no response.
     */
    public function test_dispatching_events_does_not_change_responses(): void
    {
        // No Event::fake here — events dispatch for real (no listener does work).
        $this->auth()->getJson(self::OPS.'/readiness/validate')
            ->assertOk()
            ->assertJsonPath('data.overall_status', 'not_ready');

        $this->auth()->getJson(self::OPS.'/readiness/health-score')
            ->assertOk()
            ->assertJsonStructure(['data' => ['score', 'grade', 'weights']]);

        $this->auth()->getJson(self::OPS.'/diagnostics')
            ->assertOk()
            ->assertJsonStructure(['data' => ['system', 'dependencies', 'queue']]);
    }

    /** A listener CAN consume an event — proving observability works. */
    public function test_an_event_can_be_consumed_by_a_listener(): void
    {
        $captured = [];
        Event::listen(OperationalExceptionRaised::class, function (OperationalExceptionRaised $e) use (&$captured) {
            $captured[] = $e->exceptionUuid;
        });

        $exception = $this->recordException('listen:'.$this->suffix());

        $this->assertContains($exception->uuid, $captured);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function recordException(string $dedupKey): OperationalException
    {
        return app(ExceptionRegistryService::class)->record(
            source: ExceptionSource::Operations,
            category: ExceptionCategory::Resource,
            exceptionType: 'pool_below_strength',
            severity: ExceptionSeverity::Warning,
            title: 'Pool below strength',
            dedupKey: $dedupKey,
            companyId: $this->company->id,
        );
    }

    private function makeVehicle(): Vehicle
    {
        $s = $this->suffix();

        return Vehicle::create([
            'vehicle_code' => 'VEH-'.$s,
            'plate_number' => 'PL-'.$s,
            'type' => 'van',
            'capacity_orders' => 60,
            'company_id' => $this->company->id,
        ]);
    }

    private function makeAllocation(int $vehicleId, AllocationStatus $status): ResourceAllocation
    {
        return ResourceAllocation::create([
            'company_id' => $this->company->id,
            'trip_id' => null,
            'vehicle_id' => $vehicleId,
            'driver_id' => null,
            'status' => $status->value,
            'allocation_mode' => ResourceAllocation::MODE_MANUAL,
            'allocated_at' => now(),
            'uuid' => (string) Str::uuid(),
        ]);
    }
}
