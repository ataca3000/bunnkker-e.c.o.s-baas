<?php

declare(strict_types=1);

namespace Modules\Crm\Executive\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Modules\Crm\Executive\Domain\Support\ExecutivePeriod;
use Modules\Crm\Executive\Domain\Support\ExecutiveThresholds;
use Modules\Crm\Executive\Domain\Support\Metric;
use Modules\Crm\Service\Domain\Enums\TicketStatus;

/**
 * Service desk performance — open workload and SLA attainment.
 *
 * The definition of "open" is taken from C3's own TicketStatus enum rather than
 * restated here, so the executive backlog and the service desk's backlog can
 * never disagree. Everything else is counted from the ticket rows.
 */
final class ServicePerformanceService
{
    /** @return array<string, mixed> */
    public function forPeriod(string $companyId, ExecutivePeriod $period): array
    {
        $open = $this->openWorkload($companyId);
        $sla = $this->slaAttainment($companyId, $period);
        $throughput = $this->throughput($companyId, $period);

        return [
            'open_tickets' => $open['total'],
            'open_by_status' => $open['by_status'],
            'open_by_priority' => $open['by_priority'],
            'unassigned_open' => $open['unassigned'],
            'escalated_open' => $open['escalated'],
            'overdue_open' => $open['overdue'],
            'sla' => $sla,
            'throughput' => $throughput,
        ];
    }

    /** @return array<string, mixed> */
    private function openWorkload(string $companyId): array
    {
        $openStatuses = $this->openStatuses();
        $base = fn () => DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereIn('status', $openStatuses);

        $byStatus = $base()->groupBy('status')->selectRaw('status, count(*) as total')->pluck('total', 'status');
        $byPriority = $base()->groupBy('priority')->selectRaw('priority, count(*) as total')->pluck('total', 'priority');

        $counts = $base()->selectRaw(
            'count(*) as total,'
            .' sum(case when assignee_id is null then 1 else 0 end) as unassigned,'
            .' sum(case when escalation_level > 0 then 1 else 0 end) as escalated'
        )->first();

        $overdue = $base()->whereNotNull('resolution_due_at')
            ->where('resolution_due_at', '<', Carbon::now())->count();

        return [
            'total' => (int) ($counts->total ?? 0),
            'unassigned' => (int) ($counts->unassigned ?? 0),
            'escalated' => (int) ($counts->escalated ?? 0),
            'overdue' => $overdue,
            'by_status' => $byStatus->map(fn ($v) => (int) $v)->all(),
            'by_priority' => $byPriority->map(fn ($v) => (int) $v)->all(),
        ];
    }

    /** @return array<string, mixed> */
    private function slaAttainment(string $companyId, ExecutivePeriod $period): array
    {
        $row = DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])
            ->selectRaw(
                'count(*) as total,'
                .' sum(case when first_response_breached then 1 else 0 end) as first_response_breaches,'
                .' sum(case when resolution_breached then 1 else 0 end) as resolution_breaches'
            )->first();

        $total = (int) ($row->total ?? 0);
        $frBreaches = (int) ($row->first_response_breaches ?? 0);
        $resBreaches = (int) ($row->resolution_breaches ?? 0);

        $frAttainment = $total > 0 ? Metric::rate($total - $frBreaches, $total) : 0.0;
        $resAttainment = $total > 0 ? Metric::rate($total - $resBreaches, $total) : 0.0;

        return [
            'tickets_in_period' => $total,
            'first_response_attainment_percent' => $frAttainment,
            'resolution_attainment_percent' => $resAttainment,
            'first_response_breaches' => $frBreaches,
            'resolution_breaches' => $resBreaches,
            'target_percent' => ExecutiveThresholds::SLA_TARGET_PERCENT,
            'meets_target' => $total > 0 && $resAttainment >= ExecutiveThresholds::SLA_TARGET_PERCENT,
        ];
    }

    /** @return array<string, mixed> */
    private function throughput(string $companyId, ExecutivePeriod $period): array
    {
        $created = DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])->count();

        // Resolution time is averaged in PHP so the metric stays portable across
        // database engines (no vendor-specific timestamp arithmetic).
        $resolved = DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereNotNull('resolved_at')
            ->whereBetween('resolved_at', [$period->start, $period->end])
            ->get(['created_at', 'resolved_at']);

        $hours = $resolved
            ->map(fn ($r) => Carbon::parse($r->created_at)->diffInMinutes(Carbon::parse($r->resolved_at)) / 60)
            ->filter(fn ($h) => $h >= 0);

        $reopened = DB::table('crm_service_tickets')
            ->where('company_id', $companyId)
            ->whereBetween('created_at', [$period->start, $period->end])
            ->where('reopened_count', '>', 0)->count();

        return [
            'tickets_created' => $created,
            'tickets_resolved' => $resolved->count(),
            'average_resolution_hours' => $hours->isEmpty() ? 0.0 : round((float) $hours->avg(), 2),
            'reopened_tickets' => $reopened,
            'reopen_rate_percent' => Metric::rate($reopened, $created),
        ];
    }

    /** @return array<int, string> the open statuses, taken from C3's own definition */
    private function openStatuses(): array
    {
        return array_values(array_map(
            fn (TicketStatus $s) => $s->value,
            array_filter(TicketStatus::cases(), fn (TicketStatus $s) => $s->isOpen())
        ));
    }
}
