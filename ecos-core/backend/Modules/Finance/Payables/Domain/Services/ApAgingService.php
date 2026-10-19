<?php

declare(strict_types=1);

namespace Modules\Finance\Payables\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Accounts Payable Aging — the AP mirror of AR aging. A read model over open
 * supplier bills; outstanding is total − Σ allocations, computed in one grouped
 * query and bucketed by age at the as-of date. Never stored.
 */
final class ApAgingService
{
    /**
     * @return array{as_of:string, buckets:list<string>, suppliers:list<array<string,mixed>>, totals:array<string,float>}
     */
    public function report(string $companyId, ?Carbon $asOf = null, ?string $supplierId = null): array
    {
        $asOf ??= Carbon::today();

        $allocated = DB::table('finance_payment_allocations')
            ->select('supplier_bill_id', DB::raw('SUM(amount) as allocated'))
            ->groupBy('supplier_bill_id');

        $query = DB::table('finance_supplier_bills as sb')
            ->leftJoinSub($allocated, 'pa', 'pa.supplier_bill_id', '=', 'sb.id')
            ->where('sb.company_id', $companyId)
            ->where('sb.status', 'posted')
            ->whereIn('sb.document_type', ['bill', 'debit_note'])
            ->selectRaw('sb.supplier_id, sb.due_date, sb.bill_date, sb.total, COALESCE(pa.allocated, 0) as allocated');

        if ($supplierId !== null) {
            $query->where('sb.supplier_id', $supplierId);
        }

        $suppliers = [];
        $totals = $this->emptyBuckets();

        foreach ($query->get() as $row) {
            $outstanding = round((float) $row->total - (float) $row->allocated, 4);
            if ($outstanding <= 0.0) {
                continue;
            }

            $bucket = $this->bucketFor($asOf, $row->due_date ?? $row->bill_date);

            $sid = (string) $row->supplier_id;
            $suppliers[$sid] ??= array_merge(['supplier_id' => $sid], $this->emptyBuckets());
            $suppliers[$sid][$bucket] = round($suppliers[$sid][$bucket] + $outstanding, 4);
            $suppliers[$sid]['total'] = round($suppliers[$sid]['total'] + $outstanding, 4);

            $totals[$bucket] = round($totals[$bucket] + $outstanding, 4);
            $totals['total'] = round($totals['total'] + $outstanding, 4);
        }

        return [
            'as_of' => $asOf->toDateString(),
            'buckets' => ['current', '1_30', '31_60', '61_90', '90_plus'],
            'suppliers' => array_values($suppliers),
            'totals' => $totals,
        ];
    }

    /** @return array<string, float> */
    private function emptyBuckets(): array
    {
        return ['current' => 0.0, '1_30' => 0.0, '31_60' => 0.0, '61_90' => 0.0, '90_plus' => 0.0, 'total' => 0.0];
    }

    private function bucketFor(Carbon $asOf, ?string $dueDate): string
    {
        if ($dueDate === null) {
            return 'current';
        }

        $days = Carbon::parse($dueDate)->startOfDay()->diffInDays($asOf->copy()->startOfDay(), false);

        return match (true) {
            $days <= 0 => 'current',
            $days <= 30 => '1_30',
            $days <= 60 => '31_60',
            $days <= 90 => '61_90',
            default => '90_plus',
        };
    }
}
