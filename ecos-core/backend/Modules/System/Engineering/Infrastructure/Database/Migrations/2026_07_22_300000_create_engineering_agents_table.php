<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('engineering_agents', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->string('name', 200);
            $table->string('agent_type', 50)->default('standard');
            $table->string('api_key_hash', 255);
            $table->string('status', 50)->default('unregistered');
            $table->string('machine_fingerprint', 255)->nullable();
            $table->string('os_info', 255)->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->string('version', 20)->nullable();
            $table->json('capabilities')->nullable();
            $table->json('platform_info')->nullable();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamp('registered_at')->nullable();
            $table->timestamp('deregistered_at')->nullable();
            $table->uuid('created_by_id')->nullable();
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'status']);
            $table->index('api_key_hash');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('engineering_agents');
    }
};
