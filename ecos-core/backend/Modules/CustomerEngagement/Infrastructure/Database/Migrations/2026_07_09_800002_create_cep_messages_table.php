<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_messages')) {
            return;
        }

        Schema::create('cep_messages', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignUuid('conversation_id')->constrained('cep_conversations')->cascadeOnDelete();

            $table->string('external_message_id')->nullable();
            $table->string('direction');   // inbound / outbound
            $table->string('message_type')->default('text');

            $table->text('content')->nullable();
            $table->string('media_url')->nullable();
            $table->string('media_type')->nullable();
            $table->unsignedBigInteger('media_size')->nullable();

            $table->string('sender_type');   // customer / agent / system
            $table->uuid('sender_id')->nullable();
            $table->string('sender_name')->nullable();

            $table->boolean('is_read')->default(false);
            $table->boolean('is_deleted')->default(false);

            $table->json('metadata')->nullable();
            $table->timestamp('sent_at');
            $table->timestamp('delivered_at')->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamp('failed_at')->nullable();
            $table->timestamp('created_at')->useCurrent();

            // Indexes (prefix: cep_msg_)
            $table->index(['conversation_id', 'sent_at'], 'cep_msg_conv_at_idx');
            $table->index(['conversation_id', 'is_read'], 'cep_msg_conv_read_idx');
            $table->index(['direction', 'sent_at'], 'cep_msg_dir_at_idx');
            $table->index(['external_message_id'], 'cep_msg_ext_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_messages');
    }
};
