<?php

declare(strict_types=1);

namespace Modules\Hr\Infrastructure\Providers;

use Illuminate\Support\ServiceProvider;
use Modules\Hr\Attendance\Domain\Services\AbsenceFactsProvider;
use Modules\Hr\Attendance\Domain\Services\AttendanceRegistrationService;
use Modules\Hr\Attendance\Domain\Services\AttendanceSummaryProvider;
use Modules\Hr\Compensation\Application\Bridge\WorkforceKpiCatalog;
use Modules\Hr\Compensation\Application\Bridge\WorkforceKpiSubscriber;
use Modules\Hr\Compensation\Domain\Contracts\ProvidesAbsenceFacts;
use Modules\Hr\Compensation\Domain\Services\AdvanceService;
use Modules\Hr\Compensation\Domain\Services\BonusService;
use Modules\Hr\Compensation\Domain\Services\CommissionEngine;
use Modules\Hr\Compensation\Domain\Services\CommissionRuleService;
use Modules\Hr\Compensation\Domain\Services\Compensation360Service;
use Modules\Hr\Compensation\Domain\Services\CompensationCalculator;
use Modules\Hr\Compensation\Domain\Services\DeductionService;
use Modules\Hr\Compensation\Domain\Services\KpiFactService;
use Modules\Hr\Compensation\Domain\Services\PayrollRunService;
use Modules\Hr\Compensation\Domain\Services\SalaryStructureService;
use Modules\Hr\Performance\Domain\Services\BonusRecommendationService;
use Modules\Hr\Performance\Domain\Services\GoalService;
use Modules\Hr\Performance\Domain\Services\IncidentService;
use Modules\Hr\Performance\Domain\Services\KpiEngine;
use Modules\Hr\Performance\Domain\Services\ManagerReviewService;
use Modules\Hr\Performance\Domain\Services\PerformanceDashboardService;
use Modules\Hr\Performance\Domain\Services\PerformanceEvaluationService;
use Modules\Hr\Attendance\Domain\Services\HolidayService;
use Modules\Hr\Attendance\Domain\Services\LeaveRequestService;
use Modules\Hr\Attendance\Domain\Services\WorkforceAvailabilityService;
use Modules\Hr\Attendance\Domain\Services\WorkScheduleService;
use Modules\Hr\Workforce\Domain\Contracts\ProvidesAttendanceSummary;
use Modules\Hr\Executive\Domain\Services\HrAnalyticsService;
use Modules\Hr\Executive\Domain\Services\HrExecutiveDashboardService;
use Modules\Hr\Recruitment\Domain\Services\ApplicantScoringService;
use Modules\Hr\Recruitment\Domain\Services\ApplicantService;
use Modules\Hr\Recruitment\Domain\Services\EmployeeLifecycleService;
use Modules\Hr\Recruitment\Domain\Services\HiringService;
use Modules\Hr\Recruitment\Domain\Services\InterviewService;
use Modules\Hr\Recruitment\Domain\Services\JobApplicationService;
use Modules\Hr\Recruitment\Domain\Services\JobOpeningService;
use Modules\Hr\Recruitment\Domain\Services\RecruitmentPipelineService;
use Modules\Hr\Workforce\Domain\Policies\EmployeePolicy;
use Modules\Hr\Workforce\Domain\Services\DepartmentService;
use Modules\Hr\Workforce\Domain\Services\Employee360Service;
use Modules\Hr\Workforce\Domain\Services\EmployeeDocumentService;
use Modules\Hr\Workforce\Domain\Services\EmployeeService;
use Modules\Hr\Workforce\Domain\Services\EmploymentContractService;
use Modules\Hr\Workforce\Domain\Services\OrganizationChartService;
use Modules\Hr\Workforce\Domain\Services\ReportingLineService;
use Modules\Hr\Workforce\Domain\Services\WorkforceStructureService;

/**
 * HR & Workforce OS — EPIC H1 + H2.
 *
 * ┌─ EMPLOYEE OWNS IDENTITY · ATTENDANCE OWNS EVENTS ───────────────────────┐
 * │ H1 is the workforce master: organisation structure, the employee record,   │
 * │ contracts and reporting lines. H2 is the operational attendance layer:     │
 * │ calendars, shifts, the daily register and leave.                          │
 * │                                                                           │
 * │ The two meet at exactly one seam. H1 declares the ProvidesAttendanceSummary │
 * │ port for Employee 360 and H2 implements it, bound below — so the workforce │
 * │ domain never names the attendance domain, and attendance calculations stay │
 * │ where they belong. Payroll does not calculate attendance; Finance does not │
 * │ own employees; every other module references an employee by id.           │
 * └─────────────────────────────────────────────────────────────────────────┘
 */
