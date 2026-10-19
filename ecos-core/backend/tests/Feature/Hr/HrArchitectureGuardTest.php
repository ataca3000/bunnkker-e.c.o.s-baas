<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Modules\Hr\Workforce\Domain\Contracts\ProvidesAttendanceSummary;
use Tests\TestCase;

/**
 * HR & Workforce OS — architecture guards.
 *
 * ┌─ THE ARCHITECTURE IS ASSERTED, NOT DESCRIBED ───────────────────────────┐
 * │ Every ownership rule the CTO set for this epic is checked here against the  │
 * │ real schema and the real source, so a later change that quietly breaks one  │
 * │ fails a test instead of shipping.                                          │
 * │                                                                            │
 * │   Employee owns workforce identity  — one employee table, nowhere else      │
 * │   Attendance owns attendance events — H1 cannot calculate them              │
 * │   Payroll does not calculate here   — no salary anywhere in the HR schema   │
 * │   Finance does not own employees    — no Finance import in HR               │
 * │   Referenced, never duplicated      — no operational module import          │
 * │   Attendance stays simple           — the exclusion list, enforced          │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class HrArchitectureGuardTest extends TestCase
{
    use DatabaseTransactions;

    /** Modules HR must integrate with by reference only — never by import. */
    private const FORBIDDEN_IMPORTS = [
        'use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Inventory',
        'use Modules\\Shipping', 'use Modules\\Logistics', 'use Modules\\POS',
        'use Modules\\Marketing', 'use Modules\\Manufacturing', 'use Modules\\Crm',
        'use Modules\\Sales', 'use Modules\\Purchasing', 'use Modules\\CostManagement',
    ];

    /** Everything EPIC H2 explicitly excluded, as it would appear in code or schema. */
    private const EXCLUDED_CAPABILITIES = [
        'fingerprint', 'biometric', 'rfid', 'qr_code', 'qrcode',
        'gps', 'geofence', 'latitude', 'longitude',
        'overtime', 'compensatory', 'time_off_in_lieu', 'toil',
        'leave_balance', 'leave_type', 'annual_leave', 'accrual', 'entitlement',
    ];

    // ═══ EMPLOYEE OWNS WORKFORCE IDENTITY ════════════════════════════════════════

    public function test_hr_employees_is_the_only_employee_master_in_the_database(): void
    {
        $this->assertTrue(Schema::hasTable('hr_employees'), 'The employee master must exist.');

        $employeeTables = collect($this->allTables())
            ->filter(fn (string $t) => str_contains($t, 'employee'))
            // Sub-tables that hang off the master are fine; a second master is not.
            ->reject(fn (string $t) => in_array($t, [
                'hr_employees', 'hr_employee_documents', 'hr_employee_shift_assignments',
                'hr_employee_incidents', 'hr_employee_lifecycle_events',
            ], true));

        $this->assertEmpty(
            $employeeTables->all(),
            'A second employee table would duplicate workforce identity: '.$employeeTables->implode(', ')
        );
    }

    public function test_no_other_module_declares_an_employee_table(): void
    {
        $offenders = [];

        foreach ($this->moduleSources() as $file => $source) {
            if (str_contains($file, DIRECTORY_SEPARATOR.'Hr'.DIRECTORY_SEPARATOR)) {
                continue;
            }

            foreach (["Schema::create('hr_employees", "protected \$table = 'hr_employees'"] as $needle) {
                if (str_contains($source, $needle)) {
                    $offenders[] = basename($file);
                }
            }
        }

        $this->assertEmpty($offenders, 'Only the HR module may own the employee table: '.implode(', ', $offenders));
    }

    // ═══ ATTENDANCE OWNS ATTENDANCE EVENTS ═══════════════════════════════════════

    public function test_the_workforce_domain_never_names_the_attendance_domain(): void
    {
        // H1 asks through its own port; the concrete Attendance services are bound
        // at the container, so Workforce source must not mention them at all.
        foreach ($this->sourcesIn('Modules/Hr/Workforce') as $file => $source) {
            $this->assertStringNotContainsString(
                'Modules\\Hr\\Attendance',
                $source,
                "{$file} must reach attendance through ProvidesAttendanceSummary, not by naming the Attendance context."
            );
        }
    }

    public function test_the_attendance_port_is_bound_to_the_attendance_context(): void
    {
        $implementation = app(ProvidesAttendanceSummary::class);

        $this->assertInstanceOf(
            \Modules\Hr\Attendance\Domain\Services\AttendanceSummaryProvider::class,
            $implementation,
            'The Employee 360 attendance port must be answered by the Attendance context.'
        );
    }

    // ═══ COMPENSATION LIVES IN ONE PLACE ═════════════════════════════════════════

    /**
     * The workforce and attendance tables carry no pay.
     *
     * H1 originally asserted this of the whole HR module, because Payroll did not
     * exist yet. H3 introduced it, so the invariant sharpens rather than
     * disappears: compensation lives in the Compensation context and NOWHERE else
     * in HR. The employee record and the employment contract still carry no
     * salary, which was the point all along — a second copy would be a second
     * source of truth.
     */
    public function test_the_workforce_and_attendance_tables_carry_no_compensation(): void
    {
        $money = ['salary', 'wage', 'pay_rate', 'basic_pay', 'gross_pay', 'net_pay', 'allowance', 'bonus'];

        // Every HR table that is NOT part of the Compensation context.
        $compensationTables = [
            'hr_payroll_periods', 'hr_salary_structures', 'hr_commission_rules', 'hr_commission_rule_tiers',
            'hr_bonuses', 'hr_deductions', 'hr_advances', 'hr_advance_installments',
            'hr_payroll_runs', 'hr_payslips', 'hr_payslip_lines', 'hr_kpi_facts',
            'hr_bonus_recommendations',

            // Recruitment carries an ADVERTISED band and a candidate's EXPECTATION.
            // Neither is anybody's pay: the first is a range on a job posting, the
            // second is what someone asked for before being offered anything. The
            // salary an employee is actually paid is still written only once, by
            // Payroll, when a hire is executed.
            'hr_job_openings', 'hr_job_applications',

            // An OFFERED salary is a proposal to someone who is not yet employed,
            // and the version rows exist precisely so a superseded proposal is not
            // overwritten. Nothing in Payroll reads this table; the figure becomes
            // compensation only when hiring hands it to SalaryStructureService.
            // The distinction the guard actually protects — one writer for what
            // people are PAID — is untouched, and the two tests below still prove
            // the employee record and the employment contract carry no salary.
            'hr_offer_versions',

            // Adjustments correct pay that Payroll already approved. They are
            // Compensation's own table, listed here only because they postdate the
            // original list.
            'hr_compensation_adjustments',
        ];

        $offenders = [];

        foreach (array_diff($this->hrTables(), $compensationTables) as $table) {
            foreach (Schema::getColumnListing($table) as $column) {
                // An `_id` is a link to a compensation record, not a copy of the
                // amount on it — that traceability is deliberate and is not a
                // second source of truth.
                if (str_ends_with($column, '_id')) {
                    continue;
                }

                foreach ($money as $needle) {
                    if (str_contains($column, $needle)) {
                        $offenders[] = "{$table}.{$column}";
                    }
                }
            }
        }

        $this->assertEmpty(
            $offenders,
            'Only the Compensation context may carry pay: '.implode(', ', $offenders)
        );
    }

    /** The employee record and the employment contract specifically stay pay-free. */
    public function test_the_employee_and_contract_still_carry_no_pay(): void
    {
        foreach (['hr_employees', 'hr_employment_contracts'] as $table) {
            foreach (Schema::getColumnListing($table) as $column) {
                foreach (['salary', 'wage', 'pay_rate', 'allowance', 'bonus'] as $needle) {
                    $this->assertStringNotContainsString(
                        $needle,
                        $column,
                        "{$table}.{$column} — pay belongs to the salary structure, not the employee or the contract."
                    );
                }
            }
        }

        // And the structure that does carry it is the one Payroll owns.
        $this->assertTrue(Schema::hasTable('hr_salary_structures'));
        $this->assertContains('basic_salary', Schema::getColumnListing('hr_salary_structures'));
    }

    public function test_the_only_payroll_concern_hr_owns_is_the_leave_flag(): void
    {
        $columns = Schema::getColumnListing('hr_leave_requests');

        $this->assertContains('payroll_flag', $columns);
        // The flag states intent; Payroll does the arithmetic.
        $this->assertEmpty(
            array_values(array_filter($columns, fn (string $c) => str_contains($c, 'amount') || str_contains($c, 'salary_value'))),
            'HR states whether leave is deducted, never how much.'
        );
    }

    // ═══ REFERENCE-ONLY INTEGRATION ══════════════════════════════════════════════

    public function test_hr_does_not_import_finance_commerce_or_operational_modules(): void
    {
        foreach ($this->sourcesIn('Modules/Hr') as $file => $source) {
            foreach (self::FORBIDDEN_IMPORTS as $needle) {
                $this->assertStringNotContainsString(
                    $needle,
                    $source,
                    "{$file} must integrate by reference only ({$needle})."
                );
            }
        }
    }

    public function test_hr_references_the_existing_organization_tables_rather_than_rebuilding_them(): void
    {
        // Companies and branches are owned by the Organization module. HR points at
        // them; it must never have created its own.
        $this->assertTrue(Schema::hasTable('companies'));
        $this->assertTrue(Schema::hasTable('branches'));
        $this->assertFalse(Schema::hasTable('hr_companies'), 'HR must reference the existing companies table.');
        $this->assertFalse(Schema::hasTable('hr_branches'), 'HR must reference the existing branches table.');

        $this->assertContains('company_id', Schema::getColumnListing('hr_employees'));
        $this->assertContains('branch_id', Schema::getColumnListing('hr_employees'));
    }

    public function test_the_employee_links_to_a_login_without_duplicating_it(): void
    {
        $columns = Schema::getColumnListing('hr_employees');

        $this->assertContains('user_id', $columns, 'An employee references their login by id.');
        // The identity of the login stays in `users` — no copy of the credential.
        foreach (['password', 'remember_token', 'email_verified_at'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns, "Login data belongs to `users`, not `hr_employees`.");
        }
    }

    // ═══ ATTENDANCE STAYS SIMPLE — THE H2 EXCLUSION LIST ═════════════════════════

    public function test_no_hr_table_implements_an_excluded_capability(): void
    {
        $offenders = [];

        foreach ($this->hrTables() as $table) {
            foreach (Schema::getColumnListing($table) as $column) {
                foreach (self::EXCLUDED_CAPABILITIES as $needle) {
                    if (str_contains($column, $needle)) {
                        $offenders[] = "{$table}.{$column}";
                    }
                }
            }
        }

        $this->assertEmpty(
            $offenders,
            'EPIC H2 excluded these explicitly — attendance must stay simple and operational: '.implode(', ', $offenders)
        );
    }

    public function test_no_hr_class_implements_an_excluded_capability(): void
    {
        $offenders = [];

        foreach ($this->sourcesIn('Modules/Hr') as $file => $source) {
            // The guard test itself and the migrations that document the exclusions
            // are allowed to name them; implementation code is not.
            $body = strtolower($source);

            foreach (['fingerprint', 'rfid', 'geofence', 'compensatory', 'leave_balance', 'accrual'] as $needle) {
                // Only flag real code, not the comments that explain the exclusion.
                $codeOnly = preg_replace('#(/\*.*?\*/)|(//.*)#s', '', $body) ?? $body;
                if (str_contains((string) $codeOnly, $needle)) {
                    $offenders[] = "{$file} ({$needle})";
                }
            }
        }

        $this->assertEmpty($offenders, 'Excluded capabilities must not be implemented: '.implode(', ', $offenders));
    }

    public function test_attendance_records_no_device_capture_source(): void
    {
        $this->assertContains('source', Schema::getColumnListing('hr_attendance_days'));

        // Registration is manual, full stop — the service writes nothing else.
        $source = file_get_contents(base_path('Modules/Hr/Attendance/Domain/Services/AttendanceRegistrationService.php'));
        $this->assertStringContainsString("'source' => 'manual'", (string) $source);
    }

    public function test_hr_shifts_do_not_collide_with_the_pos_cash_shift_table(): void
    {
        // POS already owns `pos_shifts`, which is a cash-register session and an
        // entirely different concept from a work shift.
        $this->assertTrue(Schema::hasTable('hr_shifts'));
        $this->assertFalse(Schema::hasTable('shifts'), 'A bare `shifts` table would be ambiguous across modules.');
    }

    // ═══ Helpers ═════════════════════════════════════════════════════════════════

    /** @return array<int, string> */
    private function allTables(): array
    {
        return array_map(
            fn ($t) => is_array($t) ? ($t['name'] ?? '') : (string) $t,
            array_map(fn ($t) => is_object($t) ? (array) $t : $t, Schema::getTables())
        );
    }

    /** @return array<int, string> */
    private function hrTables(): array
    {
        return array_values(array_filter($this->allTables(), fn (string $t) => str_starts_with($t, 'hr_')));
    }

    /** @return array<string, string> path => source */
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

    /** Every module source file in the application. @return array<string, string> */
    private function moduleSources(): array
    {
        $dir = base_path('Modules');
        $out = [];
        $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($dir));

        foreach ($it as $file) {
            if ($file->isFile() && $file->getExtension() === 'php') {
                $out[$file->getPathname()] = (string) file_get_contents($file->getPathname());
            }
        }

        return $out;
    }
}
