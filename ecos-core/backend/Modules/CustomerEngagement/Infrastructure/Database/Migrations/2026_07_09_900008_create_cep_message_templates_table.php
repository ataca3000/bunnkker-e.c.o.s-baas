<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_message_templates')) {
            return;
        }

        Schema::create('cep_message_templates', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('channel_provider_id');

            $table->string('template_name');   // WhatsApp template name (approved by Meta)
            $table->string('language_code')->default('en');
            $table->string('category');        // MARKETING | UTILITY | AUTHENTICATION
            $table->string('status');          // APPROVED | PENDING | REJECTED
            $table->json('components');        // header, body, footer, buttons
            $table->json('variables')->nullable();  // placeholders list
            $table->timestamp('approved_at')->nullable();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'status'], 'cep_mt_co_status_idx');
            $table->unique(['channel_provider_id', 'template_name', 'language_code'], 'cep_mt_unique_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_message_templates');
    }
};
