<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_sla_violations')) {
            return;
        }

        Schema::create('cep_sla_violations', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('cep_conversations')->cascadeOnDelete();
            $table->foreignUuid('sla_policy_id')->constrained('cep_sla_policies')->cascadeOnDelete();

            $table->string('violation_type');  // first_response / resolution
            $table->string('status')->default('pending');  // pending / breached / resolved

            $table->timestamp('due_at');
            $table->timestamp('breached_at')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();

            // Indexes (prefix: cep_slav_)
            $table->index(['conversation_id'], 'cep_slav_conv_idx');
            $table->index(['status', 'due_at'], 'cep_slav_status_due_idx');
            $table->index(['violation_type', 'status'], 'cep_slav_type_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_sla_violations');
    }
};
