package com.bunkker.ecos.hybridai.host

import android.content.ContentValues
import android.content.Context
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper
import org.json.JSONArray
import org.json.JSONObject
import java.security.MessageDigest
import java.time.Instant

/**
 * Almacén SQLite WAL Local-First para el Modo Host en Android.
 * Resiste apagones o cierres de pantalla y conserva catálogo, ventas pendientes
 * y bitácora SHA-256 encadenada hasta que el Host sobrescriba Firebase.
 */
class BunkkerHostSqliteStore(context: Context) :
    SQLiteOpenHelper(context, DB_NAME, null, DB_VERSION) {

    companion object {
        private const val DB_NAME = "bunkker_host_local.db"
        private const val DB_VERSION = 1

        private const val TABLE_META = "host_meta"
        private const val TABLE_PRODUCTS = "host_products"
        private const val TABLE_SALES = "host_sales_outbox"
        private const val TABLE_AUDIT = "host_audit_log"
    }

    override fun onConfigure(db: SQLiteDatabase) {
        super.onConfigure(db)
        db.enableWriteAheadLogging()
    }

    override fun onCreate(db: SQLiteDatabase) {
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS $TABLE_META (
                meta_key TEXT PRIMARY KEY,
                meta_value TEXT NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS $TABLE_PRODUCTS (
                id TEXT PRIMARY KEY,
                sku TEXT NOT NULL,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER NOT NULL,
                category TEXT NOT NULL,
                estante TEXT NOT NULL,
                fila TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS $TABLE_SALES (
                tx_id TEXT PRIMARY KEY,
                room_code TEXT NOT NULL,
                cashier_role TEXT NOT NULL,
                device_name TEXT NOT NULL,
                items_json TEXT NOT NULL,
                total REAL NOT NULL,
                created_at TEXT NOT NULL,
                synced_to_cloud INTEGER NOT NULL DEFAULT 0
            )
            """.trimIndent()
        )
        db.execSQL(
            """
            CREATE TABLE IF NOT EXISTS $TABLE_AUDIT (
                seq INTEGER PRIMARY KEY AUTOINCREMENT,
                entry_id TEXT NOT NULL,
                actor_role TEXT NOT NULL,
                action TEXT NOT NULL,
                resource_ref TEXT NOT NULL,
                payload_hash TEXT NOT NULL,
                previous_hash TEXT NOT NULL,
                entry_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """.trimIndent()
        )
        seedDefaultDemoCatalogIfEmpty(db)
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        onCreate(db)
    }

    private fun seedDefaultDemoCatalogIfEmpty(db: SQLiteDatabase) {
        val cursor = db.rawQuery("SELECT COUNT(*) FROM $TABLE_PRODUCTS", null)
        val count = cursor.use { if (it.moveToFirst()) it.getInt(0) else 0 }
        if (count > 0) return

        val now = Instant.now().toString()
        val starterItems = listOf(
            LocalProductRecord("prod-lan-01", "SKU-1001", "Kit Punto de Venta Térmico", 1850.0, 14, "Hardware", "A1", "Nivel 1", now),
            LocalProductRecord("prod-lan-02", "SKU-1002", "Lector Código QR Inalámbrico", 890.0, 22, "Escáner", "A2", "Nivel 2", now),
            LocalProductRecord("prod-lan-03", "SKU-1003", "Rollo Térmico 80mm (Pack 10)", 240.0, 48, "Consumibles", "B1", "Nivel 1", now),
            LocalProductRecord("prod-lan-04", "SKU-1004", "Router Wi-Fi Portátil Sucursal", 1290.0, 7, "Redes", "C1", "Nivel 3", now)
        )
        for (p in starterItems) {
            upsertProductInternal(db, p)
        }
    }

    fun getOrCreateMeta(key: String, defaultProvider: () -> String): String {
        val db = writableDatabase
        db.rawQuery("SELECT meta_value FROM $TABLE_META WHERE meta_key = ?", arrayOf(key)).use { c ->
            if (c.moveToFirst()) return c.getString(0)
        }
        val created = defaultProvider()
        setMeta(key, created)
        return created
    }

    fun setMeta(key: String, value: String) {
        val cv = ContentValues().apply {
            put("meta_key", key)
            put("meta_value", value)
        }
        writableDatabase.insertWithOnConflict(TABLE_META, null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    fun bumpHostEpoch(): Long {
        val current = getOrCreateMeta("host_epoch") { "1" }.toLongOrNull() ?: 1L
        val next = current + 1L
        setMeta("host_epoch", next.toString())
        return next
    }

    fun getHostEpoch(): Long = getOrCreateMeta("host_epoch") { "1" }.toLongOrNull() ?: 1L

    fun listProducts(): List<LocalProductRecord> {
        val result = mutableListOf<LocalProductRecord>()
        readableDatabase.rawQuery(
            "SELECT id, sku, name, price, stock, category, estante, fila, updated_at FROM $TABLE_PRODUCTS ORDER BY name ASC",
            null
        ).use { c ->
            while (c.moveToNext()) {
                result.add(
                    LocalProductRecord(
                        id = c.getString(0),
                        sku = c.getString(1),
                        name = c.getString(2),
                        price = c.getDouble(3),
                        stock = c.getInt(4),
                        category = c.getString(5),
                        estante = c.getString(6),
                        fila = c.getString(7),
                        updatedAt = c.getString(8)
                    )
                )
            }
        }
        return result
    }

    fun upsertProduct(record: LocalProductRecord) {
        val db = writableDatabase
        db.beginTransaction()
        try {
            upsertProductInternal(db, record)
            appendAuditInternal(db, "admin", "HOST_PRODUCT_UPSERT", record.id, "${record.sku}:${record.stock}:${record.price}")
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    private fun upsertProductInternal(db: SQLiteDatabase, record: LocalProductRecord) {
        val cv = ContentValues().apply {
            put("id", record.id)
            put("sku", record.sku)
            put("name", record.name)
            put("price", record.price)
            put("stock", record.stock)
            put("category", record.category)
            put("estante", record.estante)
            put("fila", record.fila)
            put("updated_at", record.updatedAt)
        }
        db.insertWithOnConflict(TABLE_PRODUCTS, null, cv, SQLiteDatabase.CONFLICT_REPLACE)
    }

    /**
     * Registra una venta idempotente por `txId`, descuenta inventario de SQLite de forma atómica
     * y encola la operación en `host_sales_outbox` para sincronizar a Firebase al recuperar red.
     */
    fun recordAtomicSale(sale: LocalSaleRecord): Boolean {
        val db = writableDatabase
        db.beginTransaction()
        try {
            db.rawQuery("SELECT 1 FROM $TABLE_SALES WHERE tx_id = ?", arrayOf(sale.txId)).use { c ->
                if (c.moveToFirst()) {
                    db.setTransactionSuccessful()
                    return false // Idempotente: ya procesada
                }
            }

            val itemsArray = JSONArray()
            for (item in sale.items) {
                itemsArray.put(
                    JSONObject().apply {
                        put("productId", item.productId)
                        put("name", item.name)
                        put("qty", item.qty)
                        put("unitPrice", item.unitPrice)
                    }
                )
                db.execSQL(
                    "UPDATE $TABLE_PRODUCTS SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?",
                    arrayOf(item.qty, sale.createdAt, item.productId)
                )
            }

            val cv = ContentValues().apply {
                put("tx_id", sale.txId)
                put("room_code", sale.roomCode)
                put("cashier_role", sale.cashierRole)
                put("device_name", sale.deviceName)
                put("items_json", itemsArray.toString())
                put("total", sale.total)
                put("created_at", sale.createdAt)
                put("synced_to_cloud", if (sale.syncedToCloud) 1 else 0)
            }
            db.insertOrThrow(TABLE_SALES, null, cv)

            appendAuditInternal(
                db,
                sale.cashierRole,
                "HOST_SALE_COMMIT",
                sale.txId,
                "${sale.deviceName}:${sale.total}:${sale.items.size}"
            )
            db.setTransactionSuccessful()
            return true
        } finally {
            db.endTransaction()
        }
    }

    fun listPendingSales(): List<LocalSaleRecord> = querySales("WHERE synced_to_cloud = 0")

    fun listAllSales(): List<LocalSaleRecord> = querySales("")

    private fun querySales(whereClause: String): List<LocalSaleRecord> {
        val out = mutableListOf<LocalSaleRecord>()
        readableDatabase.rawQuery(
            "SELECT tx_id, room_code, cashier_role, device_name, items_json, total, created_at, synced_to_cloud FROM $TABLE_SALES $whereClause ORDER BY created_at ASC",
            null
        ).use { c ->
            while (c.moveToNext()) {
                val parsedItems = mutableListOf<LocalSaleItem>()
                val arr = runCatching { JSONArray(c.getString(4)) }.getOrNull() ?: JSONArray()
                for (i in 0 until arr.length()) {
                    val obj = arr.optJSONObject(i) ?: continue
                    parsedItems.add(
                        LocalSaleItem(
                            productId = obj.optString("productId"),
                            name = obj.optString("name"),
                            qty = obj.optInt("qty", 1),
                            unitPrice = obj.optDouble("unitPrice", 0.0)
                        )
                    )
                }
                out.add(
                    LocalSaleRecord(
                        txId = c.getString(0),
                        roomCode = c.getString(1),
                        cashierRole = c.getString(2),
                        deviceName = c.getString(3),
                        items = parsedItems,
                        total = c.getDouble(5),
                        createdAt = c.getString(6),
                        syncedToCloud = c.getInt(7) == 1
                    )
                )
            }
        }
        return out
    }

    fun markSalesSynced(txIds: List<String>) {
        if (txIds.isEmpty()) return
        val db = writableDatabase
        db.beginTransaction()
        try {
            for (txId in txIds) {
                db.execSQL("UPDATE $TABLE_SALES SET synced_to_cloud = 1 WHERE tx_id = ?", arrayOf(txId))
            }
            db.setTransactionSuccessful()
        } finally {
            db.endTransaction()
        }
    }

    fun getSalesTotals(): Pair<Double, Int> {
        readableDatabase.rawQuery("SELECT COALESCE(SUM(total), 0), COUNT(*) FROM $TABLE_SALES", null).use { c ->
            if (c.moveToFirst()) return c.getDouble(0) to c.getInt(1)
        }
        return 0.0 to 0
    }

    fun getPendingSyncCount(): Int {
        readableDatabase.rawQuery("SELECT COUNT(*) FROM $TABLE_SALES WHERE synced_to_cloud = 0", null).use { c ->
            if (c.moveToFirst()) return c.getInt(0)
        }
        return 0
    }

    fun getLatestAuditHash(): Pair<Long, String> {
        readableDatabase.rawQuery(
            "SELECT seq, entry_hash FROM $TABLE_AUDIT ORDER BY seq DESC LIMIT 1",
            null
        ).use { c ->
            if (c.moveToFirst()) return c.getLong(0) to c.getString(1)
        }
        return 0L to "0".repeat(64)
    }

    private fun appendAuditInternal(
        db: SQLiteDatabase,
        actorRole: String,
        action: String,
        resourceRef: String,
        rawPayload: String
    ) {
        var prevSeq = 0L
        var prevHash = "0".repeat(64)
        db.rawQuery("SELECT seq, entry_hash FROM $TABLE_AUDIT ORDER BY seq DESC LIMIT 1", null).use { c ->
            if (c.moveToFirst()) {
                prevSeq = c.getLong(0)
                prevHash = c.getString(1)
            }
        }
        val now = Instant.now().toString()
        val entryId = "host-aud-${prevSeq + 1}-${System.currentTimeMillis()}"
        val payloadHash = sha256Hex(rawPayload)
        val entryHash = sha256Hex("$entryId|$actorRole|$action|$resourceRef|$payloadHash|$prevHash|$now")

        val cv = ContentValues().apply {
            put("entry_id", entryId)
            put("actor_role", actorRole)
            put("action", action)
            put("resource_ref", resourceRef)
            put("payload_hash", payloadHash)
            put("previous_hash", prevHash)
            put("entry_hash", entryHash)
            put("created_at", now)
        }
        db.insert(TABLE_AUDIT, null, cv)
    }

    fun sha256Hex(input: String): String {
        val bytes = MessageDigest.getInstance("SHA-256").digest(input.toByteArray(Charsets.UTF_8))
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
