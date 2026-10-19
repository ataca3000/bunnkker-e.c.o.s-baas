<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H5 + H6 architecture guards.
 *
 * ┌─ THE PUBLIC SURFACE IS THE RISK · SO IT IS THE THING ASSERTED ──────────┐
 * │ H5 puts three endpoints on the open internet — the first in the whole      │
 * │ system. These guards check, against the real route table and the real       │
 * │ source, that the surface stays exactly three endpoints wide, that it can    │
 * │ create an applicant and nothing else, and that it is throttled.            │
 * │                                                                            │
 * │ H6 is guarded the other way: it must remain visualization only, owning no   │
 * │ table and writing nothing anywhere.                                        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class RecruitmentArchitectureGuardTest extends TestCase
{
    use DatabaseTransactions;

    private const FORBIDDEN_IMPORTS = [
        'use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Inventory',
        'use Modules\\Shipping', 'use Modules\\Logistics', 'use Modules\\POS',
        'use Modules\\Marketing', 'use Modules\\Manufacturing', 'use Modules\\Crm',
        'use Modules\\Sales', 'use Modules\\Purchasing', 'use Modules\\Operations',
    ];

    // ═══ THE PUBLIC SURFACE ══════════════════════════════════════════════════════

    /**
     * The public surface this module owns is exactly the careers portal.
     *
     * Scoped to HR deliberately: other modules have their own unauthenticated
     * routes that predate this epic (see the engineering report), and silently
     * asserting over them here would either fail for reasons HR cannot fix or
     * quietly bless them. What HR can guarantee is its own surface.
     */
    public function test_the_hr_public_surface_is_exactly_the_careers_portal(): void
    {
        $unauthenticated = collect(Route::getRoutes()->getRoutes())
            ->filter(function ($r) {
                $uri = (string) $r->uri();

                return str_starts_with($uri, 'api/hr') || str_starts_with($uri, 'api/careers');
            })
            ->filter(function ($r) {
                $middleware = $r->gatherMiddleware();

                return ! in_array('auth:sanctum', $middleware, true)
                    && ! in_array('auth', $middleware, true);
            })
            ->map(fn ($r) => implode('|', $r->methods()).' '.$r->uri())
            ->values();

        $expected = [
            'GET|HEAD api/careers/jobs',
            'GET|HEAD api/careers/jobs/{slug}',
            'POST api/careers/jobs/{slug}/apply',
        ];

        // If this fails, an HR endpoint was put on the open internet.
        $this->assertEqualsCanonicalizing(
            $expected,
            $unauthenticated->all(),
            'The only unauthenticated HR routes may be the three careers-portal endpoints.'
        );
    }

    public function test_no_authenticated_hr_route_lost_its_guard(): void
    {
        $unguarded = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with((string) $r->uri(), 'api/hr'))
            ->filter(fn ($r) => ! in_array('auth:sanctum', $r->gatherMiddleware(), true))
            ->map(fn ($r) => (string) $r->uri())
            ->values();

        $this->assertEmpty($unguarded->all(), 'Every api/hr route must sit behind authentication.');
    }

    public function test_every_public_route_is_rate_limited(): void
    {
        $careers = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with((string) $r->uri(), 'api/careers'));

        $this->assertCount(3, $careers);

        foreach ($careers as $route) {
            $throttles = array_filter(
                $route->gatherMiddleware(),
                fn ($m) => is_string($m) && str_starts_with($m, 'throttle:')
            );

            $this->assertNotEmpty($throttles, "Public route {$route->uri()} must be throttled.");
        }
    }

    public function test_the_public_write_endpoint_is_throttled_harder_than_the_reads(): void
    {
        $limits = [];

        foreach (Route::getRoutes()->getRoutes() as $route) {
            if (! str_starts_with((string) $route->uri(), 'api/careers')) {
                continue;
            }

            foreach ($route->gatherMiddleware() as $middleware) {
                if (is_string($middleware) && str_starts_with($middleware, 'throttle:')) {
                    $limits[implode('|', $route->methods())] = (int) explode(',', substr($middleware, 9))[0];
                }
            }
        }

        // Submitting costs storage and creates records; reading a jobs board does not.
        $this->assertLessThan(
            $limits['GET|HEAD'] ?? 0,
            $limits['POST'] ?? PHP_INT_MAX,
            'Applying must be throttled more tightly than browsing.'
        );
    }

    public function test_the_public_controller_writes_only_recruitment_records(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Presentation/Http/Controllers/PublicCareersController.php')
        );

        // It may create an applicant, an application and an attachment. Nothing else.
        foreach ([
            'Employee::', 'EmployeeService', 'SalaryStructure', 'EmploymentContract',
            'User::', 'HiringService',
        ] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                $source,
                "The public portal must never reach {$forbidden} — applying creates an applicant, not an employee."
            );
        }
    }

    public function test_the_public_payload_is_whitelisted_rather_than_serialised(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Presentation/Http/Controllers/PublicCareersController.php')
        );

        // Field-by-field construction, never handing a model to the response.
        $this->assertStringContainsString('private function publicSummary', $source);
        $this->assertStringContainsString('private function publicSalary', $source);

        foreach (['->toArray()', 'JobOpening::all(', '$job->toJson('] as $leaky) {
            $this->assertStringNotContainsString($leaky, $source, 'The public payload must be built explicitly.');
        }
    }

    public function test_public_uploads_are_restricted_and_stored_privately(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Presentation/Http/Controllers/PublicCareersController.php')
        );

        // An extension whitelist at validation, a mime check after it, a size cap,
        // and a private disk with a generated path.
        $this->assertStringContainsString('mimes:pdf,doc,docx', $source);
        $this->assertStringContainsString('ALLOWED_MIME', $source);
        $this->assertStringContainsString('MAX_UPLOAD_KB', $source);
        $this->assertStringContainsString("store('hr/applicants/", $source);
        $this->assertStringContainsString("'local'", $source);

        // Never a public disk, and never a client-supplied path.
        $this->assertStringNotContainsString("'public'", $source);
        $this->assertStringNotContainsString('getClientOriginalName())', $source);
    }

    public function test_only_published_openings_are_reachable_publicly(): void
    {
        $model = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Domain/Models/JobOpening.php')
        );

        // The three conditions live in one scope so no endpoint can forget one.
        $this->assertStringContainsString('scopePubliclyVisible', $model);
        $this->assertStringContainsString('is_public', $model);
        $this->assertStringContainsString('closes_on', $model);

        $controller = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Presentation/Http/Controllers/PublicCareersController.php')
        );

        // All three public endpoints go through it — the two reads AND the
        // submission, so an application cannot be filed against a hidden job.
        $this->assertSame(
            3,
            substr_count($controller, 'publiclyVisible('),
            'Every public endpoint must be scoped to publicly visible openings.'
        );
    }

    // ═══ APPLICANT IS NOT AN EMPLOYEE ════════════════════════════════════════════

    public function test_applying_and_hiring_are_separate_writers(): void
    {
        $application = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Domain/Services/JobApplicationService.php')
        );

        // The submit path writes applications; it must not create employees.
        foreach (['EmployeeService', 'Employee::create', 'SalaryStructure'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $application);
        }

        // Hiring is the only place that bridges, and it does so through the
        // services that own each record rather than writing them itself.
        $hiring = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Domain/Services/HiringService.php')
        );

        foreach ([
            'EmployeeService', 'EmploymentContractService', 'ReportingLineService',
            'SalaryStructureService', 'EmployeeDocumentService',
        ] as $owner) {
            $this->assertStringContainsString($owner, $hiring, 'Hiring must delegate to the service that owns each record.');
        }

        // And never write those tables directly.
        foreach (["table('hr_employees')", "table('hr_employment_contracts')", "table('hr_salary_structures')"] as $direct) {
            $this->assertStringNotContainsString($direct, $hiring, 'One writer per table.');
        }
    }

    public function test_the_applicant_links_to_an_employee_without_duplicating_one(): void
    {
        $columns = Schema::getColumnListing('hr_applicants');

        // A single, deliberate bridge.
        $this->assertContains('hired_employee_id', $columns);

        // And no shadow copy of employment data on the applicant.
        foreach (['department_id', 'position_id', 'salary', 'employee_number', 'hire_date'] as $duplicated) {
            $this->assertNotContains($duplicated, $columns, "Employment data belongs on the employee, not the applicant.");
        }
    }

    public function test_stage_and_lifecycle_history_are_append_only(): void
    {
        foreach ([
            'Modules/Hr/Recruitment/Domain/Models/ApplicationStageEvent.php',
            'Modules/Hr/Recruitment/Domain/Models/EmployeeLifecycleEvent.php',
        ] as $path) {
            $source = (string) file_get_contents(base_path($path));

            $this->assertStringContainsString('static::updating(fn () => false)', $source, "{$path} must be append-only.");
            $this->assertStringContainsString('static::deleting(fn () => false)', $source, "{$path} must be append-only.");
        }
    }

    public function test_the_pipeline_is_configuration_rather_than_code(): void
    {
        $this->assertTrue(Schema::hasTable('hr_recruitment_stages'));

        foreach (['code', 'name', 'sequence', 'type', 'is_initial', 'is_terminal'] as $column) {
            $this->assertContains($column, Schema::getColumnListing('hr_recruitment_stages'));
        }

        $service = (string) file_get_contents(
            base_path('Modules/Hr/Recruitment/Domain/Services/RecruitmentPipelineService.php')
        );

        // The engine navigates by sequence and reads meaning from type — it must
        // not hard-code a stage name.
        $code = strtolower((string) preg_replace('#(/\*.*?\*/)|(//.*)#s', '', $service));

        foreach (['phone_interview', 'final_interview', 'initial_review'] as $stageName) {
            $this->assertStringNotContainsString(
                $stageName,
                $code,
                'The pipeline service must not know any particular stage by name.'
            );
        }
    }

    // ═══ H6 IS VISUALIZATION ONLY ════════════════════════════════════════════════

    public function test_the_executive_context_owns_no_table(): void
    {
        $dir = base_path('Modules/Hr/Executive');

        $this->assertDirectoryExists($dir);
        // No migrations of its own — it reads what other contexts decided.
        $this->assertDirectoryDoesNotExist($dir.'/Infrastructure/Database/Migrations');
    }

    public function test_the_executive_context_defines_no_model_and_performs_no_write(): void
    {
        $writes = [
            '->insert(', '->insertGetId(', '->update(', '->updateOrInsert(', '->upsert(',
            '->delete(', '->truncate(', '->save(', '->increment(', '->decrement(',
            'DB::statement', 'DB::insert', 'DB::update', 'DB::delete',
        ];

        foreach ($this->sourcesIn('Modules/Hr/Executive') as $file => $source) {
            $this->assertStringNotContainsString('extends Model', $source, "{$file} must not define a model.");

            foreach ($writes as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file} must be read-only ({$needle}).");
            }
        }
    }

    public function test_every_executive_route_is_read_only(): void
    {
        $routes = collect(Route::getRoutes()->getRoutes())
            ->filter(fn ($r) => str_starts_with((string) $r->uri(), 'api/hr/executive'));

        $this->assertGreaterThan(0, $routes->count());

        foreach ($routes as $route) {
            $verbs = array_diff($route->methods(), ['GET', 'HEAD']);
            $this->assertEmpty($verbs, "Route {$route->uri()} exposes a write verb: ".implode(',', $verbs));
        }
    }

    public function test_the_executive_dashboard_reads_operational_availability_from_hr_data(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Executive/Domain/Services/HrExecutiveDashboardService.php')
        );

        // Drivers, warehouse, preparation and packing availability come from HR's
        // own employees and attendance — Shipping is never asked.
        $this->assertStringContainsString("table('hr_employees')", $source);
        $this->assertStringContainsString("table('hr_attendance_days')", $source);

        foreach (['logistics_', 'shipments', 'orders', 'stock_'] as $operationalTable) {
            $this->assertStringNotContainsString(
                "table('{$operationalTable}",
                $source,
                'Operational availability is derived from HR data, not from another module\'s tables.'
            );
        }
    }

    // ═══ REFERENCE-ONLY INTEGRATION ══════════════════════════════════════════════

    public function test_neither_context_imports_an_operational_module(): void
    {
        foreach (['Modules/Hr/Recruitment', 'Modules/Hr/Executive'] as $dir) {
            foreach ($this->sourcesIn($dir) as $file => $source) {
                foreach (self::FORBIDDEN_IMPORTS as $needle) {
                    $this->assertStringNotContainsString(
                        $needle,
                        $source,
                        "{$file} must integrate by reference only ({$needle})."
                    );
                }
            }
        }
    }

    public function test_notification_and_calendar_are_reached_by_event_rather_than_import(): void
    {
        $events = ['ApplicationReceived', 'ApplicationStageChanged', 'InterviewScheduled', 'ApplicantHired'];

        foreach ($events as $event) {
            $path = base_path("Modules/Hr/Recruitment/Domain/Events/{$event}.php");
            $this->assertFileExists($path);

            $source = (string) file_get_contents($path);

            // The marker contract the bus routes on.
            foreach (['eventName()', 'eventId()', 'toArray()'] as $method) {
                $this->assertStringContainsString($method, $source, "{$event} must expose {$method}.");
            }
        }

        // And no notifier or calendar is imported anywhere in the context.
        foreach ($this->sourcesIn('Modules/Hr/Recruitment') as $file => $source) {
            foreach (['NotificationService', 'CalendarService', 'Mail::', 'Notification::'] as $forbidden) {
                $this->assertStringNotContainsString(
                    $forbidden,
                    $source,
                    "{$file} must announce, not deliver ({$forbidden})."
                );
            }
        }
    }

    // ═══ Helpers ═════════════════════════════════════════════════════════════════

    /** @return array<string, string> */
    private function sourcesIn(string $relativeDir): array
    {
        $dir = base_path($relativeDir);

        if (! is_dir($dir)) {
            return [];
        }

        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $out[basename($file->getPathname())] = (string) file_get_contents($file->getPathname());
            }
        }

        return $out;
    }
}
