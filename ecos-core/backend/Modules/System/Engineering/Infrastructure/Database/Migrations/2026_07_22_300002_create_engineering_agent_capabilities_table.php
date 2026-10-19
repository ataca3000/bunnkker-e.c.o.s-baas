<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_agent_capabilities', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('agent_id');
            $table->string('capability_key', 100);
            $table->string('capability_version', 20)->nullable();
            $table->unsignedTinyInteger('proficiency')->default(3);
            $table->timestamps();

            $table->foreign('agent_id')
                ->references('id')
                ->on('engineering_agents')
                ->cascadeOnDelete();

            $table->unique(['agent_id', 'capability_key']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_agent_capabilities');
    }
};
