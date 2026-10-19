<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OpenSessionRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'company_id' => ['required', 'string', 'uuid'],
            'channel_id' => ['nullable', 'string', 'uuid'],
            'warehouse_id' => ['required', 'string', 'uuid'],
            'device_fingerprint' => ['sometimes', 'string', 'max:255'],
            'device_type' => ['sometimes', 'string', 'max:100'],
        ];
    }
}
