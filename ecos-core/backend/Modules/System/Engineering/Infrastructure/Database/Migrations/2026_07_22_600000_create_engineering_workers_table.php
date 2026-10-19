<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('engineering_workers')) {
            return;
        }

        Schema::create('engineering_workers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('name', 200);
            $table->string('worker_type', 50)->default('standard'); // standard|specialist|heavy
            $table->string('status', 50)->default('offline'); // starting|idle|waiting|reserved|preparing|running|paused|completed|failed|recovering|updating|stopping|offline|destroyed
            $table->uuid('current_task_id')->nullable()->index();
            $table->uuid('current_session_id')->nullable();
            $table->string('workspace_base_path', 1000)->nullable();
            $table->string('machine_id', 255)->nullable(); // links to EngineeringAgent.machine_fingerprint
            $table->unsignedSmallInteger('max_concurrent_tasks')->default(1);
            $table->decimal('cpu_limit_percent', 5, 2)->nullable(); // max CPU % this worker may use
            $table->unsignedInteger('memory_limit_mb')->nullable();
            $table->unsignedSmallInteger('disk_limit_gb')->nullable();
            $table->unsignedSmallInteger('max_execution_minutes')->default(60);
            $table->json('capabilities')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamp('last_heartbeat_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('stopped_at')->nullable();
            $table->unsignedInteger('total_tasks_completed')->default(0);
            $table->unsignedInteger('total_tasks_failed')->default(0);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'status']);
            $table->index(['company_id', 'worker_type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_workers');
    }
};
