<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('distribution_zones', 'color')) {
            return;
        }

        Schema::table('distribution_zones', function (Blueprint $table): void {
            $table->string('color', 20)->nullable()->after('description');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('distribution_zones', 'color')) {
            return;
        }

        Schema::table('distribution_zones', function (Blueprint $table): void {
            $table->dropColumn('color');
        });
    }
};
