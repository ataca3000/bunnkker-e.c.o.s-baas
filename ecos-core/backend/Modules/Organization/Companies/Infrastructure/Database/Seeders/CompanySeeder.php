<?php

declare(strict_types=1);

namespace Modules\Organization\Companies\Infrastructure\Database\Seeders;

use Illuminate\Database\Seeder;
use Modules\Organization\Companies\Domain\Models\Company;

/**
 * Seeds the default sample company (ORG-001).
 */
final class CompanySeeder extends Seeder
{
    public function run(): void
    {
        Company::updateOrCreate(
            ['code' => 'ECOS'],
            [
                'name' => 'ECOS Holding',
                'legal_name' => 'ECOS Holding Company',
                'email' => 'info@ecos.local',
                'currency' => 'EGP',
                'timezone' => 'Africa/Cairo',
                'country' => 'Egypt',
                'city' => 'Cairo',
                'is_active' => true,
            ],
        );
    }
}
