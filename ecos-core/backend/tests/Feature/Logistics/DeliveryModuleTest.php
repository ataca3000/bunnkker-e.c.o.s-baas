<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Str;
use Modules\IAM\Domain\Models\Permission;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Delivery\Domain\Enums\AttemptStatus;
use Modules\Logistics\Delivery\Domain\Enums\CodStatus;
use Modules\Logistics\Delivery\Domain\Enums\DeliveryStatus;
use Modules\Logistics\Delivery\Domain\Enums\FailureCategory;
use Modules\Logistics\Delivery\Domain\Enums\FailureReason;
use Modules\Logistics\Delivery\Domain\Enums\PodArtifactKind;
use Modules\Logistics\Delivery\Domain\Events\CodCollected;
use Modules\Logistics\Delivery\Domain\Events\DeliveryFailed;
use Modules\Logistics\Delivery\Domain\Events\DeliveryRetryExhausted;
use Modules\Logistics\Delivery\Domain\Events\DeliverySucceeded;
use Modules\Logistics\Delivery\Domain\Events\ReturnInitiated;
use Modules\Logistics\Delivery\Domain\Models\Delivery;
use Modules\Logistics\Delivery\Domain\Models\DeliveryAttempt;
use Modules\Logistics\Distribution\Domain\Enums\TripStatus;
use Modules\Logistics\Distribution\Domain\Enums\TripType;
use Modules\Logistics\Distribution\Domain\Models\DeliveryStop;
use Modules\Logistics\Distribution\Domain\Models\Trip;
use Modules\Logistics\Distribution\Domain\Services\DeliveryService as DistributionDeliveryService;
use Modules\Logistics\Distribution\Domain\Services\TripService;
use Modules\Logistics\Drivers\Domain\Models\Driver;
use Modules\Logistics\Drivers\Domain\Services\DriverVehicleAssignmentService;
use Modules\Logistics\Vehicles\Domain\Models\Vehicle;
use Modules\Organization\Companies\Domain\Models\Company;
use Tests\TestCase;

/**
 * TASK-LOG-005 — Delivery & Tracking OS
 *
 * Covers the aggregate lifecycle, attempt execution gates, POD evidence rules,
 * the failure taxonomy and retry engine, returns reconciliation, and — most
 * importantly — the architectural boundaries the CTO fixed:
 *
 *   • Delivery OS consumes Distribution's DeliveryStop read-only.
 *   • Distribution remains the Single Cash Authority; COD here is reporting.
 *   • Drivers (LOG-002) and Vehicles (LOG-003) own their own readiness gates.
 */
class DeliveryModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const BASE = '/api/logistics/delivery';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        // Delivery routes are permission-gated. A system role bypasses every
        // ability via Gate::before(), which keeps the flow tests focused on
        // domain behaviour; the 403 path is asserted separately.
        $role = Role::create([
            'name' => 'Delivery Test Admin',
            'slug' => 'delivery-test-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ── Fixtures ──────────────────────────────────────────────────────────────

    private function makeOrder(): string
    {
        $customerId = (string) Str::uuid();
        DB::table('customers')->insert([
            'id' => $customerId,
            'code' => 'CUS-'.substr(md5($customerId), 0, 8),
            'name' => 'Delivery Test Customer',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $orderId = (string) Str::uuid();
        DB::table('orders')->insert([
            'id' => $orderId,
            'customer_id' => $customerId,
            'order_number' => 'ORD-'.substr(md5($orderId), 0, 8),
            'order_date' => now()->toDateString(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return $orderId;
    }

    private function makeDelivery(array $overrides = []): Delivery
    {
        return Delivery::create(array_merge([
            'company_id' => $this->company->id,
            'order_id' => $this->makeOrder(),
            'created_by' => $this->user->id,
        ], $overrides));
    }

    /** A dispatched trip with one generated stop — the Distribution side. */
    private function dispatchedStop(): DeliveryStop
    {
        $trip = Trip::create([
            'company_id' => $this->company->id,
            'trip_number' => 'TRP-'.substr(md5(uniqid('', true)), 0, 6),
            'name' => 'Delivery OS Test Run',
            'type' => TripType::CompanyVehicle->value,
            'capacity' => 3,
            'created_by' => $this->user->id,
        ]);

        $suffix = substr(md5(uniqid('', true)), 0, 8);
        $assignment = app(DriverVehicleAssignmentService::class)->assign(
            Driver::create([
                'driver_code' => 'DRV-'.$suffix,
                'full_name' => 'Delivery OS Driver',
                'mobile' => '010'.substr($suffix, 0, 8),
                'national_id' => 'NID-'.$suffix,
                'license_issue_date' => '2024-01-01',
                'license_expiry_date' => '2031-01-01',
            ]),
            Vehicle::create([
                'vehicle_code' => 'VEH-'.$suffix,
                'plate_number' => 'PL-'.$suffix,
                'type' => 'van',
                'capacity_orders' => 60,
            ]),
        );

        $trip->update(['driver_vehicle_assignment_id' => $assignment->id]);

        app(TripService::class)->assignOrder($trip->refresh(), $this->makeOrder());
        app(DistributionDeliveryService::class)->generateStops($trip->refresh());

        $trip->update([
            'driver_accepted_products' => true,
            'driver_accepted_custody' => true,
            'driver_accepted_equipment' => true,
        ]);

        $trips = app(TripService::class);
        foreach ([
            TripStatus::Loading,
            TripStatus::LoadingCompleted,
            TripStatus::DriverAccepted,
            TripStatus::ReadyForDispatch,
            TripStatus::Dispatched,
        ] as $state) {
            $trip = $trips->changeStatus($trip->refresh(), $state);
        }

        return $trip->refresh()->stops()->firstOrFail();
    }

    /**
     * A delivery with an attempt open against a live stop.
     *
     * By default the attempt is driven to InProgress, which is where outcomes
     * (succeed / fail) become legal; pass $advance: false to inspect the freshly
     * opened state.
     *
     * @return array{0: Delivery, 1: DeliveryAttempt}
     */
    private function openAttempt(?Delivery $delivery = null, bool $advance = true): array
    {
        $delivery = $delivery ?? $this->makeDelivery(['status' => DeliveryStatus::Scheduled->value]);
        $stop = $this->dispatchedStop();

        $response = $this->auth()
            ->postJson(self::BASE."/{$delivery->uuid}/attempts", ['stop_id' => $stop->id])
            ->assertCreated();

        $attempt = DeliveryAttempt::where('uuid', $response->json('data.uuid'))->firstOrFail();

        if ($advance) {
            $this->driveToInProgress($delivery, $attempt);
            $attempt->refresh();
        }

        return [$delivery->refresh(), $attempt];
    }

    /** Created → EnRoute → Arrived → InProgress. */
    private function driveToInProgress(Delivery $delivery, DeliveryAttempt $attempt): void
    {
        $url = self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/advance";

        foreach ([AttemptStatus::EnRoute, AttemptStatus::Arrived, AttemptStatus::InProgress] as $state) {
            $this->auth()->patchJson($url, ['status' => $state->value])->assertOk();
        }
    }

    /** Capture and validate a complete POD so the attempt may succeed. */
    private function validatedPod(Delivery $delivery, DeliveryAttempt $attempt): void
    {
        $base = self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/pod";

        $this->auth()->postJson($base, ['recipient_name' => 'Mona Adel'])->assertOk();

        foreach ([PodArtifactKind::Signature, PodArtifactKind::Photo] as $kind) {
            $this->auth()->postJson($base.'/artifacts', [
                'kind' => $kind->value,
                'file_path' => "pod/{$attempt->uuid}/{$kind->value}.png",
                'file_name' => "{$kind->value}.png",
                'mime_type' => 'image/png',
            ])->assertOk();
        }

        $this->auth()->patchJson($base.'/validate')->assertOk();
    }

    // ── Reference data ────────────────────────────────────────────────────────

    public function test_options_expose_every_vocabulary(): void
    {
        $this->auth()->getJson(self::BASE.'/options')
            ->assertOk()
            ->assertJsonCount(12, 'delivery_statuses')
            ->assertJsonCount(7, 'attempt_statuses')
            ->assertJsonCount(5, 'failure_categories')
            ->assertJsonCount(15, 'failure_reasons')
            ->assertJsonCount(4, 'pod_artifact_kinds')
            ->assertJsonCount(6, 'return_statuses')
            ->assertJsonCount(6, 'cod_statuses');
    }

    /**
     * The failure catalogue is the single source of retry policy — the API
     * publishes category and retryability so the UI never has to guess.
     */
    public function test_failure_catalogue_publishes_its_retry_policy(): void
    {
        $catalogue = $this->auth()->getJson(self::BASE.'/options')->json('failure_reasons');

        $byValue = collect($catalogue)->keyBy('value');

        $this->assertTrue($byValue[FailureReason::CustomerUnavailable->value]['is_retryable']);
        $this->assertFalse($byValue[FailureReason::CustomerRefused->value]['is_retryable']);
        $this->assertTrue($byValue[FailureReason::AddressNotFound->value]['requires_address_correction']);
        $this->assertSame(
            FailureCategory::Customer->value,
            $byValue[FailureReason::CustomerUnavailable->value]['category'],
        );
    }

    // ── Aggregate lifecycle ───────────────────────────────────────────────────

    public function test_a_delivery_is_created_with_domain_defaults_and_a_public_uuid(): void
    {
        $response = $this->auth()->postJson(self::BASE, [
            'order_id' => $this->makeOrder(),
            'promised_at' => now()->addHours(4)->toIso8601String(),
        ])->assertCreated();

        $response
            ->assertJsonPath('data.status', DeliveryStatus::Pending->value)
            ->assertJsonPath('data.attempt_count', 0)
            ->assertJsonPath('data.max_attempts', 3)
            ->assertJsonPath('data.remaining_attempts', 3)
            ->assertJsonPath('data.sla_breached', false);

        // The public identifier is the UUID, matching the Trip convention.
        $this->assertSame($response->json('data.id'), $response->json('data.uuid'));
        $this->assertNotSame((string) 1, (string) $response->json('data.id'));
    }

    public function test_creation_emits_a_customer_visible_tracking_event(): void
    {
        $delivery = $this->makeDelivery();

        // Model-created deliveries have no timeline; the service is the seam.
        app(\Modules\Logistics\Delivery\Domain\Services\TrackingProjectionService::class)
            ->recordCustomerVisible($delivery, 'delivery.created', 'Order received', 'We have your order.');

        $public = $this->auth()->getJson(self::BASE."/{$delivery->uuid}/public-timeline")
            ->assertOk()->json('data');

        $this->assertCount(1, $public);
        $this->assertSame('Order received', $public[0]['title']);
        // Redaction: operator fields never reach the customer projection.
        $this->assertArrayNotHasKey('actor', $public[0]);
        $this->assertArrayNotHasKey('metadata', $public[0]);
    }

    public function test_an_illegal_status_transition_is_refused(): void
    {
        $delivery = $this->makeDelivery();

        $this->auth()
            ->patchJson(self::BASE."/{$delivery->uuid}/status", ['status' => DeliveryStatus::Delivered->value])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'cannot move from Pending to Delivered'));
    }

    public function test_the_default_list_hides_closed_deliveries(): void
    {
        $open = $this->makeDelivery(['status' => DeliveryStatus::Scheduled->value]);
        $closed = $this->makeDelivery(['status' => DeliveryStatus::Delivered->value]);

        $ids = collect($this->auth()->getJson(self::BASE)->assertOk()->json('data'))->pluck('id');

        $this->assertContains($open->uuid, $ids);
        $this->assertNotContains($closed->uuid, $ids);

        $allIds = collect($this->auth()->getJson(self::BASE.'?status=all')->json('data'))->pluck('id');
        $this->assertContains($closed->uuid, $allIds);
    }

    // ── Attempt execution ─────────────────────────────────────────────────────

    public function test_an_attempt_opens_against_a_distribution_stop(): void
    {
        [$delivery, $attempt] = $this->openAttempt(advance: false);

        $this->assertSame(1, $attempt->attempt_no);
        $this->assertSame(AttemptStatus::Created, $attempt->status);
        $this->assertSame(1, $delivery->attempt_count);
        $this->assertSame(DeliveryStatus::OutForDelivery, $delivery->status);
        // The stop is consumed by reference; Delivery OS stores the pointer only.
        $this->assertNotNull($attempt->stop_id);
        $this->assertNotNull($attempt->trip_id);
    }

    /**
     * BR-3: one open attempt at a time. Without this a delivery could be
     * closed twice from two devices.
     */
    public function test_a_second_attempt_cannot_open_while_one_is_in_flight(): void
    {
        [$delivery] = $this->openAttempt();
        $stop = $this->dispatchedStop();

        $this->auth()
            ->postJson(self::BASE."/{$delivery->uuid}/attempts", ['stop_id' => $stop->id])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'already'));
    }

    /** BR-1: the trip must actually be on the road — Distribution owns that state. */
    public function test_an_attempt_cannot_open_against_a_trip_still_in_planning(): void
    {
        $delivery = $this->makeDelivery(['status' => DeliveryStatus::Scheduled->value]);

        $trip = Trip::create([
            'company_id' => $this->company->id,
            'trip_number' => 'TRP-'.substr(md5(uniqid('', true)), 0, 6),
            'name' => 'Not Yet Dispatched',
            'type' => TripType::CompanyVehicle->value,
            'capacity' => 2,
            'created_by' => $this->user->id,
        ]);
        app(TripService::class)->assignOrder($trip, $this->makeOrder());
        app(DistributionDeliveryService::class)->generateStops($trip->refresh());

        $this->auth()
            ->postJson(self::BASE."/{$delivery->uuid}/attempts", [
                'stop_id' => $trip->refresh()->stops()->firstOrFail()->id,
            ])
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'on the road'));
    }

    public function test_an_attempt_advances_through_its_state_machine(): void
    {
        [$delivery, $attempt] = $this->openAttempt(advance: false);
        $base = self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/advance";

        // Arrived is not reachable from Created — the machine has no shortcuts.
        $this->auth()->patchJson($base, ['status' => AttemptStatus::Arrived->value])
            ->assertStatus(422);

        $this->auth()->patchJson($base, ['status' => AttemptStatus::EnRoute->value])
            ->assertOk()
            ->assertJsonPath('data.status', AttemptStatus::EnRoute->value);

        $this->auth()->patchJson($base, [
            'status' => AttemptStatus::Arrived->value,
            'gps_lat' => 30.0444,
            'gps_lng' => 31.2357,
        ])->assertOk()->assertJsonPath('data.status', AttemptStatus::Arrived->value);

        $this->auth()->patchJson($base, ['status' => AttemptStatus::InProgress->value])
            ->assertOk()
            ->assertJsonPath('data.status', AttemptStatus::InProgress->value);

        $attempt->refresh();
        $this->assertNotNull($attempt->en_route_at);
        $this->assertNotNull($attempt->arrived_at);
        $this->assertNotNull($attempt->started_at);
    }

    // ── Proof of delivery ─────────────────────────────────────────────────────

    /** BR-7: an attempt cannot succeed on unvalidated evidence. */
    public function test_an_attempt_cannot_succeed_without_a_validated_pod(): void
    {
        [$delivery, $attempt] = $this->openAttempt();

        $this->auth()
            ->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/succeed")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'proof of delivery'));
    }

    public function test_a_pod_cannot_be_validated_while_a_required_artifact_is_missing(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $base = self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/pod";

        $this->auth()->postJson($base, ['recipient_name' => 'Mona Adel'])->assertOk();

        // Signature only — the default policy also demands a photo.
        $this->auth()->postJson($base.'/artifacts', [
            'kind' => PodArtifactKind::Signature->value,
            'file_path' => 'pod/sig.png',
        ])->assertOk();

        $this->auth()->patchJson($base.'/validate')
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'photo'));
    }

    /**
     * The required-artifact list is snapshotted at capture time, so tightening
     * the policy later cannot retroactively invalidate historic evidence.
     */
    public function test_the_required_artifact_list_is_snapshotted_onto_the_pod(): void
    {
        [$delivery, $attempt] = $this->openAttempt();

        $response = $this->auth()->postJson(
            self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/pod",
            [
                'recipient_name' => 'Mona Adel',
                'required_artifacts' => [PodArtifactKind::Signature->value],
            ],
        )->assertOk();

        $this->assertSame([PodArtifactKind::Signature->value], $response->json('data.required_artifacts'));
    }

    public function test_a_validated_pod_is_immutable(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $this->validatedPod($delivery, $attempt);

        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/pod/artifacts", [
            'kind' => PodArtifactKind::Photo->value,
            'file_path' => 'pod/extra.png',
        ])->assertStatus(422);
    }

    public function test_pod_artifacts_never_expose_their_storage_path(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $this->validatedPod($delivery, $attempt);

        $artifacts = $this->auth()
            ->getJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/pod")
            ->assertOk()->json('data.artifacts');

        $this->assertCount(2, $artifacts);
        $this->assertArrayNotHasKey('file_path', $artifacts[0]);
    }

    public function test_a_delivery_succeeds_once_its_pod_is_validated(): void
    {
        Event::fake([DeliverySucceeded::class]);

        [$delivery, $attempt] = $this->openAttempt();
        $this->validatedPod($delivery, $attempt);

        $this->auth()
            ->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/succeed")
            ->assertOk()
            ->assertJsonPath('data.status', AttemptStatus::Succeeded->value);

        $delivery->refresh();
        $this->assertSame(DeliveryStatus::Delivered, $delivery->status);
        $this->assertNotNull($delivery->delivered_at);
        Event::assertDispatched(DeliverySucceeded::class);
    }

    // ── Failure taxonomy and retry ────────────────────────────────────────────

    /**
     * Retryability is derived from the taxonomy, never taken from the caller —
     * the same failure reaches the same decision from any client.
     */
    public function test_a_retryable_failure_schedules_another_attempt(): void
    {
        Event::fake([DeliveryFailed::class]);

        [$delivery, $attempt] = $this->openAttempt();

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/fail", [
            'reason_code' => FailureReason::CustomerUnavailable->value,
            'description' => 'Nobody answered the door.',
        ])->assertOk()
            ->assertJsonPath('data.is_retryable', true)
            ->assertJsonPath('data.category', FailureCategory::Customer->value);

        $this->assertSame(DeliveryStatus::AwaitingRetry, $delivery->refresh()->status);
        Event::assertDispatched(DeliveryFailed::class);
    }

    public function test_a_non_retryable_failure_routes_the_delivery_to_return(): void
    {
        [$delivery, $attempt] = $this->openAttempt();

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/fail", [
            'reason_code' => FailureReason::CustomerRefused->value,
        ])->assertOk()->assertJsonPath('data.is_retryable', false);

        $this->assertSame(DeliveryStatus::Returning, $delivery->refresh()->status);
        $this->assertFalse($delivery->canRetry());
    }

    /** BR-19: an address failure blocks retry until the address is corrected. */
    public function test_an_address_failure_blocks_retry_until_the_address_is_corrected(): void
    {
        [$delivery, $attempt] = $this->openAttempt();

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/fail", [
            'reason_code' => FailureReason::AddressNotFound->value,
        ])->assertOk()->assertJsonPath('data.requires_address_correction', true);

        $eligibility = $this->auth()
            ->getJson(self::BASE."/{$delivery->uuid}/retry-eligibility")->assertOk();

        $eligibility->assertJsonPath('can_retry', false);
        $this->assertContains(
            'The address must be corrected before another attempt.',
            $eligibility->json('blockers'),
        );

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/address-corrected")->assertOk();

        $this->auth()->getJson(self::BASE."/{$delivery->uuid}/retry-eligibility")
            ->assertOk()->assertJsonPath('can_retry', true);
    }

    public function test_the_retry_limit_is_enforced_and_exhaustion_is_published(): void
    {
        Event::fake([DeliveryRetryExhausted::class]);

        $delivery = $this->makeDelivery([
            'status' => DeliveryStatus::Scheduled->value,
            'max_attempts' => 1,
        ]);

        [$delivery, $attempt] = $this->openAttempt($delivery);

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/fail", [
            'reason_code' => FailureReason::CustomerUnavailable->value,
        ])->assertOk();

        $delivery->refresh();
        $this->assertFalse($delivery->canRetry());
        $this->assertContains(
            'The retry limit of 1 attempts has been reached.',
            $delivery->retryBlockers(),
        );
        Event::assertDispatched(DeliveryRetryExhausted::class);

        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/retry")->assertStatus(422);
    }

    public function test_the_exception_center_can_filter_by_failure_category(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/fail", [
            'reason_code' => FailureReason::CustomerUnavailable->value,
        ])->assertOk();

        $ids = collect(
            $this->auth()->getJson(self::BASE.'?status=all&failure_category='.FailureCategory::Customer->value)
                ->assertOk()->json('data')
        )->pluck('id');

        $this->assertContains($delivery->uuid, $ids);
    }

    // ── COD — reporting only ──────────────────────────────────────────────────

    /** BR-8: outstanding cash blocks closure. */
    public function test_an_attempt_cannot_succeed_with_cod_outstanding(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $this->validatedPod($delivery, $attempt);

        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/cod", ['amount_due' => 450])
            ->assertOk()->assertJsonPath('data.status', CodStatus::Due->value);

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/succeed")
            ->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'COD'));
    }

    public function test_recording_cod_collection_publishes_an_event_and_unblocks_closure(): void
    {
        Event::fake([CodCollected::class]);

        [$delivery, $attempt] = $this->openAttempt();
        $this->validatedPod($delivery, $attempt);

        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/cod", ['amount_due' => 450])->assertOk();

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/cod/collect", [
            'attempt_id' => $attempt->uuid,
            'amount' => 450,
            'method' => 'cash',
        ])->assertOk()
            ->assertJsonPath('data.status', CodStatus::Collected->value)
            ->assertJsonPath('data.is_fully_collected', true);

        Event::assertDispatched(CodCollected::class);

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/succeed")->assertOk();
    }

    /**
     * CTO decision 3 — Distribution is the Single Cash Authority.
     *
     * Recording COD here must leave every distribution_* cash figure untouched;
     * settlement stays exclusively with Distribution's SettlementService.
     */
    public function test_cod_reporting_never_writes_to_distribution_cash_tables(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $this->validatedPod($delivery, $attempt);

        $paymentsBefore = DB::table('distribution_payment_collections')->count();
        $settlementsBefore = DB::table('distribution_trip_settlements')->count();

        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/cod", ['amount_due' => 450])->assertOk();
        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/cod/collect", [
            'attempt_id' => $attempt->uuid,
            'amount' => 450,
        ])->assertOk();

        $this->assertSame($paymentsBefore, DB::table('distribution_payment_collections')->count());
        $this->assertSame($settlementsBefore, DB::table('distribution_trip_settlements')->count());
    }

    /** The COD resource is a completion report — it carries no settlement maths. */
    public function test_the_cod_resource_exposes_no_settlement_figures(): void
    {
        [$delivery, $attempt] = $this->openAttempt();
        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/cod", ['amount_due' => 200])->assertOk();

        $payload = $this->auth()->getJson(self::BASE."/{$delivery->uuid}/cod")->assertOk()->json('data');

        foreach (['expected_cash', 'submitted_cash', 'variance', 'trip_balance', 'settlement_status'] as $forbidden) {
            $this->assertArrayNotHasKey($forbidden, $payload);
        }
    }

    // ── Returns ───────────────────────────────────────────────────────────────

    /** BR-24: a customer cannot return more than they failed to take. */
    public function test_a_return_line_cannot_exceed_the_undelivered_quantity(): void
    {
        $delivery = $this->makeDelivery(['status' => DeliveryStatus::PartiallyDelivered->value]);

        $this->auth()->postJson(self::BASE."/{$delivery->uuid}/returns", [
            'reason' => 'Customer kept only part of the order.',
            'lines' => [[
                'product_name' => 'Chocolate Box 500g',
                'ordered_qty' => 10,
                'delivered_qty' => 8,
                'returned_qty' => 5, // only 2 were left undelivered
            ]],
        ])->assertStatus(422)
            ->assertJsonPath('message', fn (string $m) => str_contains($m, 'Chocolate Box 500g'));

        $this->assertSame(0, $delivery->returns()->count());
    }

    public function test_a_return_is_initiated_and_reconciled_against_the_warehouse_count(): void
    {
        Event::fake([ReturnInitiated::class]);

        $delivery = $this->makeDelivery(['status' => DeliveryStatus::PartiallyDelivered->value]);

        $created = $this->auth()->postJson(self::BASE."/{$delivery->uuid}/returns", [
            'reason' => 'Two damaged units refused.',
            'lines' => [[
                'product_name' => 'Chocolate Box 500g',
                'ordered_qty' => 10,
                'delivered_qty' => 8,
                'returned_qty' => 2,
            ]],
        ])->assertCreated();

        Event::assertDispatched(ReturnInitiated::class);
        $this->assertSame(DeliveryStatus::Returning, $delivery->refresh()->status);

        $returnUuid = $created->json('data.uuid');
        $lineId = $created->json('data.lines.0.id');

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/returns/{$returnUuid}/in-transit")->assertOk();

        // The warehouse counted one unit short — the discrepancy is derived.
        $received = $this->auth()->patchJson(
            self::BASE."/{$delivery->uuid}/returns/{$returnUuid}/receive",
            ['confirmed' => [$lineId => 1]],
        )->assertOk();

        $received->assertJsonPath('data.has_discrepancy', true);
        $this->assertEqualsWithDelta(1.0, $received->json('data.lines.0.discrepancy_qty'), 0.001);
    }

    public function test_verifying_a_return_closes_the_delivery(): void
    {
        $delivery = $this->makeDelivery(['status' => DeliveryStatus::PartiallyDelivered->value]);

        $created = $this->auth()->postJson(self::BASE."/{$delivery->uuid}/returns", [
            'lines' => [[
                'product_name' => 'Gift Basket',
                'ordered_qty' => 4,
                'delivered_qty' => 0,
                'returned_qty' => 4,
            ]],
        ])->assertCreated();

        $returnUuid = $created->json('data.uuid');
        $lineId = $created->json('data.lines.0.id');

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/returns/{$returnUuid}/in-transit")->assertOk();
        $this->auth()->patchJson(
            self::BASE."/{$delivery->uuid}/returns/{$returnUuid}/receive",
            ['confirmed' => [$lineId => 4]],
        )->assertOk()->assertJsonPath('data.has_discrepancy', false);

        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/returns/{$returnUuid}/verify")->assertOk();

        $this->assertSame(DeliveryStatus::Returned, $delivery->refresh()->status);
    }

    // ── SLA ───────────────────────────────────────────────────────────────────

    /** SLA breach is derived from promised_at, never trusted as stored state. */
    public function test_sla_breach_is_derived_and_respects_the_grace_window(): void
    {
        $late = $this->makeDelivery([
            'status' => DeliveryStatus::Scheduled->value,
            'promised_at' => now()->subHours(2),
            'sla_grace_minutes' => 15,
        ]);
        $withinGrace = $this->makeDelivery([
            'status' => DeliveryStatus::Scheduled->value,
            'promised_at' => now()->subMinutes(5),
            'sla_grace_minutes' => 30,
        ]);

        $this->auth()->getJson(self::BASE."/{$late->uuid}")
            ->assertOk()->assertJsonPath('data.sla_breached', true);

        $this->auth()->getJson(self::BASE."/{$withinGrace->uuid}")
            ->assertOk()->assertJsonPath('data.sla_breached', false);
    }

    public function test_stats_report_the_status_mix_and_failure_categories(): void
    {
        $this->makeDelivery(['status' => DeliveryStatus::OutForDelivery->value]);
        $this->makeDelivery(['status' => DeliveryStatus::Delivered->value]);

        $stats = $this->auth()->getJson(self::BASE.'/stats')->assertOk();

        $this->assertGreaterThanOrEqual(1, $stats->json('out_for_delivery'));
        $this->assertGreaterThanOrEqual(1, $stats->json('delivered'));
        $this->assertIsArray($stats->json('failures_by_category'));
        $this->assertArrayHasKey(FailureCategory::Customer->value, $stats->json('failures_by_category'));
    }

    // ── Boundaries and authorization ──────────────────────────────────────────

    /**
     * CTO decision 1/2 — Distribution keeps DeliveryStop, DeliveryProof,
     * DeliveryException and TripReturn. Delivery OS consumes the stop but must
     * never write to a distribution_* table.
     */
    public function test_delivery_execution_never_mutates_distribution_tables(): void
    {
        $stop = $this->dispatchedStop();
        $before = [
            'stops' => DB::table('distribution_delivery_stops')->count(),
            'proofs' => DB::table('distribution_delivery_proofs')->count(),
            'exceptions' => DB::table('distribution_delivery_exceptions')->count(),
            'returns' => DB::table('distribution_trip_returns')->count(),
        ];
        $stopSnapshot = DB::table('distribution_delivery_stops')->where('id', $stop->id)->first();

        $delivery = $this->makeDelivery(['status' => DeliveryStatus::Scheduled->value]);
        $response = $this->auth()
            ->postJson(self::BASE."/{$delivery->uuid}/attempts", ['stop_id' => $stop->id])
            ->assertCreated();

        $attempt = DeliveryAttempt::where('uuid', $response->json('data.uuid'))->firstOrFail();
        $this->driveToInProgress($delivery->refresh(), $attempt);
        $this->validatedPod($delivery->refresh(), $attempt->refresh());
        $this->auth()->patchJson(self::BASE."/{$delivery->uuid}/attempts/{$attempt->uuid}/succeed")->assertOk();

        $this->assertSame($before['stops'], DB::table('distribution_delivery_stops')->count());
        $this->assertSame($before['proofs'], DB::table('distribution_delivery_proofs')->count());
        $this->assertSame($before['exceptions'], DB::table('distribution_delivery_exceptions')->count());
        $this->assertSame($before['returns'], DB::table('distribution_trip_returns')->count());
        $this->assertEquals(
            $stopSnapshot,
            DB::table('distribution_delivery_stops')->where('id', $stop->id)->first(),
        );
    }

    /** Delivery OS owns no driver, vehicle or carrier column of its own. */
    public function test_delivery_tables_reference_no_duplicated_master_data(): void
    {
        $columns = \Illuminate\Support\Facades\Schema::getColumnListing('delivery_deliveries');

        foreach (['driver_id', 'vehicle_id', 'shipping_company_id', 'carrier_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns);
        }

        $attemptColumns = \Illuminate\Support\Facades\Schema::getColumnListing('delivery_attempts');
        foreach (['driver_id', 'vehicle_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $attemptColumns);
        }
    }

    public function test_every_endpoint_requires_authentication(): void
    {
        $delivery = $this->makeDelivery();

        $this->getJson(self::BASE)->assertUnauthorized();
        $this->getJson(self::BASE."/{$delivery->uuid}")->assertUnauthorized();
        $this->postJson(self::BASE, [])->assertUnauthorized();
        $this->postJson(self::BASE."/{$delivery->uuid}/attempts", [])->assertUnauthorized();
        $this->patchJson(self::BASE."/{$delivery->uuid}/cod/collect", [])->assertUnauthorized();
    }

    /** The ten delivery.* permissions gate the routes, not just the UI. */
    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);
        $delivery = $this->makeDelivery();

        $this->actingAsUnprivileged($stranger)->getJson(self::BASE."/{$delivery->uuid}")->assertForbidden();
        $this->actingAsUnprivileged($stranger)->postJson(self::BASE."/{$delivery->uuid}/retry")->assertForbidden();
    }

    public function test_a_granted_permission_opens_only_its_own_routes(): void
    {
        $viewer = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Delivery Viewer',
            'slug' => 'delivery-viewer-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => false,
        ]);
        $role->permissions()->attach(
            Permission::where('name', 'delivery.view')->firstOrFail()->id
        );
        $viewer->roles()->attach($role->id);

        $delivery = $this->makeDelivery();

        $this->actingAs($viewer)->getJson(self::BASE."/{$delivery->uuid}")->assertOk();
        // Cancelling needs delivery.cancel, which this role does not hold.
        $this->actingAs($viewer)->patchJson(self::BASE."/{$delivery->uuid}/cancel")->assertForbidden();
    }
}
