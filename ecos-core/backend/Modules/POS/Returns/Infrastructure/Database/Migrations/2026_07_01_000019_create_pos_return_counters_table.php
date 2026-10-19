<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pos_return_counters')) {
            return;
        }

        Schema::create('pos_return_counters', function (Blueprint $table): void {
            $table->string('terminal_id', 36);
            $table->date('counter_date');
            $table->unsignedInteger('sequence')->default(0);

            $table->primary(['terminal_id', 'counter_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pos_return_counters');
    }
};
