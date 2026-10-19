<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_resource_usage')) {
            return;
        }

        Schema::create('engineering_resource_usage', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('company_id')->index();
            $table->decimal('cpu_percent', 5, 2)->default(0);
            $table->unsignedInteger('memory_mb_used')->default(0);
            $table->decimal('disk_gb_used', 8, 2)->default(0);
            $table->unsignedSmallInteger('active_workers')->default(0);
            $table->unsignedSmallInteger('idle_workers')->default(0);
            $table->unsignedSmallInteger('failed_workers')->default(0);
            $table->unsignedSmallInteger('queue_length')->default(0);
            $table->unsignedSmallInteger('running_sessions')->default(0);
            $table->unsignedSmallInteger('paused_sessions')->default(0);
            $table->decimal('cluster_utilization_percent', 5, 2)->default(0);
            $table->timestamp('recorded_at');

            $table->index(['company_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_resource_usage');
    }
};
