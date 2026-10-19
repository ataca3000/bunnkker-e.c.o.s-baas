<?php

declare(strict_types=1);

namespace Modules\POS\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class OpenShiftRequest extends FormRequest
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
            'terminal_id' => ['required', 'string', 'uuid'],
            'cashier_id' => ['required', 'string', 'uuid'],
            'opening_cash' => ['required', 'array'],
            'opening_cash.amount' => ['required', 'numeric', 'min:0'],
            'opening_cash.currency' => ['required', 'string', 'size:3'],
        ];
    }
}
