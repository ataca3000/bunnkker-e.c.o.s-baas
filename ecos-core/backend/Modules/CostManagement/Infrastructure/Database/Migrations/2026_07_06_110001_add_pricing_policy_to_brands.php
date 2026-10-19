<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('brands', 'default_target_margin')) {
            return;
        }

        Schema::table('brands', function (Blueprint $table): void {
            $table->decimal('default_target_margin', 8, 4)->nullable()->after('is_active');
            $table->decimal('default_markup', 8, 4)->nullable()->after('default_target_margin');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('brands', 'default_target_margin')) {
            return;
        }

        Schema::table('brands', function (Blueprint $table): void {
            $table->dropColumn(['default_target_margin', 'default_markup']);
        });
    }
};
