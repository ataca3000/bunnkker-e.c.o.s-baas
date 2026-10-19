<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_repair_metrics')) {
            return;
        }

        Schema::create('engineering_repair_metrics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id');
            $table->string('metric_type');
            $table->string('metric_key');
            $table->decimal('metric_value', 10, 4);
            $table->json('dimensions')->nullable();
            $table->timestamp('recorded_at');

            $table->index(['company_id', 'metric_type', 'metric_key'], 'eng_repair_metrics_cid_type_key_idx');
            $table->index('recorded_at');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_repair_metrics');
    }
};
