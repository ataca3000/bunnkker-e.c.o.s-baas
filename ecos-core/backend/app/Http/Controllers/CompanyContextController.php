<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Modules\Organization\Companies\Infrastructure\Repositories\EloquentCompanyRepository;

final class CompanyContextController extends Controller
{
    public function __construct(
        private readonly EloquentCompanyRepository $companies,
    ) {}

    public function __invoke(Request $request): JsonResponse
    {
        $companyId = $request->query('company_id');

        if (! $companyId) {
            return response()->json(['data' => null]);
        }

        $company = $this->companies->findById((string) $companyId);

        if (! $company) {
            return response()->json(['data' => null], 404);
        }

        $currencySymbols = [
            'EGP' => 'E£', 'USD' => '$', 'EUR' => '€', 'GBP' => '£',
            'SAR' => '﷼', 'AED' => 'د.إ', 'KWD' => 'د.ك', 'QAR' => '﷼',
        ];

        $currency = $company->currency ?? 'EGP';

        return response()->json([
            'data' => [
                'id' => $company->id,
                'name' => $company->name,
                'currency' => $currency,
                'currency_symbol' => $currencySymbols[$currency] ?? $currency,
                'timezone' => $company->timezone ?? 'UTC',
                'language' => $company->language ?? 'en',
                'locale' => $company->locale ?? 'en-US',
                'date_format' => $company->date_format ?? 'YYYY-MM-DD',
                'number_format' => $company->number_format ?? '1,234.56',
                'week_start' => $company->week_start ?? 'Monday',
                'fiscal_year_start' => $company->fiscal_year_start?->toDateString(),
                'fiscal_year_end' => $company->fiscal_year_end?->toDateString(),
            ],
        ]);
    }
}
