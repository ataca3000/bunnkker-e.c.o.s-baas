<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Presentation\Http\Resources;

use Illuminate\Http\Resources\Json\JsonResource;

class SupplierInvoiceResource extends JsonResource
{
    /** @return array<string, mixed> */
    public function toArray($request): array
    {
        return [
            'id' => $this->id,
            'invoice_number' => $this->invoice_number,
            'supplier_invoice_ref' => $this->supplier_invoice_ref,
            'status' => $this->status->value,
            'status_label' => $this->status->label(),
            'status_color' => $this->status->color(),
            'invoice_date' => $this->invoice_date?->toDateString(),
            'due_date' => $this->due_date?->toDateString(),
            'delivery_date' => $this->delivery_date?->toDateString(),
            'currency' => $this->currency,
            'exchange_rate' => (float) $this->exchange_rate,
            'subtotal' => (float) $this->subtotal,
            'tax_total' => (float) $this->tax_total,
            'freight_amount' => (float) $this->freight_amount,
            'additional_costs' => (float) $this->additional_costs,
            'discount_amount' => (float) $this->discount_amount,
            'grand_total' => (float) $this->grand_total,
            'payment_terms' => $this->payment_terms,
            'payment_terms_days' => $this->payment_terms_days,
            'payment_method' => $this->payment_method,
            'notes' => $this->notes,
            'posting_log' => $this->posting_log,
            'posting_error' => $this->posting_error,
            'posted_at' => $this->posted_at?->toIso8601String(),
            'created_at' => $this->created_at?->toIso8601String(),
            'updated_at' => $this->updated_at?->toIso8601String(),
            // Auto-generated documents
            'auto_purchase_id' => $this->auto_purchase_id,
            'auto_receipt_id' => $this->auto_receipt_id,
            // Relations
            'supplier' => $this->whenLoaded('supplier', fn () => [
                'id' => $this->supplier->id,
                'name' => $this->supplier->name,
            ]),
            'warehouse' => $this->whenLoaded('warehouse', fn () => [
                'id' => $this->warehouse->id,
                'name' => $this->warehouse->name,
                'code' => $this->warehouse->code,
            ]),
            'lines' => $this->whenLoaded('lines', fn () => $this->lines->map(fn ($line) => [
                'id' => $line->id,
                'product_id' => $line->product_id,
                'product' => $line->product ? [
                    'id' => $line->product->id,
                    'name' => $line->product->name,
                    'sku' => $line->product->sku,
                ] : null,
                'description' => $line->description,
                'quantity' => (float) $line->quantity,
                'unit_price' => (float) $line->unit_price,
                'tax_rate' => (float) $line->tax_rate,
                'tax_amount' => (float) $line->tax_amount,
                'discount_amount' => (float) $line->discount_amount,
                'line_total' => (float) $line->line_total,
                'landed_unit_cost' => $line->landed_unit_cost !== null ? (float) $line->landed_unit_cost : null,
                'uom_name_snapshot' => $line->uom_name_snapshot,
                'uom_symbol_snapshot' => $line->uom_symbol_snapshot,
            ])->toArray(),
            ),
        ];
    }
}
