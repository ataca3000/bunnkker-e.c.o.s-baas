<?php

declare(strict_types=1);

namespace Modules\Finance\Presentation\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Validation\Rule;
use Modules\Finance\Tax\Domain\Models\TaxCategory;
use Modules\Finance\Tax\Domain\Models\TaxCode;
use Modules\Finance\Tax\Domain\Services\TaxService;

class TaxController extends Controller
{
    public function __construct(private readonly TaxService $tax) {}

    public function categories(Request $request): JsonResponse
    {
        $rows = TaxCategory::query()->where('company_id', $this->companyId($request))->orderBy('code')->get()
            ->map(fn (TaxCategory $c) => [
                'id' => $c->uuid, 'code' => $c->code, 'name' => $c->name,
                'is_recoverable' => $c->is_recoverable, 'is_active' => $c->is_active,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function storeCategory(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:200'],
            'name_ar' => ['nullable', 'string', 'max:200'],
            'is_recoverable' => ['nullable', 'boolean'],
        ]);
        $validated['company_id'] = $this->companyId($request);

        $category = $this->tax->createCategory($validated);

        return response()->json(['data' => ['id' => $category->uuid, 'code' => $category->code]], 201);
    }

    public function codes(Request $request): JsonResponse
    {
        $rows = TaxCode::query()->where('company_id', $this->companyId($request))->orderBy('code')->get()
            ->map(fn (TaxCode $c) => [
                'id' => $c->uuid, 'code' => $c->code, 'name' => $c->name,
                'tax_type' => $c->tax_type, 'rate' => (float) $c->rate,
                'is_recoverable' => $c->is_recoverable, 'is_active' => $c->is_active,
            ]);

        return response()->json(['data' => $rows]);
    }

    public function storeCode(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'tax_category_id' => ['required', 'integer', 'exists:finance_tax_categories,id'],
            'code' => ['required', 'string', 'max:40'],
            'name' => ['required', 'string', 'max:200'],
            'tax_type' => ['nullable', Rule::in(['vat', 'withholding', 'other'])],
            'rate' => ['required', 'numeric', 'min:0', 'max:100'],
            'is_recoverable' => ['nullable', 'boolean'],
            'input_account_id' => ['nullable', 'integer', 'exists:finance_accounts,id'],
            'output_account_id' => ['nullable', 'integer', 'exists:finance_accounts,id'],
        ]);
        $validated['company_id'] = $this->companyId($request);

        $code = $this->tax->createCode($validated);

        return response()->json(['data' => ['id' => $code->uuid, 'code' => $code->code]], 201);
    }

    private function companyId(Request $request): string
    {
        return (string) $request->user()->company_id;
    }
}
