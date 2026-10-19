<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('engineering_pipeline_logs', function (Blueprint $table): void {
            $table->string('stage_label', 100)->nullable()->after('stage');
            $table->unsignedSmallInteger('sort_order')->default(0)->after('stage_label');
        });
    }

    public function down(): void
    {
        Schema::table('engineering_pipeline_logs', function (Blueprint $table): void {
            $table->dropColumn(['stage_label', 'sort_order']);
        });
    }
};
