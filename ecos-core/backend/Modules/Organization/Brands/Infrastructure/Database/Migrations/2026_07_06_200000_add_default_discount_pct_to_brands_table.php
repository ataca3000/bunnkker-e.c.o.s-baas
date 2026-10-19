<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('brands', 'default_discount_pct')) {
            return;
        }

        Schema::table('brands', function (Blueprint $table): void {
            $table->decimal('default_discount_pct', 8, 4)->nullable()->after('default_markup');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('brands', 'default_discount_pct')) {
            Schema::table('brands', function (Blueprint $table): void {
                $table->dropColumn('default_discount_pct');
            });
        }
    }
};
