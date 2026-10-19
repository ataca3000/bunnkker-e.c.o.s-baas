<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public bool $timestamps = false;

    public function up(): void
    {
        if (Schema::hasTable('engineering_cluster_metrics')) {
            return;
        }

        Schema::create('engineering_cluster_metrics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->string('metric_type', 100); // cpu|memory|disk|workers_active|queue_length|throughput|error_rate
            $table->decimal('value', 12, 4);
            $table->string('unit', 20)->nullable(); // percent|mb|gb|count|tasks_per_hour
            $table->json('dimensions')->nullable(); // tags like {worker_id, node_id}
            $table->timestamp('recorded_at');

            // Explicit short names: the auto-generated identifiers exceed
            // MySQL's 64-character limit for this table.
            $table->index(['company_id', 'metric_type', 'recorded_at'], 'eng_cluster_metrics_cid_type_time_idx');
            $table->index(['company_id', 'recorded_at'], 'eng_cluster_metrics_cid_time_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_cluster_metrics');
    }
};
