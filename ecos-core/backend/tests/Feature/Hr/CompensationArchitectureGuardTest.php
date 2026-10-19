<?php

declare(strict_types=1);

namespace Tests\Feature\Hr;

use Illuminate\Foundation\Testing\DatabaseTransactions;
use Illuminate\Support\Facades\Schema;
use Modules\Hr\Compensation\Application\Bridge\WorkforceKpiCatalog;
use Modules\Hr\Compensation\Application\Bridge\WorkforceKpiSubscriber;
use Modules\Hr\Compensation\Domain\Contracts\ProvidesAbsenceFacts;
use Modules\Hr\Compensation\Domain\Enums\KpiMetric;
use Modules\Hr\Compensation\Domain\Models\KpiFact;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Tests\TestCase;

/**
 * HR & Workforce OS — EPIC H3 + H4 architecture guards.
 *
 * ┌─ THE BOUNDARIES ARE ASSERTED, NOT DESCRIBED ────────────────────────────┐
 * │ Every ownership rule the CTO set for these two epics is checked against    │
 * │ the real schema and the real source, so a later change that quietly breaks  │
 * │ one fails a test instead of shipping.                                      │
 * │                                                                            │
 * │   Payroll calculates only      — HR posts no journal, moves no money        │
 * │   Finance owns the accounting  — no Finance import, no account codes        │
 * │   Reference-only integration   — no operational import, opaque refs only    │
 * │   Commission is configured     — no role or scheme named in the engine      │
 * │   KPIs are collected           — append-only facts, idempotent, by event    │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
class CompensationArchitectureGuardTest extends TestCase
{
    use DatabaseTransactions;

    /** Modules H3/H4 must integrate with by reference only — never by import. */
    private const FORBIDDEN_IMPORTS = [
        'use Modules\\Commerce', 'use Modules\\Finance', 'use Modules\\Inventory',
        'use Modules\\Shipping', 'use Modules\\Logistics', 'use Modules\\POS',
        'use Modules\\Marketing', 'use Modules\\Manufacturing', 'use Modules\\Crm',
        'use Modules\\Sales', 'use Modules\\Purchasing', 'use Modules\\CostManagement',
        'use Modules\\Operations',
    ];

    // ═══ PAYROLL CALCULATES · FINANCE POSTS ══════════════════════════════════════

    public function test_hr_never_writes_an_accounting_entry(): void
    {
        // Journals, ledgers and postings are Finance's tables. HR must not touch
        // any of them, by name or by model.
        $forbidden = [
            'journal_entries', 'journal_entry_lines', 'finance_journals', 'gl_entries',
            'chart_of_accounts', 'finance_accounts', 'ledger_entries',
            'PostingCoordinator', 'JournalService', 'PostingService',
        ];

        foreach ($this->hrSources() as $file => $source) {
            foreach ($forbidden as $needle) {
                $this->assertStringNotContainsString(
                    $needle,
                    $source,
                    "{$file} must not reach into Finance's books — Payroll calculates, Finance posts."
                );
            }
        }
    }

    public function test_no_hr_table_carries_an_accounting_dimension(): void
    {
        // An account code on a payroll table would mean HR had started deciding
        // how compensation is booked, which is Finance's decision to make.
        $accountingColumns = ['account_id', 'account_code', 'debit', 'credit', 'journal_id', 'posting_date', 'gl_account'];
        $offenders = [];

        foreach ($this->hrTables() as $table) {
            foreach (Schema::getColumnListing($table) as $column) {
                if (in_array($column, $accountingColumns, true)) {
                    $offenders[] = "{$table}.{$column}";
                }
            }
        }

        $this->assertEmpty($offenders, 'Accounting belongs to Finance: '.implode(', ', $offenders));
    }

    public function test_the_finance_handover_carries_amounts_but_no_accounting_instructions(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Compensation/Domain/Events/CompensationApproved.php')
        );

        // It says WHAT is owed…
        foreach (['total_gross', 'total_net', 'currency', 'employees'] as $expected) {
            $this->assertStringContainsString($expected, $source);
        }

        // …and nothing about HOW to book it. Comments are stripped first: the
        // docblock deliberately names these terms to explain their absence.
        $code = strtolower((string) preg_replace('#(/\*.*?\*/)|(//.*)#s', '', $source));

        foreach (['debit', 'credit', 'account_code', 'journal'] as $forbidden) {
            $this->assertStringNotContainsString($forbidden, $code);
        }
    }

    public function test_hr_moves_no_money(): void
    {
        // HR records that an advance was granted and recovers it from pay. The
        // disbursement and the payment itself are Finance's.
        foreach ($this->hrSources() as $file => $source) {
            foreach (['PaymentService', 'disburse(', 'makePayment', 'transferFunds'] as $needle) {
                $this->assertStringNotContainsString($needle, $source, "{$file} must not move money.");
            }
        }
    }

    // ═══ REFERENCE-ONLY INTEGRATION ══════════════════════════════════════════════

    public function test_hr_imports_no_operational_module(): void
    {
        foreach ($this->hrSources() as $file => $source) {
            foreach (self::FORBIDDEN_IMPORTS as $needle) {
                $this->assertStringNotContainsString(
                    $needle,
                    $source,
                    "{$file} must integrate by reference only ({$needle})."
                );
            }
        }
    }

    public function test_the_kpi_bridge_reads_events_by_duck_typing_rather_than_by_class(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Compensation/Application/Bridge/WorkforceKpiSubscriber.php')
        );

        // It reads the marker contract off whatever it is handed…
        $this->assertStringContainsString('method_exists', $source);
        $this->assertStringContainsString('eventName', $source);
        $this->assertStringContainsString('toArray', $source);

        // …and takes an untyped object, so no operational class is ever named.
        $this->assertStringContainsString('object $event', $source);
    }

    public function test_the_kpi_bridge_is_off_by_default(): void
    {
        // Enabling collection is a deliberate per-environment decision, made once
        // employees are mapped to the actors on operational events.
        $this->assertFalse((bool) config('hr.kpi.auto_subscribe', false));

        $provider = (string) file_get_contents(
            base_path('Modules/Hr/Infrastructure/Providers/HrServiceProvider.php')
        );
        $this->assertStringContainsString("config('hr.kpi.auto_subscribe', false)", $provider);
    }

    public function test_an_event_with_nobody_to_credit_is_dropped_rather_than_guessed(): void
    {
        $catalog = app(WorkforceKpiCatalog::class);

        // A real, mapped event — but with no employee on it.
        $translated = $catalog->translate('commerce.order.completed', 'evt-1', [
            'company_id' => 'company-1',
            'net_total' => 5000,
        ]);

        $this->assertNull($translated, 'Crediting commission to a guessed employee would be worse than not collecting it.');
    }

    public function test_the_bridge_records_a_fact_from_a_duck_typed_event(): void
    {
        $company = \Modules\Organization\Companies\Domain\Models\Company::factory()->create();
        $employee = app(\Modules\Hr\Workforce\Domain\Services\EmployeeService::class)
            ->create((string) $company->id, ['first_name' => 'Rep', 'last_name' => 'One']);

        // An anonymous stand-in for an operational domain event — HR knows nothing
        // about its class, only that it answers these three methods.
        $event = new class((string) $company->id, (string) $employee->id)
        {
            public function __construct(private string $companyId, private string $employeeId) {}

            public function eventName(): string
            {
                return 'commerce.order.completed';
            }

            public function eventId(): string
            {
                return 'order-777';
            }

            public function toArray(): array
            {
                return [
                    'company_id' => $this->companyId,
                    'employee_id' => $this->employeeId,
                    'net_total' => 4500,
                    'occurred_at' => '2026-05-10 10:00:00',
                ];
            }
        };

        $this->assertTrue(app(WorkforceKpiSubscriber::class)->consume($event));

        $fact = KpiFact::where('employee_id', $employee->id)->first();
        $this->assertNotNull($fact);
        $this->assertSame(KpiMetric::SalesAmount->value, $fact->metric_key);
        $this->assertSame(4500.0, round((float) $fact->value, 2));

        // Delivered twice, counted once.
        $this->assertTrue(app(WorkforceKpiSubscriber::class)->consume($event));
        $this->assertSame(1, KpiFact::where('employee_id', $employee->id)->count());
    }

    public function test_kpi_facts_reference_operational_documents_opaquely(): void
    {
        $columns = Schema::getColumnListing('hr_kpi_facts');

        // An opaque reference and a module name — never a foreign key into them.
        $this->assertContains('source_reference', $columns);
        $this->assertContains('source_module', $columns);
        $this->assertContains('idempotency_key', $columns);

        foreach (['order_id', 'shipment_id', 'ticket_id', 'product_id'] as $forbidden) {
            $this->assertNotContains($forbidden, $columns, 'Operational ids stay opaque.');
        }
    }

    public function test_deductions_and_incidents_reference_their_evidence_opaquely(): void
    {
        foreach (['hr_deductions' => 'source_reference', 'hr_employee_incidents' => 'related_reference'] as $table => $column) {
            $this->assertContains($column, Schema::getColumnListing($table));
        }
    }

    // ═══ COMMISSION IS CONFIGURED, NOT CODED ═════════════════════════════════════

    public function test_the_commission_engine_names_no_role_or_scheme(): void
    {
        $source = strtolower((string) file_get_contents(
            base_path('Modules/Hr/Compensation/Domain/Services/CommissionEngine.php')
        ));

        // Strip the comments — the docblock legitimately explains the examples.
        $code = (string) preg_replace('#(/\*.*?\*/)|(//.*)#s', '', $source);

        foreach (['sales_representative', 'salesrep', 'driver', 'courier', 'cashier'] as $role) {
            $this->assertStringNotContainsString(
                $role,
                $code,
                'A commission scheme is configuration; the engine must not know about roles.'
            );
        }

        // Nor any hard-coded rate.
        $this->assertDoesNotMatchRegularExpression(
            '/\*\s*0\.0[0-9]+/',
            $code,
            'Rates come from the rule, never from the engine.'
        );
    }

    public function test_every_commission_rule_names_a_metric_the_engine_can_measure(): void
    {
        $columns = Schema::getColumnListing('hr_commission_rules');

        foreach (['metric_key', 'method', 'rate', 'applies_to'] as $expected) {
            $this->assertContains($expected, $columns);
        }

        // The registry is the shared vocabulary between rules, goals and facts.
        $this->assertNotEmpty(KpiMetric::cases());
        $this->assertContains('commerce', KpiMetric::sourceModules());
        $this->assertContains('shipping', KpiMetric::sourceModules());
    }

    // ═══ ONLY DECISIONS MOVE MONEY ═══════════════════════════════════════════════

    public function test_the_calculator_subtracts_only_approved_adjustments(): void
    {
        $source = (string) file_get_contents(
            base_path('Modules/Hr/Compensation/Domain/Services/CompensationCalculator.php')
        );

        // Bonuses and deductions are fetched through the approved-only readers.
        $this->assertStringContainsString('approvedFor(', $source);
        $this->assertStringContainsString('only approved deductions are subtracted', $source);
        $this->assertStringContainsString(
            'indicative only — a deduction is raised and approved, never applied automatically',
            $source
        );
    }

    public function test_attendance_is_reached_through_the_port_and_returns_days_not_money(): void
    {
        $this->assertInstanceOf(
            \Modules\Hr\Attendance\Domain\Services\AbsenceFactsProvider::class,
            app(ProvidesAbsenceFacts::class)
        );

        $contract = (string) file_get_contents(
            base_path('Modules/Hr/Compensation/Domain/Contracts/ProvidesAbsenceFacts.php')
        );

        // The port speaks in days; pricing them is Payroll's job alone.
        $this->assertStringContainsString('unauthorized_absence_days', $contract);
        $this->assertStringContainsString('unpaid_leave_days', $contract);
        foreach (['amount', 'salary', 'rate'] as $forbidden) {
            $this->assertStringNotContainsString(
                "'{$forbidden}'",
                $contract,
                'Attendance counts days; Payroll prices them.'
            );
        }
    }

    // ═══ KPI FACTS ARE APPEND-ONLY ═══════════════════════════════════════════════

    public function test_the_kpi_fact_stream_is_append_only_and_idempotent(): void
    {
        $model = (string) file_get_contents(
            base_path('Modules/Hr/Compensation/Domain/Models/KpiFact.php')
        );

        $this->assertStringContainsString('static::updating(fn () => false)', $model);
        $this->assertStringContainsString('static::deleting(fn () => false)', $model);

        // And the database enforces exactly-once at the key.
        $service = (string) file_get_contents(
            base_path('Modules/Hr/Compensation/Domain/Services/KpiFactService.php')
        );
        $this->assertStringContainsString('idempotency_key', $service);
    }

    public function test_an_unknown_metric_is_refused_rather_than_recorded(): void
    {
        $company = \Modules\Organization\Companies\Domain\Models\Company::factory()->create();

        $event = app(KpiFactService::class)->eventFromPayload((string) $company->id, [
            'metric_key' => 'not.a_real_metric',
            'value' => 100,
        ]);

        $this->assertNull($event, 'A fact HR cannot interpret must not silently become one it can.');
    }

    // ═══ Helpers ═════════════════════════════════════════════════════════════════

    /** @return array<string, string> */
    private function hrSources(): array
    {
        $out = [];

        foreach (['Modules/Hr/Compensation', 'Modules/Hr/Performance'] as $dir) {
            $path = base_path($dir);
            if (! is_dir($path)) {
                continue;
            }

            $it = new \RecursiveIteratorIterator(new \RecursiveDirectoryIterator($path));
            foreach ($it as $file) {
                if ($file->isFile() && $file->getExtension() === 'php') {
                    $out[basename($file->getPathname())] = (string) file_get_contents($file->getPathname());
                }
            }
        }

        return $out;
    }

    /** @return array<int, string> */
    private function hrTables(): array
    {
        $tables = array_map(
            fn ($t) => is_array($t) ? ($t['name'] ?? '') : (string) $t,
            array_map(fn ($t) => is_object($t) ? (array) $t : $t, Schema::getTables())
        );

        return array_values(array_filter($tables, fn (string $t) => str_starts_with($t, 'hr_')));
    }
}
