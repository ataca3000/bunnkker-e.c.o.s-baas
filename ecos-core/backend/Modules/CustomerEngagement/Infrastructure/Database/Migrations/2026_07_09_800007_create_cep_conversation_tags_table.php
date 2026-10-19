<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_conversation_tags')) {
            return;
        }

        Schema::create('cep_conversation_tags', function (Blueprint $table) {
            $table->id();
            $table->foreignUuid('conversation_id')->constrained('cep_conversations')->cascadeOnDelete();
            $table->string('tag');
            $table->uuid('added_by')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->unique(['conversation_id', 'tag'], 'cep_ct_conv_tag_uniq');
            $table->index(['tag'], 'cep_ct_tag_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_conversation_tags');
    }
};
