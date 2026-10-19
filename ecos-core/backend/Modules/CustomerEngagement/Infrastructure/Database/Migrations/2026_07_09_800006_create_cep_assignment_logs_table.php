<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_assignment_logs')) {
            return;
        }

        Schema::create('cep_assignment_logs', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('cep_conversations')->cascadeOnDelete();
            $table->string('assignee_type');  // agent / team
            $table->uuid('assignee_id');
            $table->uuid('assigned_by')->nullable();
            $table->string('assignment_type');
            $table->string('notes')->nullable();
            $table->timestamp('unassigned_at')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at'], 'cep_al_conv_at_idx');
            $table->index(['assignee_id', 'created_at'], 'cep_al_asgn_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_assignment_logs');
    }
};
