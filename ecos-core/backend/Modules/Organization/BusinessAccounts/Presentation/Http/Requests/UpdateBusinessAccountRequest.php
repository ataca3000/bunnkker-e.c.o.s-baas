<?php

declare(strict_types=1);

namespace Modules\Organization\BusinessAccounts\Presentation\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Modules\Organization\Brands\Domain\Models\Brand;
use Modules\Organization\BusinessAccounts\Domain\Models\BusinessAccount;

final class UpdateBusinessAccountRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, array<int, mixed>> */
    public function rules(): array
    {
        return [
            'brand_id' => [
                'nullable',
                'uuid',
                'exists:brands,id',
                function (string $attribute, mixed $value, Closure $fail): void {
                    if ($value === null) {
                        return;
                    }
                    $baId = (string) $this->route('businessAccount');
                    $ba = BusinessAccount::find($baId);
                    if ($ba === null) {
                        return;
                    }
                    $brand = Brand::find($value);
                    if ($brand !== null && $brand->company_id !== $ba->company_id) {
                        $fail('The selected brand does not belong to the account\'s company.');
                    }
                },
            ],
            'name' => ['required', 'string', 'max:255'],
            'provider' => ['required', 'string', 'in:Meta,WooCommerce,Shopify,Amazon,TikTok,Google,Noon,Snapchat,Custom'],
            'status' => ['nullable', 'string', 'in:active,inactive,suspended'],
            'description' => ['nullable', 'string', 'max:2000'],
            'logo' => ['nullable', 'string', 'max:500'],
        ];
    }
}
