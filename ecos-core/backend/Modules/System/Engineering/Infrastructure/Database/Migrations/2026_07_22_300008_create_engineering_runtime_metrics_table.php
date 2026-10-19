<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_runtime_metrics', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('session_id');
            $table->uuid('agent_id');
            $table->string('metric_key', 100);
            $table->decimal('metric_value', 12, 4);
            $table->string('metric_unit', 20)->nullable();
            $table->timestamp('recorded_at');

            $table->foreign('session_id')
                ->references('id')
                ->on('engineering_execution_sessions')
                ->cascadeOnDelete();

            $table->foreign('agent_id')
                ->references('id')
                ->on('engineering_agents')
                ->cascadeOnDelete();

            $table->index(['session_id', 'metric_key']);
            $table->index(['agent_id', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_runtime_metrics');
    }
};
