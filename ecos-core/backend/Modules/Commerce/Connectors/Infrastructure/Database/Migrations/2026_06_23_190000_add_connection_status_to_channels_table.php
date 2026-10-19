<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('channels', 'connection_status')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->string('connection_status')->default('disconnected')->after('last_sync_at');
            $table->index('connection_status');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('channels', 'connection_status')) {
            return;
        }

        Schema::table('channels', function (Blueprint $table): void {
            $table->dropIndex(['connection_status']);
            $table->dropColumn('connection_status');
        });
    }
};
