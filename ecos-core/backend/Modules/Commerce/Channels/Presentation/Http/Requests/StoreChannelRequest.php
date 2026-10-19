<?php

declare(strict_types=1);

namespace Modules\Commerce\Channels\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Modules\Commerce\Channels\Domain\Enums\ChannelPlatform;

final class StoreChannelRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, mixed>
     */
    public function rules(): array
    {
        $platforms = array_column(ChannelPlatform::cases(), 'value');

        return [
            'brand_id' => ['required', 'uuid', 'exists:brands,id'],
            'business_account_id' => ['nullable', 'uuid', 'exists:business_accounts,id'],
            'code' => ['nullable', 'string', 'max:20'],
            'name' => ['required', 'string', 'max:255'],
            'channel_type' => ['nullable', 'string', Rule::in(['Website', 'Marketplace', 'Social Commerce', 'POS', 'B2B', 'Custom'])],
            'channel_role' => ['nullable', 'string', Rule::in(['Sales', 'Marketplace', 'Social', 'POS', 'Wholesale', 'Internal', 'External'])],
            'platform' => ['required', 'string', Rule::in($platforms)],
            'store_url' => ['required', 'string', 'url', 'max:500'],
            'is_active' => ['boolean'],
            'sync_products' => ['boolean'],
            'sync_prices' => ['boolean'],
            'sync_stock' => ['boolean'],
            'sync_customers' => ['boolean'],
            'consumer_key' => ['nullable', 'string', 'max:500'],
            'consumer_secret' => ['nullable', 'string', 'max:500'],
        ];
    }
}
