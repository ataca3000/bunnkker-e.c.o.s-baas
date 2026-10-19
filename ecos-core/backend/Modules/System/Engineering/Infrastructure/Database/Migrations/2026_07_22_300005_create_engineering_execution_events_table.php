<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_execution_events', function (Blueprint $table) {
            $table->bigIncrements('id');
            $table->uuid('session_id');
            $table->string('event_type', 100);
            $table->string('level', 20)->default('info');
            $table->text('message');
            $table->json('context')->nullable();
            $table->timestamp('occurred_at');

            $table->foreign('session_id')
                ->references('id')
                ->on('engineering_execution_sessions')
                ->cascadeOnDelete();

            $table->index(['session_id', 'occurred_at']);
            $table->index(['session_id', 'level']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_execution_events');
    }
};
