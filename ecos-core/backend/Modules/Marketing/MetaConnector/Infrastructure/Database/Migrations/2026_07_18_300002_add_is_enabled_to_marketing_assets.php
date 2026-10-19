<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('marketing_assets', 'is_enabled')) {
            return;
        }

        Schema::table('marketing_assets', function (Blueprint $table): void {
            // Per-asset enable/disable for selective sync and dashboard visibility.
            // Default true — existing discovered assets remain active.
            $table->boolean('is_enabled')->default(true)->after('status');
            $table->index('is_enabled');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('marketing_assets', 'is_enabled')) {
            return;
        }

        Schema::table('marketing_assets', function (Blueprint $table): void {
            $table->dropColumn('is_enabled');
        });
    }
};
