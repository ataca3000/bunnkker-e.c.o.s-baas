<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_routing_rules')) {
            return;
        }

        Schema::create('cep_routing_rules', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');

            $table->string('name');
            $table->unsignedSmallInteger('priority')->default(100); // lower = higher priority
            $table->string('routing_type')->default('auto');         // RoutingType enum

            // Match conditions (JSON array of {field, operator, value})
            $table->json('conditions');

            // Assignment targets
            $table->unsignedBigInteger('assign_to_user_id')->nullable();
            $table->uuid('assign_to_team_id')->nullable();

            // Behaviour
            $table->boolean('apply_sla_policy')->default(false);
            $table->uuid('sla_policy_id')->nullable();
            $table->string('set_priority')->nullable();   // high | medium | low

            $table->boolean('is_active')->default(true);
            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'is_active', 'priority'], 'cep_rr_co_active_pri_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_routing_rules');
    }
};
