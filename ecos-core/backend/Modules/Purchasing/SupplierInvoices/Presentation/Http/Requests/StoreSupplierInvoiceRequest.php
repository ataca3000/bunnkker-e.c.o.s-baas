<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierInvoices\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierInvoiceRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'supplier_invoice_ref' => ['nullable', 'string', 'max:100'],
            'supplier_id' => ['required', 'uuid', 'exists:suppliers,id'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'invoice_date' => ['required', 'date'],
            'due_date' => ['nullable', 'date', 'after_or_equal:invoice_date'],
            'delivery_date' => ['nullable', 'date'],
            'currency' => ['nullable', 'string', 'size:3'],
            'exchange_rate' => ['nullable', 'numeric', 'min:0.000001'],
            'freight_amount' => ['nullable', 'numeric', 'min:0'],
            'additional_costs' => ['nullable', 'numeric', 'min:0'],
            'discount_amount' => ['nullable', 'numeric', 'min:0'],
            'payment_terms' => ['nullable', 'string', 'max:50'],
            'payment_terms_days' => ['nullable', 'integer', 'min:0'],
            'payment_method' => ['nullable', 'string', 'max:30'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.description' => ['nullable', 'string', 'max:255'],
            'lines.*.quantity' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.unit_price' => ['required', 'numeric', 'min:0'],
            'lines.*.tax_rate' => ['nullable', 'numeric', 'min:0', 'max:100'],
            'lines.*.discount_amount' => ['nullable', 'numeric', 'min:0'],
            'lines.*.uom_id_snapshot' => ['nullable', 'string'],
            'lines.*.uom_name_snapshot' => ['nullable', 'string', 'max:50'],
            'lines.*.uom_symbol_snapshot' => ['nullable', 'string', 'max:20'],
            'lines.*.notes' => ['nullable', 'string', 'max:500'],
        ];
    }
}
