<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->timestamp('rescheduled_at')->nullable()->after('preparation_completed_at');
            $table->date('next_delivery_date')->nullable()->after('rescheduled_at');
            $table->string('resume_from_status', 50)->nullable()->after('next_delivery_date');
            $table->text('reschedule_reason')->nullable()->after('resume_from_status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table): void {
            $table->dropColumn(['rescheduled_at', 'next_delivery_date', 'resume_from_status', 'reschedule_reason']);
        });
    }
};
