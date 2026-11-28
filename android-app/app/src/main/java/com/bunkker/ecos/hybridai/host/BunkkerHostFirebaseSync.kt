package com.bunkker.ecos.hybridai.host

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.google.firebase.Firebase
import com.google.firebase.auth.auth
import com.google.firebase.firestore.FieldValue
import com.google.firebase.firestore.SetOptions
import com.google.firebase.firestore.firestore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.coroutines.withContext
import java.time.Instant
import kotlin.coroutines.resume

/**
 * Reconciliador Host-Authoritative hacia Firebase Firestore.
 * Política confirmada: al volver Internet, el dispositivo Host manda sobre todo
 * y sobrescribe el estado previo del nodo de sucursal en Firebase Firestore.
 */
class BunkkerHostFirebaseSync(
    private val context: Context,
    private val store: BunkkerHostSqliteStore
) {
    fun hasInternet(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    suspend fun syncHostAuthoritativeToFirebase(
        branchId: String,
        branchName: String,
        roomCode: String
    ): HostReconciliationReport = withContext(Dispatchers.IO) {
        val now = Instant.now().toString()
        if (!hasInternet()) {
            return@withContext HostReconciliationReport(
                success = false,
                syncedOrders = 0,
                overwrittenBranchNode = false,
                message = "Sin salida a Internet. Las ventas permanecen seguras en SQLite WAL del Host.",
                timestamp = now
            )
        }

        val currentUser = runCatching { Firebase.auth.currentUser }.getOrNull()
        if (currentUser == null) {
            return@withContext HostReconciliationReport(
                success = false,
                syncedOrders = 0,
                overwrittenBranchNode = false,
                message = "Inicia sesión verificada en Firebase en este dispositivo para sobrescribir la nube.",
                timestamp = now
            )
        }

        val pendingSales = store.listPendingSales()
        val (todaySales, todayOrders) = store.getSalesTotals()
        val safeBranchId = branchId.replace(Regex("[^a-zA-Z0-9_-]"), "-").take(64).ifBlank { "sucursal-movil-1" }
        val epoch = store.getHostEpoch()
        val (auditSeq, latestHash) = store.getLatestAuditHash()

        val firestore = Firebase.firestore
        val batch = firestore.batch()

        val branchDocRef = firestore.collection("branch_nodes").document(safeBranchId)
        val branchPayload = hashMapOf(
            "branchId" to safeBranchId,
            "ownerUid" to currentUser.uid,
            "name" to branchName.take(120),
            "code" to roomCode.take(24),
            "region" to "Android Host LAN (Epoch $epoch)",
            "status" to "online",
            "isolationMode" to "isolated_local_first",
            "pendingSyncCount" to 0,
            "todaySales" to todaySales,
            "todayOrders" to todayOrders,
            "subscriptionTier" to "PRO",
            "createdAt" to FieldValue.serverTimestamp(),
            "updatedAt" to FieldValue.serverTimestamp()
        )
        batch.set(branchDocRef, branchPayload, SetOptions.merge())

        val entryId = "host-sync-$safeBranchId-${System.currentTimeMillis()}"
        val auditDocRef = firestore.collection("immutable_audit_chain").document(entryId)
        val payloadHash = store.sha256Hex("$safeBranchId|$epoch|$todaySales|$todayOrders|${pendingSales.size}")
        val entryHash = store.sha256Hex("$entryId|$payloadHash|$latestHash|$now")

        val auditPayload = hashMapOf(
            "entryId" to entryId,
            "ownerUid" to currentUser.uid,
            "branchId" to safeBranchId,
            "actorId" to currentUser.uid,
            "actorRole" to "android_host",
            "action" to "HOST_AUTHORITATIVE_OVERWRITE",
            "resourceRef" to "branch_nodes/$safeBranchId",
            "payloadHash" to payloadHash,
            "previousHash" to latestHash.padEnd(64, '0').take(64),
            "entryHash" to entryHash,
            "sequence" to (auditSeq + 1L).coerceAtLeast(1L),
            "createdAt" to FieldValue.serverTimestamp()
        )
        batch.set(auditDocRef, auditPayload)

        val commitResult = suspendCancellableCoroutine<Result<Unit>> { cont ->
            batch.commit()
                .addOnSuccessListener { if (cont.isActive) cont.resume(Result.success(Unit)) }
                .addOnFailureListener { ex -> if (cont.isActive) cont.resume(Result.failure(ex)) }
        }

        if (commitResult.isSuccess) {
            store.markSalesSynced(pendingSales.map { it.txId })
            store.setMeta("last_cloud_sync_at", now)
            HostReconciliationReport(
                success = true,
                syncedOrders = pendingSales.size,
                overwrittenBranchNode = true,
                message = "Host sobrescribió Firebase Firestore (Epoch $epoch · ${pendingSales.size} ventas consolidadas).",
                timestamp = now
            )
        } else {
            HostReconciliationReport(
                success = false,
                syncedOrders = 0,
                overwrittenBranchNode = false,
                message = commitResult.exceptionOrNull()?.message
                    ?: "Error escribiendo lote Host-Authoritative en Firestore.",
                timestamp = now
            )
        }
    }
}
