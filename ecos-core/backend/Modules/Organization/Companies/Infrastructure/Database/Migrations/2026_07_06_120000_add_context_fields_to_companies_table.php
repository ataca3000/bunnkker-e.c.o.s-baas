<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('companies', 'locale')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table): void {
            // BCP-47 locale tag (e.g. "en-EG", "ar-EG")
            $table->string('locale', 20)->nullable()->after('language');
            // Date display format token (e.g. "YYYY-MM-DD", "DD/MM/YYYY")
            $table->string('date_format', 20)->nullable()->after('locale');
            // Number grouping style label (e.g. "1,234.56" or "1.234,56")
            $table->string('number_format', 20)->nullable()->after('date_format');
            // First day of the business week
            $table->string('week_start', 15)->nullable()->after('number_format');
            // Fiscal year boundaries (stored as dates, day/month matters, year is illustrative)
            $table->date('fiscal_year_start')->nullable()->after('week_start');
            $table->date('fiscal_year_end')->nullable()->after('fiscal_year_start');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('companies', 'locale')) {
            return;
        }

        Schema::table('companies', function (Blueprint $table): void {
            $table->dropColumn([
                'locale',
                'date_format',
                'number_format',
                'week_start',
                'fiscal_year_start',
                'fiscal_year_end',
            ]);
        });
    }
};
