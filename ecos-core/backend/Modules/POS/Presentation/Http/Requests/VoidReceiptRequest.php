<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class VoidReceiptRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'reason' => ['nullable', 'string', 'max:500'],
            'cashier_id' => ['required', 'string', 'uuid'],
            'cashier_name' => ['nullable', 'string', 'max:255'],
        ];
    }
}
