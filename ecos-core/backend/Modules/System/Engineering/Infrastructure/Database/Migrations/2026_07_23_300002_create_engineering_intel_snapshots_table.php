<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_intel_snapshots')) {
            return;
        }

        Schema::create('engineering_intel_snapshots', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id');
            $table->string('snapshot_type');
            $table->string('period_label');
            $table->json('metrics');
            $table->timestamp('recorded_at');

            $table->unique(['company_id', 'snapshot_type', 'period_label'], 'intel_snapshots_period_unique');
            $table->index('company_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_intel_snapshots');
    }
};