final class HrServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // H1 — Workforce foundation.
        $this->app->singleton(DepartmentService::class);
        $this->app->singleton(WorkforceStructureService::class);
        $this->app->singleton(EmployeeService::class);
        $this->app->singleton(EmploymentContractService::class);
        $this->app->singleton(ReportingLineService::class);
        $this->app->singleton(OrganizationChartService::class);
        $this->app->singleton(EmployeeDocumentService::class);
        $this->app->singleton(Employee360Service::class);
        $this->app->singleton(EmployeePolicy::class);

        // H2 — Attendance and availability.
        $this->app->singleton(HolidayService::class);
        $this->app->singleton(WorkScheduleService::class);
        $this->app->singleton(AttendanceRegistrationService::class);
        $this->app->singleton(LeaveRequestService::class);
        $this->app->singleton(WorkforceAvailabilityService::class);

        // The seams between the contexts: the asking side names an interface, the
        // answering side is bound here and nowhere else.
        $this->app->bind(ProvidesAttendanceSummary::class, AttendanceSummaryProvider::class);
        $this->app->bind(ProvidesAbsenceFacts::class, AbsenceFactsProvider::class);

        // H3 — Compensation engine.
        $this->app->singleton(KpiFactService::class);
        $this->app->singleton(SalaryStructureService::class);
        $this->app->singleton(CommissionRuleService::class);
        $this->app->singleton(CommissionEngine::class);
        $this->app->singleton(BonusService::class);
        $this->app->singleton(DeductionService::class);
        $this->app->singleton(AdvanceService::class);
        $this->app->singleton(CompensationCalculator::class);
        $this->app->singleton(PayrollRunService::class);
        $this->app->singleton(Compensation360Service::class);
        $this->app->singleton(WorkforceKpiCatalog::class);
        $this->app->singleton(WorkforceKpiSubscriber::class);

        // H4 — Performance and incentives.
        $this->app->singleton(KpiEngine::class);
        $this->app->singleton(GoalService::class);
        $this->app->singleton(PerformanceEvaluationService::class);
        $this->app->singleton(PerformanceDashboardService::class);
        $this->app->singleton(ManagerReviewService::class);
        $this->app->singleton(BonusRecommendationService::class);
        $this->app->singleton(IncidentService::class);

        // H5 — Recruitment, hiring and employee lifecycle.
        $this->app->singleton(RecruitmentPipelineService::class);
        $this->app->singleton(JobOpeningService::class);
        $this->app->singleton(ApplicantService::class);
        $this->app->singleton(ApplicantScoringService::class);
        $this->app->singleton(JobApplicationService::class);
        $this->app->singleton(InterviewService::class);
        $this->app->singleton(EmployeeLifecycleService::class);
        $this->app->singleton(HiringService::class);

        // H6 — Executive intelligence. Read-only: these own no data.
        $this->app->singleton(HrExecutiveDashboardService::class);
        $this->app->singleton(HrAnalyticsService::class);
    }

    public function boot(): void
    {
        $this->loadMigrationsFrom(__DIR__.'/../../Workforce/Infrastructure/Database/Migrations');
        $this->loadMigrationsFrom(__DIR__.'/../../Attendance/Infrastructure/Database/Migrations');
        $this->loadMigrationsFrom(__DIR__.'/../../Compensation/Infrastructure/Database/Migrations');
        $this->loadMigrationsFrom(__DIR__.'/../../Performance/Infrastructure/Database/Migrations');
        $this->loadMigrationsFrom(__DIR__.'/../../Recruitment/Infrastructure/Database/Migrations');

        $this->registerKpiSubscribers();
    }

    /**
     * Wire the operational event bridge onto the enterprise bus — OFF by default,
     * so existing environments see no behaviour change. Enabling it is a
     * deliberate decision made once employees are mapped to the operational
     * actors that appear on those events; until then, facts arrive through the
     * ingest endpoint instead.
     */
    private function registerKpiSubscribers(): void
    {
        if (! (bool) config('hr.kpi.auto_subscribe', false)) {
            return;
        }

        $busClass = \Modules\Platform\EventPlatform\Application\Services\EnterpriseEventBus::class;

        if (! class_exists($busClass) || ! $this->app->bound($busClass)) {
            return;
        }

        $bus = $this->app->make($busClass);
        $catalog = $this->app->make(WorkforceKpiCatalog::class);

        foreach ($catalog->knownEventNames() as $eventName) {
            $bus->subscribe($eventName, WorkforceKpiSubscriber::class, priority: 300, queue: 'hr-kpi');
        }
    }
}
