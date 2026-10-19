<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'preparation_completed_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('preparation_completed_at')->nullable();
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('orders', 'preparation_completed_at')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn('preparation_completed_at');
        });
    }
};
