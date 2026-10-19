<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('order_events', 'actor_name')) {
            return;
        }

        Schema::table('order_events', function (Blueprint $table) {
            $table->string('actor_name')->nullable()->after('actor_id');
            $table->json('previous_value')->nullable()->after('actor_name');
            $table->json('new_value')->nullable()->after('previous_value');
            $table->string('module', 80)->nullable()->after('new_value');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('order_events', 'actor_name')) {
            return;
        }

        Schema::table('order_events', function (Blueprint $table) {
            $table->dropColumn(['actor_name', 'previous_value', 'new_value', 'module']);
        });
    }
};
