<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_leads')) {
            return;
        }

        Schema::create('cep_leads', function (Blueprint $table) {
            $table->uuid('id')->primary();

            // Source conversation
            $table->foreignUuid('conversation_id')->nullable()->constrained('cep_conversations')->nullOnDelete();

            // BAE — plain UUID, no FK
            $table->uuid('business_dna_id')->nullable();

            // Business context
            $table->uuid('company_id')->nullable();
            $table->uuid('brand_id')->nullable();
            $table->uuid('channel_id')->nullable();

            // Lead details
            $table->string('customer_name');
            $table->string('customer_phone')->nullable();
            $table->string('customer_email')->nullable();

            $table->string('status')->default('new');
            $table->string('priority')->default('medium');
            $table->unsignedSmallInteger('score')->nullable();

            $table->uuid('assigned_to')->nullable()->index();
            $table->string('source')->nullable();
            $table->text('qualification_notes')->nullable();

            // Conversion tracking
            $table->string('converted_entity_type')->nullable();
            $table->uuid('converted_entity_id')->nullable();

            $table->json('tags')->nullable();
            $table->json('metadata')->nullable();

            $table->timestamp('qualified_at')->nullable();
            $table->timestamp('converted_at')->nullable();
            $table->timestamp('lost_at')->nullable();
            $table->timestamps();

            // Indexes (prefix: cep_ld_)
            $table->index(['status', 'company_id'], 'cep_ld_status_co_idx');
            $table->index(['assigned_to', 'status'], 'cep_ld_asgn_status_idx');
            $table->index(['business_dna_id'], 'cep_ld_dna_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_leads');
    }
};
