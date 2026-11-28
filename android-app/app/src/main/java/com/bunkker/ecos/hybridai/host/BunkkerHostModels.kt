package com.bunkker.ecos.hybridai.host

import java.security.SecureRandom

data class LocalProductRecord(
    val id: String,
    val sku: String,
    val name: String,
    val price: Double,
    val stock: Int,
    val category: String = "General",
    val estante: String = "",
    val fila: String = "",
    val updatedAt: String
)

data class LocalSaleItem(
    val productId: String,
    val name: String,
    val qty: Int,
    val unitPrice: Double
)

data class LocalSaleRecord(
    val txId: String,
    val roomCode: String,
    val cashierRole: String,
    val deviceName: String,
    val items: List<LocalSaleItem>,
    val total: Double,
    val createdAt: String,
    val syncedToCloud: Boolean
)

data class ConnectedClientRecord(
    val clientId: String,
    val deviceName: String,
    val role: String,
    val remoteAddress: String,
    val connectedAt: String
)

data class DiscoveredBunkkerHost(
    val serviceName: String,
    val roomCode: String,
    val branchId: String,
    val branchName: String,
    val hostIp: String,
    val port: Int,
    val hostEpoch: Long,
    val discoveredAt: Long = System.currentTimeMillis()
) {
    val httpBaseUrl: String get() = "http://$hostIp:$port"
    val wsUrl: String get() = "ws://$hostIp:$port/ws/host"
}

data class HostSessionState(
    val isHosting: Boolean = false,
    val isNsdPublished: Boolean = false,
    val roomCode: String = "",
    val branchId: String = "sucursal-movil-1",
    val branchName: String = "Sucursal Móvil BUNKKER",
    val hostIp: String = "127.0.0.1",
    val port: Int = 8765,
    val hostEpoch: Long = 1L,
    val productCount: Int = 0,
    val pendingCloudSyncCount: Int = 0,
    val todaySalesTotal: Double = 0.0,
    val todayOrdersCount: Int = 0,
    val connectedClients: List<ConnectedClientRecord> = emptyList(),
    val lastReconciliationNote: String? = null,
    val errorMessage: String? = null
) {
    val localPortalUrl: String get() = "http://$hostIp:$port"
}

data class HostReconciliationReport(
    val success: Boolean,
    val syncedOrders: Int,
    val overwrittenBranchNode: Boolean,
    val message: String,
    val timestamp: String
)

object RoomCodeGenerator {
    private const val ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"
    private val random = SecureRandom()

    fun generate(): String {
        val sb = StringBuilder("BNK-")
        repeat(4) {
            sb.append(ALPHABET[random.nextInt(ALPHABET.length)])
        }
        return sb.toString()
    }

    fun normalize(raw: String): String {
        val cleaned = raw.uppercase().replace(Regex("[^A-Z0-9]"), "")
        return when {
            cleaned.isEmpty() -> ""
            cleaned.startsWith("BNK") && cleaned.length > 3 -> "BNK-${cleaned.drop(3).take(6)}"
            else -> "BNK-${cleaned.take(6)}"
        }
    }
}
