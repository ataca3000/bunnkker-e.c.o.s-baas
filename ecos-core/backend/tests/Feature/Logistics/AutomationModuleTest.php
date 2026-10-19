<?php

declare(strict_types=1);

namespace Tests\Feature\Logistics;

use App\Models\User;
use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Modules\IAM\Domain\Models\Role;
use Modules\Logistics\Automation\Domain\Enums\AutomationActionType;
use Modules\Logistics\Automation\Domain\Policies\AutomationPolicyRegistry;
use Modules\Logistics\Automation\Domain\Services\AutomationEngine;
use Modules\Logistics\Automation\Domain\Services\RuleEngine;
use Modules\Logistics\Automation\Domain\ValueObjects\AutomationEvent;
use Modules\Logistics\Automation\Infrastructure\Providers\LogisticsAutomationServiceProvider;
use Modules\Logistics\Operations\Domain\Events\OperationalExceptionRaised;
use Modules\Logistics\Operations\Domain\Events\ReadinessValidated;
use Modules\Organization\Companies\Domain\Models\Company;
use ReflectionClass;
use Tests\TestCase;

/**
 * EPIC-LOG-V2-002 / TASK-LOG-V2-002-002 — Enterprise Automation Platform.
 *
 * The automation layer CONSUMES the eight domain events and turns them into
 * logs and notifications. These tests hold its contract:
 *
 *   • Every event has a registered consumer
 *   • Policies produce the right notifications for the right severities
 *   • Consumers execute NO business logic — notification and logging only
 *   • The engine is exception-safe — a consumer never breaks the operation
 *   • Additive, schema-free, read-only observability endpoints
 */
class AutomationModuleTest extends TestCase
{
    use DatabaseTransactions;

    private const AUTO = '/api/logistics/automation';

    private User $user;

    private Company $company;

    protected function setUp(): void
    {
        parent::setUp();

        $this->company = Company::factory()->create();
        $this->user = User::factory()->create(['company_id' => $this->company->id]);

        $role = Role::create([
            'name' => 'Automation Test Admin',
            'slug' => 'auto-admin-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => true,
        ]);
        $this->user->roles()->attach($role->id);
    }

    private function auth(): static
    {
        return $this->actingAs($this->user);
    }

    // ═══ EVENT CONSUMERS ═════════════════════════════════════════════════════

    public function test_every_domain_event_has_a_registered_consumer(): void
    {
        foreach (array_keys(LogisticsAutomationServiceProvider::LISTENERS) as $event) {
            $this->assertTrue(
                Event::hasListeners($event),
                "{$event} must have a registered automation consumer."
            );
        }

        // All eight named events are covered.
        $this->assertCount(8, LogisticsAutomationServiceProvider::LISTENERS);
    }

    /** Dispatching an event queues its consumer — background processing wiring. */
    public function test_dispatching_an_event_queues_its_consumer(): void
    {
        \Illuminate\Support\Facades\Queue::fake();

        ReadinessValidated::dispatch('not_ready', 1, 1, 3, (string) $this->company->id, now()->toIso8601String());

        // The ShouldQueue consumer is pushed as a queued listener job.
        \Illuminate\Support\Facades\Queue::assertPushed(\Illuminate\Events\CallQueuedListener::class);
    }

    /** The consumer logs the event it handles — observability. */
    public function test_a_consumer_logs_the_event_it_handles(): void
    {
        Log::spy();

        app(\Modules\Logistics\Automation\Application\Listeners\ReadinessValidatedListener::class)
            ->handle(new ReadinessValidated('not_ready', 1, 1, 3, (string) $this->company->id, now()->toIso8601String()));

        Log::shouldHaveReceived('info')
            ->withArgs(fn (string $message) => str_contains($message, 'logistics.automation.event'))
            ->atLeast()->once();
    }

    // ═══ RULE ENGINE & POLICIES ══════════════════════════════════════════════

