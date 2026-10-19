<?php

declare(strict_types=1);

namespace Modules\Finance\Receivables\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;

/**
 * Accounts Receivable Aging — a read model over open customer documents.
 *
 * ┌─ DERIVED · NEVER STORED ────────────────────────────────────────────────┐
 * │ Outstanding is total − Σ allocations, computed in one grouped query so it │
 * │ scales to millions of rows without per-document round-trips. Each open     │
 * │ document is bucketed by how long it has been due at the as-of date.        │
 * └──────────────────────────────────────────────────────────────────────────┘
 */
final class ArAgingService
{
    /**
     * @return array{as_of:string, buckets:list<string>, customers:list<array<string,mixed>>, totals:array<string,float>}
     */
    public function report(string $companyId, ?Carbon $asOf = null, ?string $customerId = null): array
    {
        $asOf ??= Carbon::today();

        $allocated = DB::table('finance_receipt_allocations')
            ->select('customer_invoice_id', DB::raw('SUM(amount) as allocated'))
            ->groupBy('customer_invoice_id');

        $query = DB::table('finance_customer_invoices as ci')
            ->leftJoinSub($allocated, 'ra', 'ra.customer_invoice_id', '=', 'ci.id')
            ->where('ci.company_id', $companyId)
            ->where('ci.status', 'posted')
            ->whereIn('ci.document_type', ['invoice', 'debit_note'])
            ->selectRaw('ci.customer_id, ci.due_date, ci.invoice_date, ci.total, COALESCE(ra.allocated, 0) as allocated');

        if ($customerId !== null) {
            $query->where('ci.customer_id', $customerId);
        }

        $customers = [];
        $totals = $this->emptyBuckets();

        foreach ($query->get() as $row) {
            $outstanding = round((float) $row->total - (float) $row->allocated, 4);
            if ($outstanding <= 0.0) {
                continue;
            }

            $bucket = $this->bucketFor($asOf, $row->due_date ?? $row->invoice_date);

            $cid = (string) $row->customer_id;
            $customers[$cid] ??= array_merge(['customer_id' => $cid], $this->emptyBuckets());
            $customers[$cid][$bucket] = round($customers[$cid][$bucket] + $outstanding, 4);
            $customers[$cid]['total'] = round($customers[$cid]['total'] + $outstanding, 4);

            $totals[$bucket] = round($totals[$bucket] + $outstanding, 4);
            $totals['total'] = round($totals['total'] + $outstanding, 4);
        }

        return [
            'as_of' => $asOf->toDateString(),
            'buckets' => ['current', '1_30', '31_60', '61_90', '90_plus'],
            'customers' => array_values($customers),
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
