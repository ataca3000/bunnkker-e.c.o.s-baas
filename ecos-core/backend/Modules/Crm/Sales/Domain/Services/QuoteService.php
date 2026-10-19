<?php

declare(strict_types=1);

namespace Modules\Crm\Sales\Domain\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Modules\Crm\Sales\Domain\Enums\QuoteStatus;
use Modules\Crm\Sales\Domain\Events\QuoteApproved;
use Modules\Crm\Sales\Domain\Events\QuoteCreated;
use Modules\Crm\Sales\Domain\Events\QuoteRejected;
use Modules\Crm\Sales\Domain\Exceptions\SalesException;
use Modules\Crm\Sales\Domain\Models\Quote;
use Modules\Crm\Sales\Domain\Models\QuoteLine;

/**
 * Quotes. Lines reference products by opaque id; totals are derived from the
 * lines and the quote-level discount/tax. A quote is editable only while draft.
 */
final class QuoteService
{
    /**
     * @param  array<string, mixed>  $data
     * @param  list<array{description:string, product_reference?:string, quantity?:float, unit_price?:float, discount?:float}>  $lines
     */
    public function create(string $companyId, array $data, array $lines, ?int $actorId = null): Quote
    {
        return DB::transaction(function () use ($companyId, $data, $lines, $actorId): Quote {
            $quote = Quote::create([
                'company_id' => $companyId,
                'customer_id' => $data['customer_id'] ?? null,
                'opportunity_id' => $data['opportunity_id'] ?? null,
                'quote_number' => $this->number(),
                'status' => QuoteStatus::Draft->value,
                'currency' => $data['currency'] ?? 'EGP',
                'discount' => $data['discount'] ?? 0,
                'tax' => $data['tax'] ?? 0,
                'valid_until' => $data['valid_until'] ?? null,
                'notes' => $data['notes'] ?? null,
                'created_by' => $actorId,
            ]);

            foreach ($lines as $raw) {
                $qty = (float) ($raw['quantity'] ?? 1);
                $price = (float) ($raw['unit_price'] ?? 0);
                $discount = (float) ($raw['discount'] ?? 0);

                QuoteLine::create([
                    'quote_id' => $quote->id,
                    'description' => $raw['description'],
                    'product_reference' => $raw['product_reference'] ?? null,
                    'quantity' => $qty,
                    'unit_price' => $price,
                    'discount' => $discount,
                    'line_total' => round($qty * $price - $discount, 2),
                ]);
            }

            $this->recompute($quote);

            $fresh = $quote->refresh();

            DB::afterCommit(static fn () => event(new QuoteCreated(
                companyId: $companyId,
                quoteId: (string) $fresh->id,
                opportunityId: $fresh->opportunity_id !== null ? (string) $fresh->opportunity_id : null,
                total: $fresh->total !== null ? (float) $fresh->total : null,
                currency: (string) ($fresh->currency ?? 'EGP'),
                actorId: $actorId,
            )));

            return $fresh;
        });
    }

    public function recompute(Quote $quote): Quote
    {
        $subtotal = round((float) $quote->lines()->sum('line_total'), 2);
        $total = round($subtotal - (float) $quote->discount + (float) $quote->tax, 2);
        $quote->update(['subtotal' => $subtotal, 'total' => $total]);

        return $quote->refresh();
    }

    public function send(Quote $quote): Quote
    {
        $quote->update(['status' => QuoteStatus::Sent->value, 'sent_at' => Carbon::now()]);

        return $quote->refresh();
    }

    public function accept(Quote $quote): Quote
    {
        $quote->update(['status' => QuoteStatus::Accepted->value, 'accepted_at' => Carbon::now()]);
        $fresh = $quote->refresh();

        DB::afterCommit(static fn () => event(new QuoteApproved(
            companyId: (string) $fresh->company_id,
            quoteId: (string) $fresh->id,
            opportunityId: $fresh->opportunity_id !== null ? (string) $fresh->opportunity_id : null,
            total: $fresh->total !== null ? (float) $fresh->total : null,
            currency: (string) ($fresh->currency ?? 'EGP'),
        )));

        return $fresh;
    }

    public function reject(Quote $quote): Quote
    {
        $quote->update(['status' => QuoteStatus::Rejected->value]);
        $fresh = $quote->refresh();

        DB::afterCommit(static fn () => event(new QuoteRejected(
            companyId: (string) $fresh->company_id,
            quoteId: (string) $fresh->id,
            opportunityId: $fresh->opportunity_id !== null ? (string) $fresh->opportunity_id : null,
        )));

        return $fresh;
    }

    private function number(): string
    {
        do {
            $number = 'QT-'.strtoupper(substr(str_replace('-', '', (string) Str::uuid()), 0, 8));
        } while (Quote::where('quote_number', $number)->exists());

        return $number;
    }
}
