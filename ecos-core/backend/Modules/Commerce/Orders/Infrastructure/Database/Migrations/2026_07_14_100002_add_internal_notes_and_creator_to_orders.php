<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('orders', 'internal_notes')) {
            return;
        }

        Schema::table('orders', function (Blueprint $table) {
            // Staff-only internal notes — never visible to customers
            $table->text('internal_notes')->nullable()->after('customer_note');
            // Creator audit — stamped at order creation time
            $table->string('created_by_id')->nullable()->after('internal_notes');
            $table->string('created_by_name')->nullable()->after('created_by_id');
            // Status transition audit — updated on every status change
            $table->string('previous_status', 50)->nullable()->after('status');
            $table->string('status_entered_by')->nullable()->after('previous_status');
            $table->timestamp('status_entered_at')->nullable()->after('status_entered_by');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'internal_notes', 'created_by_id', 'created_by_name',
                'previous_status', 'status_entered_by', 'status_entered_at',
            ]);
        });
    }
};
