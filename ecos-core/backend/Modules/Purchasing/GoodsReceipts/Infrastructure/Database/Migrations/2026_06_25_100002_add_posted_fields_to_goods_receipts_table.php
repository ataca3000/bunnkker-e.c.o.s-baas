<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('goods_receipts', 'posted_by')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->string('posted_by')->nullable()->after('notes');
            $table->timestamp('posted_at')->nullable()->after('posted_by');
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('goods_receipts', 'posted_by')) {
            return;
        }

        Schema::table('goods_receipts', function (Blueprint $table): void {
            $table->dropColumn(['posted_by', 'posted_at']);
        });
    }
};
