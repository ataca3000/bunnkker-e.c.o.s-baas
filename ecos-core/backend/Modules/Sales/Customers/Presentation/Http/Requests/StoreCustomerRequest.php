<?php

declare(strict_types=1);

namespace Modules\Sales\Customers\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

final class StoreCustomerRequest extends FormRequest
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
        return [
            // Commerce context — company_id is injected server-side; only brand_id is accepted from client.
            'brand_id' => [
                'required',
                'uuid',
                Rule::exists('brands', 'id')->where(function ($query): void {
                    $query->where('company_id', $this->user()?->company_id)
                        ->whereNull('deleted_at');
                }),
            ],
            'code'           => ['required', 'string', 'max:50', 'unique:customers,code'],
            'name'           => ['required', 'string', 'max:255'],
            'contact_person' => ['nullable', 'string', 'max:255'],
            'email'          => ['nullable', 'email', 'max:255'],
            'phone'          => ['nullable', 'string', 'max:50'],
            'mobile'         => ['nullable', 'string', 'max:50'],
            'country'        => ['nullable', 'string', 'max:100'],
            'city'           => ['nullable', 'string', 'max:100'],
            'address'        => ['nullable', 'string', 'max:255'],
            'notes'          => ['nullable', 'string', 'max:1000'],
            'is_active'      => ['boolean'],
        ];
    }
}
