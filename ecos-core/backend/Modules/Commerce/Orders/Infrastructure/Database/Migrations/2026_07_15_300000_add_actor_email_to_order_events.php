<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_events', 'actor_email')) {
            return;
        }

        Schema::table('order_events', function ($table) {
            $table->string('actor_email', 255)->nullable()->after('actor_role');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_events', 'actor_email')) {
            return;
        }

        Schema::table('order_events', function ($table) {
            $table->dropColumn('actor_email');
        });
    }
};
