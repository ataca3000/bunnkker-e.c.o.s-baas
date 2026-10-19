<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEX_NAME = 'customers_company_phone_unique';

    public function up(): void
    {
        if ($this->indexExists()) {
            return;
        }

        // Detect pre-existing duplicates — constraint cannot be added over them.
        $hasDuplicates = DB::table('customers')
            ->select(DB::raw('COUNT(*) as cnt'))
            ->whereNotNull('phone')
            ->whereNull('deleted_at')
            ->groupBy('company_id', 'phone')
            ->havingRaw('COUNT(*) > 1')
            ->exists();

        if ($hasDuplicates) {
            Log::warning(
                'Migration ' . self::INDEX_NAME . ': duplicate (company_id, phone) rows detected. ' .
                'Constraint skipped — resolve duplicates manually before re-running this migration.',
            );
            return;
        }

        // MySQL treats NULL as distinct in unique indexes, so nullable phone is safe:
        // multiple customers with phone=NULL are allowed; same non-null phone is rejected.
        Schema::table('customers', function (Blueprint $table): void {
            $table->unique(['company_id', 'phone'], self::INDEX_NAME);
        });
    }

    public function down(): void
    {
        if ($this->indexExists()) {
            Schema::table('customers', function (Blueprint $table): void {
                $table->dropUnique(self::INDEX_NAME);
            });
        }
    }

    private function indexExists(): bool
    {
        return collect(Schema::getIndexes('customers'))
            ->contains('name', self::INDEX_NAME);
    }
};
