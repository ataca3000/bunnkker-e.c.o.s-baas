<?php

declare(strict_types=1);

namespace Modules\Purchasing\Suppliers\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * Validation for creating a supplier.
 */
final class StoreSupplierRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, array<int, string>>
     */
    public function rules(): array
    {
        return [
            'code' => ['required', 'string', 'max:50', 'unique:suppliers,code'],
            'name' => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'email' => ['nullable', 'email', 'max:255'],
            'phone' => ['nullable', 'string', 'max:50'],
            'mobile' => ['nullable', 'string', 'max:50'],
            'country' => ['nullable', 'string', 'max:100'],
            'state' => ['nullable', 'string', 'max:100'],
            'city' => ['nullable', 'string', 'max:100'],
            'district' => ['nullable', 'string', 'max:100'],
            'address' => ['nullable', 'string', 'max:255'],
            'google_maps_url' => ['nullable', 'string', 'max:1000'],
            'opening_balance_amount' => ['nullable', 'numeric', 'min:0'],
            'opening_balance_type' => ['nullable', 'in:debit,credit'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'is_active' => ['boolean'],
        ];
    }
}
