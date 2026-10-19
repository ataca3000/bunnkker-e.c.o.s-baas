<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('cep_channel_providers')) {
            return;
        }

        Schema::create('cep_channel_providers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->uuid('company_id');
            $table->uuid('brand_id')->nullable();

            $table->string('channel');          // whatsapp | messenger | instagram_direct
            $table->string('display_name');
            $table->string('status')->default('inactive');

            // Provider credentials — stored encrypted as JSON
            $table->json('credentials');        // phone_number_id, access_token, etc.
            $table->string('webhook_secret')->nullable();
            $table->string('phone_number')->nullable();     // WhatsApp phone
            $table->string('business_account_id')->nullable();
            $table->string('page_id')->nullable();          // Messenger / Instagram

            $table->timestamp('last_verified_at')->nullable();
            $table->string('last_error')->nullable();

            $table->softDeletes();
            $table->timestamps();

            $table->index(['company_id', 'channel'], 'cep_cp_co_ch_idx');
            $table->index(['status'], 'cep_cp_status_idx');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('cep_channel_providers');
    }
};
