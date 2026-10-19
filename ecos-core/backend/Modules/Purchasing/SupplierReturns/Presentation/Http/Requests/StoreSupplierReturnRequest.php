<?php

declare(strict_types=1);

namespace Modules\Purchasing\SupplierReturns\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreSupplierReturnRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'supplier_id' => ['required', 'uuid', 'exists:suppliers,id'],
            'warehouse_id' => ['required', 'uuid', 'exists:warehouses,id'],
            'purchase_order_id' => ['nullable', 'uuid', 'exists:purchase_orders,id'],
            'goods_receipt_id' => ['nullable', 'uuid', 'exists:goods_receipts,id'],
            'reason' => ['nullable', 'string', 'in:defective,wrong_item,overdelivery,quality_issue,price_discrepancy,expired,damaged,other'],
            'quality_condition' => ['nullable', 'string', 'in:new,used,damaged,expired'],
            'return_date' => ['required', 'date'],
            'expected_credit_date' => ['nullable', 'date'],
            'notes' => ['nullable', 'string', 'max:2000'],
            'internal_notes' => ['nullable', 'string', 'max:2000'],
            'credit_method' => ['nullable', 'string', 'in:credit_note,refund,replacement'],
            'lines' => ['required', 'array', 'min:1'],
            'lines.*.product_id' => ['required', 'uuid', 'exists:products,id'],
            'lines.*.goods_receipt_line_id' => ['nullable', 'uuid'],
            'lines.*.return_quantity' => ['required', 'numeric', 'min:0.0001'],
            'lines.*.unit_cost' => ['required', 'numeric', 'min:0'],
            'lines.*.reason' => ['nullable', 'string', 'max:100'],
            'lines.*.quality_condition' => ['nullable', 'string', 'max:50'],
            'lines.*.notes' => ['nullable', 'string', 'max:500'],
            'lines.*.uom_name_snapshot' => ['nullable', 'string', 'max:50'],
            'lines.*.uom_symbol_snapshot' => ['nullable', 'string', 'max:20'],
            'lines.*.original_received_qty' => ['nullable', 'numeric', 'min:0'],
            'lines.*.original_unit_cost' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
