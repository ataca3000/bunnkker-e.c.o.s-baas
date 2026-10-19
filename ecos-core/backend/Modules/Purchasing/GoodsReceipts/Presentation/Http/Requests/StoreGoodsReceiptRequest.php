<?php

declare(strict_types=1);

namespace Modules\Purchasing\GoodsReceipts\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentMethod;
use Modules\Purchasing\GoodsReceipts\Domain\Enums\PaymentStatus;

final class StoreGoodsReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, mixed>>
     */
    public function rules(): array
    {
        $paymentStatusValues = array_column(PaymentStatus::cases(), 'value');
        $paymentMethodValues = array_column(PaymentMethod::cases(), 'value');

        return [
            // ── Core ────────────────────────────────────────────────────────
            'purchase_order_id' => ['required', 'uuid', 'exists:purchase_orders,id'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'receipt_date' => ['required', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],

            // ── Supplier invoice ─────────────────────────────────────────────
            'supplier_invoice_number' => ['nullable', 'string', 'max:255'],
            'supplier_invoice_date' => ['nullable', 'date'],
            'invoice_attachment' => ['nullable', 'file', 'mimes:pdf,jpg,jpeg,png', 'max:10240'],

            // ── Invoice financials ───────────────────────────────────────────
            'invoice_total_amount' => ['nullable', 'numeric', 'min:0'],
            'paid_amount' => ['nullable', 'numeric', 'min:0', 'lte:invoice_total_amount'],
            'freight_amount' => ['nullable', 'numeric', 'min:0'],
            'tax_amount' => ['nullable', 'numeric', 'min:0'],
            'additional_costs' => ['nullable', 'numeric', 'min:0'],

            // ── Payment tracking ─────────────────────────────────────────────
            'payment_status' => ['nullable', Rule::in($paymentStatusValues)],
            'payment_method' => ['nullable', Rule::in($paymentMethodValues)],
            'payment_terms_days' => ['nullable', 'integer', 'min:0', 'max:365'],
            'payment_due_date' => ['nullable', 'date'],

            // ── Lines ────────────────────────────────────────────────────────
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.purchase_order_line_id' => ['required', 'uuid', 'exists:purchase_order_lines,id'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.ordered_quantity' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.gross_received_quantity' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.net_received_quantity' => ['required', 'numeric', 'min:0.0001', 'lte:lines.*.gross_received_quantity'],
            'lines.*.unit_price' => ['nullable', 'numeric', 'min:0'],
            'lines.*.notes' => ['nullable', 'string', 'max:2000'],
            'lines.*.weight_photo' => ['nullable', 'file', 'mimes:jpg,jpeg,png', 'max:5120'],
        ];
    }
}
