<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OpenCartRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, mixed> */
    public function rules(): array
    {
        return [
            'session_id' => ['required', 'string', 'uuid'],
            'shift_id' => ['required', 'string', 'uuid'],
            'terminal_id' => ['required', 'string', 'uuid'],
            'cashier_id' => ['required', 'string', 'uuid'],
            'currency' => ['required', 'string', 'size:3'],
            'customer_id' => ['nullable', 'string', 'uuid'],
        ];
    }
}
