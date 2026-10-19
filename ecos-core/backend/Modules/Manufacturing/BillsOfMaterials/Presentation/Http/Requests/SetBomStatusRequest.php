<?php

declare(strict_types=1);

namespace Modules\Manufacturing\BillsOfMaterials\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

/**
 * The status endpoint accepts one field. Anything else a caller sends is
 * discarded by validated(), which is the point: a status change cannot
 * accidentally become a structural change.
 */
final class SetBomStatusRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /**
     * @return array<string, list<string>>
     */
    public function rules(): array
    {
        return [
            'is_active' => ['required', 'boolean'],
        ];
    }
}
