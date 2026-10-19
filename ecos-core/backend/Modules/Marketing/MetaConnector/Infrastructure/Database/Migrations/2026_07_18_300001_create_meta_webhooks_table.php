<?php

declare(strict_types=1);

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/*
 * IDEMPOTENT MIGRATION — safe to run in any of these states:
 *
 *  A) Table does not exist                       → creates it normally.
 *  B) Table exists, FK present, unique present   → skips (fully migrated).
 *  C) Table exists, partial state, empty         → drops & recreates cleanly.
 *  D) Table exists, FK missing, has rows         → adds only the missing FK.
 *
 * MySQL note: DATABASE() is used instead of current_schema() (MySQL does not
 * implement current_schema() as a built-in function; it throws FUNCTION
 * ecos_erp.current_schema does not exist at runtime).
 *
 * MySQL note: the compound unique index uses an explicit short name to stay
 * within MySQL's 64-character identifier limit.
 */
return new class extends Migration
{
    private const UNIQUE_IDX = 'mw_conn_objtype_objid_unique';

    public function up(): void
    {
        if (Schema::hasTable('meta_webhooks')) {
            $hasFk = (bool) DB::selectOne(
                "SELECT COUNT(*) AS cnt
                   FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_TYPE = 'FOREIGN KEY'
                    AND TABLE_SCHEMA    = DATABASE()
                    AND TABLE_NAME      = 'meta_webhooks'
                    AND CONSTRAINT_NAME LIKE 'meta_webhooks_marketing_connection%'",
            )?->cnt;

            $hasUnique = (bool) DB::selectOne(
                "SELECT COUNT(*) AS cnt
                   FROM information_schema.TABLE_CONSTRAINTS
                  WHERE CONSTRAINT_TYPE = 'UNIQUE'
                    AND TABLE_SCHEMA    = DATABASE()
                    AND TABLE_NAME      = 'meta_webhooks'
                    AND CONSTRAINT_NAME = '".self::UNIQUE_IDX."'",
            )?->cnt;

            if ($hasFk && $hasUnique) {
                return; // Already fully migrated — nothing to do.
            }

            // Partial state: drop if empty, otherwise patch selectively.
            if (DB::table('meta_webhooks')->count() === 0) {
                Schema::drop('meta_webhooks');
                // Falls through to Schema::create below.
            } else {
                if (! $hasFk) {
                    Schema::table('meta_webhooks', static function (Blueprint $table): void {
                        $table->foreign('marketing_connection_id')
                            ->references('id')->on('marketing_connections')
                            ->onDelete('cascade');
                    });
                }
                if (! $hasUnique) {
                    Schema::table('meta_webhooks', static function (Blueprint $table): void {
                        $table->unique(
                            ['marketing_connection_id', 'object_type', 'object_id'],
                            self::UNIQUE_IDX,
                        );
                    });
                }

                return;
            }
        }

        Schema::create('meta_webhooks', static function (Blueprint $table): void {
            $table->uuid('id')->primary();
            $table->uuid('company_id')->index();
            $table->uuid('marketing_connection_id')->index();

            $table->string('object_type', 50)->index();
            $table->string('object_id', 200)->nullable()->index();

            $table->string('callback_url', 1000);
            $table->text('verify_token');
            $table->json('subscribed_fields');

            $table->string('status', 30)->default('pending_verification')->index();
            $table->timestamp('verified_at')->nullable();
            $table->timestamp('last_delivery_at')->nullable();
            $table->text('last_error')->nullable();
            $table->unsignedSmallInteger('retry_count')->default(0);
            $table->timestamp('last_verified_at')->nullable();

            $table->uuid('created_by')->nullable();
            $table->timestamps();

            $table->foreign('marketing_connection_id')
                ->references('id')->on('marketing_connections')
                ->onDelete('cascade');

            $table->unique(
                ['marketing_connection_id', 'object_type', 'object_id'],
                'mw_conn_objtype_objid_unique',
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('meta_webhooks');
    }
};
