<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Presentation\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Organization\Brands\Domain\Models\Brand;

final class StoreBusinessAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        $companyId = (string) $this->input('company_id');

        return [
            'company_id' => ['required', 'uuid', 'exists:companies,id'],
            'brand_id' => [
                'nullable',
                'uuid',
                'exists:brands,id',
                function (string $attribute, mixed $value, Closure $fail) use ($companyId): void {
                    if ($value === null || $companyId === '') {
                        return;
                    }
                    $brand = Brand::find($value);
                    if ($brand !== null && $brand->company_id !== $companyId) {
                        $fail('The selected brand does not belong to the selected company.');
                    }
                },
            ],
            'name' => ['required', 'string', 'max:255'],
            'provider' => ['required', 'string', 'in:Meta,WooCommerce,Shopify,Amazon,TikTok,Google,Noon,Snapchat,Custom'],
            'code' => [
                'nullable',
                'string',
                'max:20',
                Rule::unique('business_accounts', 'code')->where(
                    fn ($q) => $q->where('company_id', $companyId)->whereNull('deleted_at'),
                ),
            ],
            'status' => ['nullable', 'string', 'in:active,inactive,suspended'],
            'description' => ['nullable', 'string', 'max:2000'],
            'logo' => ['nullable', 'string', 'max:500'],
        ];
    }
}
