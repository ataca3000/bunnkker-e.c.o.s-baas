<?php

declare(strict_types=1);

namespace Modules\Organization\Brands\Presentation\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

final class BrandTransferAnalyzeRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    /** @return array<string, list<string>> */
    public function rules(): array
    {
        return [
            'target_company_id' => ['required', 'string', 'uuid', 'exists:companies,id'],
        ];
    }
}
