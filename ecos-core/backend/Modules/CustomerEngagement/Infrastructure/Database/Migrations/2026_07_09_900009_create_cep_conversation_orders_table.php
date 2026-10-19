<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Pivot: tracks all orders/quotes created from a conversation
        if (Schema::hasTable('cep_conversation_orders')) {
            return;
        }

        Schema::create('cep_conversation_orders', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('conversation_id')->index();
            $table->string('entity_type');       // order | quote | lead | invoice
            $table->uuid('entity_id');
            $table->string('entity_code')->nullable();  // ORD-000001
            $table->foreignId('created_by')->constrained('users');
            $table->timestamp('created_at')->useCurrent();

            $table->index(['conversation_id', 'entity_type'], 'cep_co_conv_type_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_conversation_orders');
    }
};
