<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_agent_logs', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('agent_id');
            $table->uuid('session_id')->nullable();
            $table->string('level', 20);
            $table->text('message');
            $table->json('context')->nullable();
            $table->timestamp('logged_at');

            $table->foreign('agent_id')
                ->references('id')
                ->on('engineering_agents')
                ->cascadeOnDelete();

            $table->index(['agent_id', 'logged_at']);
            $table->index(['session_id', 'logged_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_agent_logs');
    }
};