    public function test_a_critical_event_produces_an_alert(): void
    {
        $engine = app(RuleEngine::class);

        $event = new AutomationEvent(
            name: OperationalExceptionRaised::class,
            severity: 'critical',
            status: null,
            companyId: (string) $this->company->id,
            occurredAt: now()->toIso8601String(),
        );

        $actions = $engine->evaluate($event);

        $this->assertNotEmpty($actions);
        $types = array_map(static fn ($a) => $a->type, $actions);
        $this->assertContains(AutomationActionType::Alert, $types);
    }

    public function test_a_low_severity_event_does_not_alert(): void
    {
        $engine = app(RuleEngine::class);

        // An info-level readiness event is logged, never alerted.
        $event = new AutomationEvent(
            name: ReadinessValidated::class,
            severity: 'info',
            status: 'ready',
            companyId: null,
            occurredAt: now()->toIso8601String(),
        );

        $actions = $engine->evaluate($event);
        $types = array_map(static fn ($a) => $a->type, $actions);

        $this->assertNotContains(AutomationActionType::Alert, $types);
        $this->assertContains(AutomationActionType::Log, $types);
    }

    public function test_the_engine_logs_and_returns_a_manifest(): void
    {
        $engine = app(AutomationEngine::class);

        $manifest = $engine->handle(new AutomationEvent(
            name: OperationalExceptionRaised::class,
            severity: 'critical',
            status: null,
            companyId: null,
            occurredAt: now()->toIso8601String(),
        ));

        $this->assertTrue($manifest['logged']);
        $this->assertArrayHasKey('actions', $manifest);
        $this->assertGreaterThanOrEqual(1, $manifest['action_count']);
    }

    /** The engine never throws — a notification failure cannot break the caller. */
    public function test_the_engine_is_exception_safe(): void
    {
        // Force the notification pipeline to blow up mid-handle.
        Log::shouldReceive('info')->andThrow(new \RuntimeException('log down'));
        Log::shouldReceive('warning')->andReturnNull();
        Log::shouldReceive('log')->andReturnNull();

        $engine = app(AutomationEngine::class);

        // Must not throw despite the failure.
        $manifest = $engine->handle(new AutomationEvent(
            name: ReadinessValidated::class,
            severity: 'critical',
            status: 'not_ready',
            companyId: null,
            occurredAt: now()->toIso8601String(),
        ));

        $this->assertFalse($manifest['logged']);
        $this->assertArrayHasKey('error', $manifest);
    }

    public function test_policies_cover_every_consumed_event(): void
    {
        $registry = app(AutomationPolicyRegistry::class);

        foreach (array_keys(LogisticsAutomationServiceProvider::LISTENERS) as $event) {
            $this->assertNotEmpty(
                $registry->forEvent($event),
                "{$event} must have at least one automation policy."
            );
        }
    }

    // ═══ NO BUSINESS LOGIC IN CONSUMERS ══════════════════════════════════════

