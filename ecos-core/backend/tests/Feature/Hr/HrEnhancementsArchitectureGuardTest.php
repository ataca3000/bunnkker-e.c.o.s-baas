<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Schema;
use Modules\Hr\Compensation\Domain\Models\CommissionRule;
use Modules\Hr\Recruitment\Domain\Enums\TimelineEventType;
use Tests\TestCase;

/**
 * TASK-HR-V1-ENHANCEMENTS-001 — architecture guards.
 *
 * These assert the boundaries the enhancements are only worth having if they
 * hold: analytics owns nothing, the timeline cannot be rewritten, offers do not
 * become pay, bulk work goes through the same services as single work, and the
 * two things that protect approved pay are asked in exactly one place each.
 *
 * They read source and the real route table, so they fail when someone writes
 * the wrong thing — not when someone forgets to update a list.
 */
class HrEnhancementsArchitectureGuardTest extends TestCase
{
    private const RECRUITMENT = __DIR__.'/../../../Modules/Hr/Recruitment';

    private const COMPENSATION = __DIR__.'/../../../Modules/Hr/Compensation';

    // ═══ ANALYTICS OWNS NOTHING ══════════════════════════════════════════════

    public function test_recruitment_analytics_never_writes(): void
    {
        $source = $this->source(self::RECRUITMENT.'/Domain/Services/RecruitmentAnalyticsService.php');

        foreach (['->insert(', '->update(', '->delete(', '::create(', '->save(', '->truncate('] as $write) {
            $this->assertStringNotContainsString(
                $write,
                $source,
                "RecruitmentAnalyticsService must be read-only; found {$write}."
            );
        }
    }

    public function test_recruitment_analytics_uses_no_eloquent_models(): void
    {
        $source = $this->source(self::RECRUITMENT.'/Domain/Services/RecruitmentAnalyticsService.php');

        // Query builder only. A model here would be a foothold for a write and a
        // second definition of what a candidacy is.
        $this->assertStringNotContainsString(
            'Domain\Models\\',
            $source,
            'Analytics reads through the query builder, never through models.'
        );
    }

    public function test_analytics_sql_stays_portable(): void
    {
        // Comments are stripped first, or this fires on the sentences that explain
        // why these functions are avoided — which is the prose worth keeping.
        $source = $this->stripComments(
            $this->source(self::RECRUITMENT.'/Domain/Services/RecruitmentAnalyticsService.php')
        );

        // IF() is MySQL-only, FILTER is PostgreSQL-only, and DATEDIFF/EXTRACT are
        // spelled differently on each. Timestamp arithmetic is done in PHP.
        foreach (['IF(', ') FILTER (', 'DATEDIFF(', 'EXTRACT(EPOCH', 'TIMESTAMPDIFF('] as $dialect) {
            $this->assertStringNotContainsString(
                $dialect,
                $source,
                "Analytics must run unchanged on MySQL and PostgreSQL; found {$dialect}."
            );
        }
    }

    // ═══ THE TIMELINE IS APPEND-ONLY ═════════════════════════════════════════

    public function test_the_timeline_model_refuses_updates_and_deletes(): void
    {
        $source = $this->source(self::RECRUITMENT.'/Domain/Models/ApplicantTimelineEvent.php');

        $this->assertStringContainsString('static::updating(fn () => false)', $source);
        $this->assertStringContainsString('static::deleting(fn () => false)', $source);
    }

