package com.bunkker.ecos.hybridai.host

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.net.Inet4Address
import java.net.NetworkInterface
import java.time.Instant
import java.util.UUID

/**
 * Puente reactivo global para que Jetpack Compose muestre en tiempo real el estado
 * del Modo Host LAN, código de sala BNK-XXXX, clientes conectados y sincronización a Firebase.
 */
object BunkkerHostRuntime {
    private val _sessionState = MutableStateFlow(HostSessionState())
    val sessionState: StateFlow<HostSessionState> = _sessionState.asStateFlow()

    private val _discoveredHosts = MutableStateFlow<List<DiscoveredBunkkerHost>>(emptyList())
    val discoveredHosts: StateFlow<List<DiscoveredBunkkerHost>> = _discoveredHosts.asStateFlow()

    private var discoveryClient: BunkkerNsdDiscoveryManager? = null

    fun updateState(transform: (HostSessionState) -> HostSessionState) {
        _sessionState.value = transform(_sessionState.value)
    }

    fun startLanScan(context: Context, onError: ((String) -> Unit)? = null) {
        val mgr = discoveryClient ?: BunkkerNsdDiscoveryManager(context.applicationContext).also {
            discoveryClient = it
        }
        mgr.startDiscovery(onError)
        CoroutineScope(Dispatchers.Main.immediate).launch {
            mgr.discoveredHosts.collect { list ->
                _discoveredHosts.value = list
            }
        }
    }

    fun stopLanScan() {
        discoveryClient?.stopDiscovery()
    }

    fun startHostService(context: Context, branchName: String = "Sucursal Móvil BUNKKER") {
        val intent = Intent(context, BunkkerHostService::class.java).apply {
            action = BunkkerHostService.ACTION_START_HOST
            putExtra(BunkkerHostService.EXTRA_BRANCH_NAME, branchName)
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent)
        } else {
            context.startService(intent)
        }
    }

    fun stopHostService(context: Context) {
        val intent = Intent(context, BunkkerHostService::class.java).apply {
            action = BunkkerHostService.ACTION_STOP_HOST
        }
        context.startService(intent)
    }

    fun triggerFirebaseOverwrite(context: Context) {
        val intent = Intent(context, BunkkerHostService::class.java).apply {
            action = BunkkerHostService.ACTION_SYNC_FIREBASE
        }
        context.startService(intent)
    }

    fun recordQuickDemoSale(context: Context) {
        val store = BunkkerHostSqliteStore(context.applicationContext)
        val products = store.listProducts()
        val first = products.firstOrNull() ?: return
        val room = _sessionState.value.roomCode.ifBlank {
            store.getOrCreateMeta("room_code") { RoomCodeGenerator.generate() }
        }
        store.recordAtomicSale(
            LocalSaleRecord(
                txId = "host-pos-${UUID.randomUUID().toString().take(8)}",
                roomCode = room,
                cashierRole = "admin_host",
                deviceName = "Dispositivo Host Android",
                items = listOf(LocalSaleItem(first.id, first.name, 1, first.price)),
                total = first.price,
                createdAt = Instant.now().toString(),
                syncedToCloud = false
            )
        )
        val (todaySales, todayOrders) = store.getSalesTotals()
        updateState {
            it.copy(
                productCount = store.listProducts().size,
                pendingCloudSyncCount = store.getPendingSyncCount(),
                todaySalesTotal = todaySales,
                todayOrdersCount = todayOrders
            )
        }
    }
}

/**
 * Foreground Service permanente que mantiene vivo el Modo Host LAN en Android
 * (NsdManager + HTTP/WebSocket Server + SQLite WAL).
 */
class BunkkerHostService : Service() {

    companion object {
        const val ACTION_START_HOST = "com.bunkker.ecos.ACTION_START_HOST"
        const val ACTION_STOP_HOST = "com.bunkker.ecos.ACTION_STOP_HOST"
        const val ACTION_SYNC_FIREBASE = "com.bunkker.ecos.ACTION_SYNC_FIREBASE"
        const val EXTRA_BRANCH_NAME = "branch_name"

        private const val CHANNEL_ID = "bunkker_host_lan_channel"
        private const val NOTIFICATION_ID = 8765
        private const val HOST_PORT = 8765
    }

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var store: BunkkerHostSqliteStore
    private lateinit var nsdManager: BunkkerNsdDiscoveryManager
    private lateinit var lanServer: BunkkerLanHttpWsServer
    private lateinit var firebaseSync: BunkkerHostFirebaseSync