    /**
     * The core rule: a listener never executes a business rule. It may not call
     * any operational service that changes state.
     */
    public function test_no_consumer_calls_an_operational_service(): void
    {
        $forbidden = [
            'ConflictResolutionService',
            'ExceptionResolutionService',
            'ExceptionEscalationService',
            'ResourceAllocationService',
            'CapacityReservationService',
            'CapacityLedgerService',
            'DispatchReleaseService',
            'ResourcePoolManagementService',
        ];

        $dir = base_path('Modules/Logistics/Automation');
        $files = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));
        foreach ($it as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        $this->assertNotEmpty($files);

        foreach ($files as $file) {
            // Strip comments — a docblock may legitimately NAME a service to say
            // it is deliberately not called.
            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents($file));

            foreach ($forbidden as $service) {
                $this->assertStringNotContainsString(
                    $service,
                    (string) $source,
                    basename($file).' must not reference the operational service '.$service.'.'
                );
            }
        }
    }

    /** Consumers write nothing — no persistence calls anywhere in the module. */
    public function test_the_automation_module_writes_nothing(): void
    {
        $dir = base_path('Modules/Logistics/Automation');
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if (! $file->isFile() || $file->getExtension() !== 'php') {
                continue;
            }

            $source = preg_replace('#/\*.*?\*/|//[^\n]*#s', '', (string) file_get_contents($file->getPathname()));

            foreach (['->save(', '->update(', '->delete(', '->insert(', '::create('] as $write) {
                $this->assertStringNotContainsString(
                    $write,
                    (string) $source,
                    basename($file->getPathname()).' must write nothing; found '.$write.'.'
                );
            }
        }
    }

    /** Consumers implement ShouldQueue with a retry policy (background processing). */
    public function test_consumers_are_queued_with_a_retry_policy(): void
    {
        foreach (LogisticsAutomationServiceProvider::LISTENERS as $listener) {
            $reflection = new ReflectionClass($listener);

            $this->assertTrue(
                $reflection->implementsInterface(\Illuminate\Contracts\Queue\ShouldQueue::class),
                "{$listener} must be queued (ShouldQueue)."
            );

            $instance = app($listener);
            $this->assertSame(3, $instance->tries);
            $this->assertSame([10, 30, 60], $instance->backoff());
        }
    }

    // ═══ OBSERVABILITY ENDPOINTS ═════════════════════════════════════════════

    public function test_policies_endpoint_lists_the_declared_policies(): void
    {
        $policies = $this->auth()->getJson(self::AUTO.'/policies')
            ->assertOk()
            ->json('data');

        $this->assertNotEmpty($policies);
        foreach ($policies as $policy) {
            $this->assertArrayHasKey('event', $policy);
            $this->assertArrayHasKey('action', $policy);
        }
    }

    public function test_monitoring_reports_consumers_and_queue_config(): void
    {
        $this->auth()->getJson(self::AUTO.'/monitoring')
            ->assertOk()
            ->assertJsonPath('data.consumer_count', 8)
            ->assertJsonPath('data.events_consumed', 8)
            ->assertJsonStructure(['data' => ['consumers', 'policy_count', 'queue' => ['connection', 'retry']]]);
    }

    public function test_metrics_reads_existing_operational_signals(): void
    {
        $this->auth()->getJson(self::AUTO.'/metrics')
            ->assertOk()
            ->assertJsonStructure(['data' => ['exceptions', 'conflicts', 'alerts']]);
    }

    // ═══ ADDITIVITY & ACCESS ═════════════════════════════════════════════════

    public function test_automation_adds_no_tables(): void
    {
        foreach (['automation_events', 'automation_policies', 'automation_notifications', 'logistics_automation'] as $table) {
            $this->assertFalse(
                Schema::hasTable($table),
                "Automation must add no tables; {$table} should not exist."
            );
        }
    }

    public function test_events_still_have_no_impact_on_responses(): void
    {
        // With consumers registered and running inline, the operational
        // endpoints must return exactly what they did before.
        $this->auth()->getJson('/api/logistics/operations/readiness/validate')
            ->assertOk()
            ->assertJsonPath('data.overall_status', 'not_ready');

        $this->auth()->getJson('/api/logistics/operations/diagnostics')->assertOk();
    }

    public function test_phase_0_to_6_and_intelligence_routes_still_answer(): void
    {
        $this->auth()->getJson('/api/logistics/dispatch/options')->assertOk();
        $this->auth()->getJson('/api/logistics/operations/health/overview')->assertOk();
        $this->auth()->getJson('/api/logistics/intelligence/decisions')->assertOk();
    }

    public function test_endpoints_require_authentication(): void
    {
        foreach (['/policies', '/monitoring', '/metrics'] as $path) {
            $this->getJson(self::AUTO.$path)->assertUnauthorized();
        }
    }

    public function test_a_user_without_the_permission_is_refused(): void
    {
        $stranger = User::factory()->create(['company_id' => $this->company->id]);
        $role = Role::create([
            'name' => 'Automation Nobody',
            'slug' => 'auto-nobody-'.substr(md5(uniqid('', true)), 0, 8),
            'is_system' => false,
        ]);
        $stranger->roles()->attach($role->id);

        $this->actingAs($stranger)->getJson(self::AUTO.'/monitoring')->assertForbidden();
    }
}
