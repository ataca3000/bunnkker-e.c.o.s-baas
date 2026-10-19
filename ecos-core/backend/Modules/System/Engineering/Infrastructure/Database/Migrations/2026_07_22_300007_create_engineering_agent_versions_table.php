<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_agent_versions', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('agent_id');
            $table->string('version', 20);
            $table->text('changelog')->nullable();
            $table->boolean('is_current')->default(false);
            $table->timestamp('released_at');
            $table->timestamps();

            $table->foreign('agent_id')
                ->references('id')
                ->on('engineering_agents')
                ->cascadeOnDelete();

            $table->index(['agent_id', 'is_current']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_agent_versions');
    }
};
