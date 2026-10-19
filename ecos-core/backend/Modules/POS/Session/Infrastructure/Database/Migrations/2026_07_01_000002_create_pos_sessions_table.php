<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_sessions')) {
            return;
        }

        Schema::create('pos_sessions', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('terminal_id');
            $table->uuid('cashier_id');
            $table->string('status', 50)->default('open');
            $table->string('device_fingerprint', 255);
            $table->string('device_type', 50)->default('browser');
            $table->string('ip_address', 45);
            $table->timestamp('opened_at');
            $table->timestamp('suspended_at')->nullable();
            $table->timestamp('closed_at')->nullable();
            $table->json('metadata')->nullable();
            $table->timestamps();

            // Nullable slot that holds terminal_id when the session is Open, NULL otherwise.
            // A standard UNIQUE index on a nullable column allows many NULLs but rejects
            // a second non-NULL duplicate — giving us the "one open session per terminal"
            // invariant on MySQL, MariaDB, and PostgreSQL without partial indexes.
            $table->uuid('terminal_open_lock')->nullable()->unique();

            $table->index('terminal_id');
            $table->index('cashier_id');
            $table->index('status');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_sessions');
    }
};
