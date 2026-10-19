<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('cep_messages', 'delivery_status')) {
            return;
        }

        Schema::table('cep_messages', function (Blueprint $table) {
            $table->string('delivery_status')->default('sent')->after('is_read');
            $table->uuid('reply_to_message_id')->nullable()->after('delivery_status');
            $table->string('template_name')->nullable()->after('reply_to_message_id');
            $table->json('template_params')->nullable()->after('template_name');
            $table->string('reaction_emoji')->nullable()->after('template_params');
            $table->string('provider_error')->nullable()->after('reaction_emoji');

            $table->index(['delivery_status'], 'cep_msg_delivery_idx');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('cep_messages', 'delivery_status')) {
            return;
        }

        Schema::table('cep_messages', function (Blueprint $table) {
            $table->dropColumn(['delivery_status', 'reply_to_message_id', 'template_name', 'template_params', 'reaction_emoji', 'provider_error']);
        });
    }
};
