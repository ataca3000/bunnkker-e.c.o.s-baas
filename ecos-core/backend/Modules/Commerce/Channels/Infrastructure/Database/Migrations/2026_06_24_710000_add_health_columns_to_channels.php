<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('channels', 'last_webhook_received_at')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->timestamp('last_webhook_received_at')->nullable()->after('last_sync_at');
            $table->timestamp('last_successful_sync_at')->nullable()->after('last_webhook_received_at');
            $table->timestamp('last_error_at')->nullable()->after('last_successful_sync_at');
            $table->text('last_error_message')->nullable()->after('last_error_at');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('channels', 'last_webhook_received_at')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropColumn([
                'last_webhook_received_at',
                'last_successful_sync_at',
                'last_error_at',
                'last_error_message',
            ]);
        });
    }
};
