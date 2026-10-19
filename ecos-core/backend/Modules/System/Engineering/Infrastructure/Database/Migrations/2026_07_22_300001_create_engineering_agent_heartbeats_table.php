<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Partition by recorded_at (monthly) recommended for high-volume heartbeat data
        Schema::create('engineering_agent_heartbeats', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('agent_id')->index();
            $table->string('status', 50);
            $table->decimal('cpu_percent', 5, 2)->nullable();
            $table->integer('memory_mb_used')->nullable();
            $table->decimal('disk_free_gb', 8, 2)->nullable();
            $table->uuid('current_task_id')->nullable();
            $table->decimal('load_average', 4, 2)->nullable();
            $table->json('extra')->nullable();
            $table->timestamp('recorded_at');

            $table->foreign('agent_id')
                ->references('id')
                ->on('engineering_agents')
                ->cascadeOnDelete();

            $table->index(['agent_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_agent_heartbeats');
    }
};