    public function test_the_timeline_service_offers_no_way_to_change_history(): void
    {
        $source = $this->source(self::RECRUITMENT.'/Domain/Services/ApplicantTimelineService.php');

        foreach (['public function update', 'public function delete', 'public function correct', 'public function amend'] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                $source,
                "The timeline is append-only; {$forbidden} must not exist."
            );
        }
    }

    public function test_an_offer_version_cannot_be_rewritten_either(): void
    {
        $source = $this->source(self::RECRUITMENT.'/Domain/Models/OfferVersion.php');

        $this->assertStringContainsString('static::updating(fn () => false)', $source);
        $this->assertStringContainsString('static::deleting(fn () => false)', $source);
    }

    public function test_every_timeline_event_type_has_a_category(): void
    {
        // The enum's match is exhaustive, so a new case without a category is a
        // compile error rather than a silently uncategorised event.
        foreach (TimelineEventType::cases() as $case) {
            $this->assertNotEmpty($case->category(), "{$case->value} has no category.");
            $this->assertNotEmpty($case->label(), "{$case->value} has no label.");
        }
    }

    // ═══ OFFERS ARE NOT PAY ══════════════════════════════════════════════════

    public function test_the_offer_service_never_writes_a_salary_structure(): void
    {
        $source = $this->stripComments($this->source(self::RECRUITMENT.'/Domain/Services/OfferService.php'));

        // An offer is a proposal to somebody who is not yet employed. The figure
        // becomes compensation only when hiring hands it to Payroll.
        foreach (['SalaryStructure', 'hr_salary_structures', 'PayrollRun', 'Payslip'] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                $source,
                "OfferService must not touch {$forbidden} — an offer is not pay."
            );
        }
    }

    public function test_no_payroll_code_reads_the_offer_tables(): void
    {
        $offenders = [];

        foreach ($this->phpFiles(self::COMPENSATION) as $file) {
            $source = $this->stripComments($this->source($file));

            foreach (['hr_offers', 'hr_offer_versions', 'Domain\Models\Offer'] as $needle) {
                if (str_contains($source, $needle)) {
                    $offenders[] = basename($file).' → '.$needle;
                }
            }
        }

        $this->assertEmpty(
            $offenders,
            "Payroll must not read offers; what people are paid comes from the salary structure.\n"
            .implode("\n", $offenders)
        );
    }

    // ═══ BULK IS THE SAME ACT, REPEATED ══════════════════════════════════════

    public function test_bulk_actions_never_write_to_the_tables_directly(): void
    {
        $source = $this->stripComments($this->source(self::RECRUITMENT.'/Domain/Services/BulkRecruitmentService.php'));

        // A mass UPDATE would skip the status machine and leave no audit trail —
        // in exactly the place a single click can be wrong eighty times.
        foreach (["table('hr_job_applications')", "table('hr_applicants')", '->toBase()->update(', 'DB::update('] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                $source,
                "Bulk work must delegate to the owning services; found {$forbidden}."
            );
        }
    }

    public function test_every_bulk_action_declares_a_permission(): void
    {
        foreach (\Modules\Hr\Recruitment\Domain\Services\BulkRecruitmentService::ACTIONS as $key => $definition) {
            $this->assertArrayHasKey('permission', $definition, "Bulk action {$key} declares no permission.");
            $this->assertStringStartsWith('hr.', $definition['permission']);
        }
    }

    public function test_bulk_work_is_capped(): void
    {
        $this->assertLessThanOrEqual(
            500,
            \Modules\Hr\Recruitment\Domain\Services\BulkRecruitmentService::MAX_SELECTION,
            'An uncapped bulk action is a script, not a click.'
        );
    }

    // ═══ THE COMPENSATION LOCK IS ASKED IN ONE PLACE ═════════════════════════

    public function test_every_component_service_consults_the_lock(): void
    {
        $services = ['BonusService', 'DeductionService', 'AdvanceService'];

        foreach ($services as $service) {
            $source = $this->source(self::COMPENSATION."/Domain/Services/{$service}.php");

            $this->assertStringContainsString(
                'CompensationLockService',
                $source,
                "{$service} must consult the lock before writing — four opinions of what "
                .'"approved" means eventually becomes three and a hole.'
            );
        }
    }

    public function test_the_lock_is_derived_from_approved_runs_not_from_a_flag(): void
    {
        $source = $this->source(self::COMPENSATION.'/Domain/Services/CompensationLockService.php');

        // A stored boolean would have to be set by something, and whatever failed
        // to set it would be the exact path a correction slipped through. So the
        // lock is a QUERY over approved runs.
        $this->assertStringContainsString('PayrollRunStatus::Approved', $source);
        $this->assertStringContainsString('->exists()', $source);

        // `is_locked` as a RETURNED key is fine — that is the answer. What must not
        // exist is a persisted column the service reads instead of deciding.
        foreach (["where('is_locked'", "where('locked_at'", '$period->is_locked', '$period->locked_at'] as $stored) {
            $this->assertStringNotContainsString(
                $stored,
                $source,
                "The lock must be derived, not read from {$stored}."
            );
        }

        $this->assertFalse(
            Schema::hasColumn('hr_payroll_periods', 'is_locked'),
            'A stored lock flag would be a second answer to a question only the runs can settle.'
        );
    }

    public function test_an_adjustment_carries_no_accounting_instruction(): void
    {
        $source = $this->stripComments(
            $this->source(self::COMPENSATION.'/Domain/Models/CompensationAdjustment.php')
        );

        // Finance owns the ledger. An adjustment is a compensation instruction.
        //
        // Double-entry vocabulary only. `isCredit()` stays: it answers "does this
        // pay more or recover", which is a direction of money and not a ledger
        // side — and banning the word would push the concept into a worse name.
        foreach (['account_code', 'debit_', '_debit', 'journal', 'posting_date', 'ledger'] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                strtolower($source),
                "An adjustment must not carry {$forbidden}; Finance owns the entry."
            );
        }

        // And the fillable — the actual contract with the database — names none of
        // it, which the table guard below proves from the schema itself.
        $fillable = (new \Modules\Hr\Compensation\Domain\Models\CompensationAdjustment)->getFillable();

        foreach ($fillable as $field) {
            foreach (['account', 'debit', 'credit', 'journal', 'ledger'] as $forbidden) {
                $this->assertStringNotContainsString($forbidden, $field, "Fillable field {$field} is an accounting concept.");
            }
        }
    }

    public function test_the_adjustments_table_carries_no_accounting_columns(): void
    {
        $columns = Schema::getColumnListing('hr_compensation_adjustments');

        foreach ($columns as $column) {
            foreach (['account', 'debit', 'credit', 'journal', 'ledger'] as $forbidden) {
                $this->assertStringNotContainsString(
                    $forbidden,
                    $column,
                    "hr_compensation_adjustments.{$column} is an accounting concept HR does not own."
                );
            }
        }
    }

    // ═══ RULE ECONOMICS ARE VERSIONED ════════════════════════════════════════

    public function test_the_rule_service_refuses_economic_edits(): void
    {
        $source = $this->source(self::COMPENSATION.'/Domain/Services/CommissionRuleService.php');

        $this->assertStringContainsString('ECONOMIC_FIELDS', $source);
        $this->assertStringContainsString('ruleEconomicsAreVersioned', $source);
    }

    public function test_the_economic_field_list_covers_everything_that_moves_money(): void
    {
        // If a field decides what a rule PAYS, editing it in place would rewrite
        // history. Anything added to the rule later must land in this list too.
        foreach (['metric_key', 'method', 'rate', 'applies_to', 'threshold_value', 'min_amount', 'max_amount', 'tiers'] as $field) {
            $this->assertContains(
                $field,
                CommissionRule::ECONOMIC_FIELDS,
                "{$field} changes what a rule pays and must be versioned, not edited."
            );
        }
    }

    public function test_the_commission_engine_still_resolves_rules_by_the_period_start(): void
    {
        $source = $this->source(self::COMPENSATION.'/Domain/Services/CommissionEngine.php');

        // Versioning only protects history if the engine keeps asking "which rule
        // applied THEN" rather than "which rule applies now".
        $this->assertStringContainsString('$this->rulesFor($employee, $from)', $source);
        $this->assertStringContainsString('effectiveOn(', $source);
    }

    public function test_the_rule_lineage_columns_exist(): void
    {
        foreach (['version', 'version_group', 'supersedes_rule_id', 'superseded_at'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('hr_commission_rules', $column),
                "hr_commission_rules.{$column} is required for rule versioning."
            );
        }
    }

    // ═══ KPI TRACEABILITY DOES NOT BECOME AN IMPORT ══════════════════════════

    public function test_kpi_traceability_names_document_types_without_importing_modules(): void
    {
        $source = $this->stripComments($this->source(self::COMPENSATION.'/Domain/Services/KpiFactService.php'));

        // Naming a document TYPE is not resolving it. HR still cannot turn a
        // reference into an order.
        foreach (['Modules\Commerce', 'Modules\Sales', 'Modules\Inventory', 'Modules\Logistics', 'Modules\Crm'] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                $source,
                "KpiFactService must not import {$forbidden}; the source reference stays opaque."
            );
        }
    }

    public function test_a_kpi_fact_records_both_when_it_happened_and_when_it_arrived(): void
    {
        foreach (['occurred_at', 'imported_at', 'source_document_type', 'source_document_number'] as $column) {
            $this->assertTrue(
                Schema::hasColumn('hr_kpi_facts', $column),
                "hr_kpi_facts.{$column} is required for traceability."
            );
        }
    }

    // ═══ EXIT WRITES THE EMPLOYEE RECORD THROUGH ITS OWNER ═══════════════════

    public function test_the_exit_service_never_writes_the_employee_table(): void
    {
        $source = $this->stripComments($this->source(self::RECRUITMENT.'/Domain/Services/ExitProcessService.php'));

        foreach (["table('hr_employees')", 'Employee::create', 'Employee::query()->update', '->terminate('] as $forbidden) {
            $this->assertStringNotContainsString(
                $forbidden,
                $source,
                "Exit must go through the lifecycle service; found {$forbidden}."
            );
        }

        $this->assertStringContainsString(
            'lifecycle->separate(',
            $source,
            'Completing an exit must separate the employee through the service that owns their history.'
        );
    }

    public function test_the_exit_checklist_is_data_rather_than_a_migration(): void
    {
        $this->assertNotEmpty(
            \Modules\Hr\Recruitment\Domain\Services\ExitProcessService::DEFAULT_CHECKLIST,
            'The default checklist must exist.'
        );

        // Seeded per exit, so an exit already under way is not disturbed by the
        // catalogue changing underneath it.
        $source = $this->source(self::RECRUITMENT.'/Domain/Services/ExitProcessService.php');
        $this->assertStringContainsString('seedChecklist', $source);
    }

    // ═══ THE PUBLIC SURFACE DID NOT GROW ═════════════════════════════════════

    public function test_the_enhancements_added_no_unauthenticated_routes(): void
    {
        $public = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            if (! str_starts_with($uri, 'api/hr') && ! str_starts_with($uri, 'api/careers')) {
                continue;
            }

            $middleware = $route->gatherMiddleware();

            if (! in_array('auth:sanctum', $middleware, true)) {
                $public[] = $route->methods()[0].' '.$uri;
            }
        }

        sort($public);

        // Scoped to HR, as it has been since H5: roughly twenty pre-existing
        // unauthenticated api/logistics/* routes are outside this epic's remit and
        // were reported rather than silently blessed.
        $this->assertSame(
            [
                'GET api/careers/jobs',
                'GET api/careers/jobs/{slug}',
                'POST api/careers/jobs/{slug}/apply',
            ],
            $public,
            'The careers portal must remain the only unauthenticated HR surface.'
        );
    }

    public function test_every_new_hr_route_declares_a_permission(): void
    {
        $prefixes = ['api/hr/offers', 'api/hr/exits'];
        $missing = [];

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            $matches = false;
            foreach ($prefixes as $prefix) {
                if (str_starts_with($uri, $prefix)) {
                    $matches = true;
                }
            }

            if (! $matches) {
                continue;
            }

            $hasPermission = false;
            foreach ($route->gatherMiddleware() as $middleware) {
                if (is_string($middleware) && str_starts_with($middleware, 'permission:')) {
                    $hasPermission = true;
                }
            }

            if (! $hasPermission) {
                $missing[] = $route->methods()[0].' '.$uri;
            }
        }

        $this->assertEmpty($missing, "These routes declare no permission:\n".implode("\n", $missing));
    }

    public function test_raising_and_approving_an_adjustment_are_different_permissions(): void
    {
        $raise = null;
        $approve = null;

        foreach (Route::getRoutes() as $route) {
            $uri = $route->uri();

            if (str_ends_with($uri, 'adjustments') && in_array('POST', $route->methods(), true)) {
                $raise = $this->permissionOf($route);
            }

            if (str_contains($uri, 'adjustments/{id}/approve')) {
                $approve = $this->permissionOf($route);
            }
        }

        $this->assertNotNull($raise, 'The raise-adjustment route is missing.');
        $this->assertNotNull($approve, 'The approve-adjustment route is missing.');
        $this->assertNotSame(
            $raise,
            $approve,
            'The whole point of an adjustment is that changing approved pay is not one person\'s decision.'
        );
    }

    // ═══ HELPERS ═════════════════════════════════════════════════════════════

    private function permissionOf(\Illuminate\Routing\Route $route): ?string
    {
        foreach ($route->gatherMiddleware() as $middleware) {
            if (is_string($middleware) && str_starts_with($middleware, 'permission:')) {
                return $middleware;
            }
        }

        return null;
    }

    private function source(string $path): string
    {
        $this->assertFileExists($path);

        return (string) file_get_contents($path);
    }

    /**
     * Strip comments before scanning.
     *
     * Otherwise a guard fires on the docblock that explains why the thing it is
     * forbidding is forbidden — which is exactly the sentence worth keeping.
     */
    private function stripComments(string $source): string
    {
        $stripped = '';

        foreach (token_get_all($source) as $token) {
            if (is_array($token) && in_array($token[0], [T_COMMENT, T_DOC_COMMENT], true)) {
                continue;
            }

            $stripped .= is_array($token) ? $token[1] : $token;
        }

        return $stripped;
    }

    /** @return array<int, string> */
    private function phpFiles(string $directory): array
    {
        $files = [];

        $iterator = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($directory));

        foreach ($iterator as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $files[] = $file->getPathname();
            }
        }

        return $files;
    }
}
