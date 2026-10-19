<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_events', 'actor_role')) {
            return;
        }

        Schema::table('order_events', function ($table) {
            $table->string('actor_role', 100)->nullable()->after('actor_name');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_events', 'actor_role')) {
            return;
        }

        Schema::table('order_events', function ($table) {
            $table->dropColumn('actor_role');
        });
    }
};
