<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_private_notes')) {
            return;
        }

        Schema::create('cep_private_notes', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('cep_conversations')->cascadeOnDelete();
            $table->uuid('author_id');
            $table->string('author_type')->default('user');
            $table->text('content');
            $table->json('mentioned_user_ids')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            $table->index(['conversation_id', 'created_at'], 'cep_pn_conv_at_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_private_notes');
    }
};