    override fun onCreate() {
        super.onCreate()
        store = BunkkerHostSqliteStore(applicationContext)
        nsdManager = BunkkerNsdDiscoveryManager(applicationContext)
        lanServer = BunkkerLanHttpWsServer(store, HOST_PORT) { refreshRuntimeState() }
        firebaseSync = BunkkerHostFirebaseSync(applicationContext, store)
        ensureNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP_HOST -> {
                nsdManager.unregisterHostService()
                lanServer.stop()
                BunkkerHostRuntime.updateState {
                    it.copy(isHosting = false, isNsdPublished = false, connectedClients = emptyList())
                }
                stopForeground(STOP_FOREGROUND_REMOVE)
                stopSelf()
                return START_NOT_STICKY
            }
            ACTION_SYNC_FIREBASE -> {
                scope.launch {
                    val state = BunkkerHostRuntime.sessionState.value
                    val report = firebaseSync.syncHostAuthoritativeToFirebase(
                        branchId = state.branchId,
                        branchName = state.branchName,
                        roomCode = state.roomCode
                    )
                    refreshRuntimeState(reconciliationNote = report.message)
                }
                return START_STICKY
            }
            else -> {
                val branchName = intent?.getStringExtra(EXTRA_BRANCH_NAME)
                    ?.takeIf { it.isNotBlank() }
                    ?: "Sucursal Móvil BUNKKER"
                val roomCode = store.getOrCreateMeta("room_code") { RoomCodeGenerator.generate() }
                val branchId = store.getOrCreateMeta("branch_id") { "sucursal-movil-1" }
                val epoch = store.bumpHostEpoch()
                val ip = resolveWifiIpv4Address()

                val notification = buildForegroundNotification(roomCode, ip)
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    startForeground(
                        NOTIFICATION_ID,
                        notification,
                        ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC
                    )
                } else {
                    startForeground(NOTIFICATION_ID, notification)
                }

                runCatching {
                    lanServer.start(roomCode, branchId, branchName, ip)
                }.onFailure { err ->
                    BunkkerHostRuntime.updateState {
                        it.copy(isHosting = false, errorMessage = "Puerto $HOST_PORT ocupado: ${err.message}")
                    }
                    return START_NOT_STICKY
                }

                BunkkerHostRuntime.updateState {
                    it.copy(
                        isHosting = true,
                        roomCode = roomCode,
                        branchId = branchId,
                        branchName = branchName,
                        hostIp = ip,
                        port = HOST_PORT,
                        hostEpoch = epoch,
                        errorMessage = null
                    )
                }
                refreshRuntimeState()

                nsdManager.registerHostService(
                    roomCode = roomCode,
                    branchId = branchId,
                    branchName = branchName,
                    port = HOST_PORT,
                    hostEpoch = epoch
                ) { ok, detail ->
                    BunkkerHostRuntime.updateState {
                        it.copy(
                            isNsdPublished = ok,
                            errorMessage = if (ok) null else detail
                        )
                    }
                }
                return START_STICKY
            }
        }
    }

    private fun refreshRuntimeState(reconciliationNote: String? = null) {
        val (todaySales, todayOrders) = store.getSalesTotals()
        BunkkerHostRuntime.updateState { prev ->
            prev.copy(
                hostEpoch = store.getHostEpoch(),
                productCount = store.listProducts().size,
                pendingCloudSyncCount = store.getPendingSyncCount(),
                todaySalesTotal = todaySales,
                todayOrdersCount = todayOrders,
                connectedClients = lanServer.getConnectedClients(),
                lastReconciliationNote = reconciliationNote ?: prev.lastReconciliationNote
            )
        }
    }

    private fun resolveWifiIpv4Address(): String {
        val interfaces = runCatching { NetworkInterface.getNetworkInterfaces() }.getOrNull() ?: return "127.0.0.1"
        while (interfaces.hasMoreElements()) {
            val iface = interfaces.nextElement()
            if (!iface.isUp || iface.isLoopback) continue
            val addrs = iface.inetAddresses
            while (addrs.hasMoreElements()) {
                val addr = addrs.nextElement()
                if (addr is Inet4Address && !addr.isLoopbackAddress) {
                    val hostAddr = addr.hostAddress
                    if (!hostAddr.isNullOrBlank()) return hostAddr
                }
            }
        }
        return "127.0.0.1"
    }

    private fun ensureNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Modo Host LAN BUNKKER",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Mantiene activo el servidor local Wi-Fi y NsdManager de la sucursal."
            }
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    private fun buildForegroundNotification(roomCode: String, ip: String): Notification {
        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("BUNKKER Modo Host Activo · $roomCode")
            .setContentText("Red local lista en http://$ip:$HOST_PORT")
            .setSmallIcon(android.R.drawable.stat_sys_data_bluetooth)
            .setOngoing(true)
            .build()
    }

    override fun onDestroy() {
        nsdManager.releaseAll()
        lanServer.destroy()
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null
}
