package com.bunkker.ecos.hybridai.host

import android.content.Context
import android.net.nsd.NsdManager
import android.net.nsd.NsdServiceInfo
import android.net.wifi.WifiManager
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.net.Inet4Address
import java.util.concurrent.ConcurrentLinkedQueue
import java.util.concurrent.atomic.AtomicBoolean

/**
 * Descubrimiento y Anuncio Wi-Fi LAN mediante android.net.nsd.NsdManager (_bunkker._tcp.).
 * Funciona sin Internet ni PC usando multicast mDNS/DNS-SD nativo (estilo LAN de Minecraft),
 * anunciando atributos TXT (código de sala BNK-XXXX, sucursal y epoch del Host).
 */
class BunkkerNsdDiscoveryManager(context: Context) {

    companion object {
        const val SERVICE_TYPE = "_bunkker._tcp."
    }

    private val appContext = context.applicationContext
    private val nsdManager = appContext.getSystemService(Context.NSD_SERVICE) as NsdManager
    private val wifiManager = appContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private var multicastLock: WifiManager.MulticastLock? = null
    private var registrationListener: NsdManager.RegistrationListener? = null
    private var discoveryListener: NsdManager.DiscoveryListener? = null

    private val resolveQueue = ConcurrentLinkedQueue<NsdServiceInfo>()
    private val isResolving = AtomicBoolean(false)

    private val _discoveredHosts = MutableStateFlow<List<DiscoveredBunkkerHost>>(emptyList())
    val discoveredHosts: StateFlow<List<DiscoveredBunkkerHost>> = _discoveredHosts.asStateFlow()

    private fun acquireMulticastLock() {
        if (multicastLock?.isHeld == true) return
        multicastLock = wifiManager.createMulticastLock("bunkker_ecos_nsd_lock").apply {
            setReferenceCounted(false)
            runCatching { acquire() }
        }
    }

    private fun releaseMulticastLock() {
        runCatching {
            if (multicastLock?.isHeld == true) {
                multicastLock?.release()
            }
        }
        multicastLock = null
    }

    /**
     * Publica este teléfono/tablet como Host de la sucursal en la red Wi-Fi local.
     */
    fun registerHostService(
        roomCode: String,
        branchId: String,
        branchName: String,
        port: Int,
        hostEpoch: Long,
        onRegistered: (Boolean, String?) -> Unit
    ) {
        unregisterHostService()
        acquireMulticastLock()

        val serviceInfo = NsdServiceInfo().apply {
            serviceName = "BUNKKER-$roomCode"
            serviceType = SERVICE_TYPE
            setPort(port)
            setAttribute("code", roomCode)
            setAttribute("branchId", branchId)
            setAttribute("branch", branchName.take(48))
            setAttribute("epoch", hostEpoch.toString())
            setAttribute("ver", "1")
        }

        val listener = object : NsdManager.RegistrationListener {
            override fun onServiceRegistered(info: NsdServiceInfo) {
                onRegistered(true, info.serviceName)
            }

            override fun onRegistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                onRegistered(false, "NsdManager error de registro ($errorCode)")
            }

            override fun onServiceUnregistered(arg0: NsdServiceInfo) = Unit

            override fun onUnregistrationFailed(serviceInfo: NsdServiceInfo, errorCode: Int) = Unit
        }

        registrationListener = listener
        runCatching {
            nsdManager.registerService(serviceInfo, NsdManager.PROTOCOL_DNS_SD, listener)
        }.onFailure { err ->
            registrationListener = null
            onRegistered(false, err.message)
        }
    }

    fun unregisterHostService() {
        registrationListener?.let { listener ->
            runCatching { nsdManager.unregisterService(listener) }
        }
        registrationListener = null
        if (discoveryListener == null) {
            releaseMulticastLock()
        }
    }

    /**
     * Escanea la red Wi-Fi local buscando dispositivos Android Host anunciando _bunkker._tcp.
     */
    fun startDiscovery(onError: ((String) -> Unit)? = null) {
        stopDiscovery()
        acquireMulticastLock()
        _discoveredHosts.value = emptyList()

        val listener = object : NsdManager.DiscoveryListener {
            override fun onDiscoveryStarted(regType: String) = Unit

            override fun onServiceFound(serviceInfo: NsdServiceInfo) {
                if (serviceInfo.serviceType.contains("_bunkker")) {
                    resolveQueue.add(serviceInfo)
                    drainResolveQueue()
                }
            }

            override fun onServiceLost(serviceInfo: NsdServiceInfo) {
                _discoveredHosts.value = _discoveredHosts.value.filterNot {
                    it.serviceName == serviceInfo.serviceName
                }
            }

            override fun onDiscoveryStopped(serviceType: String) = Unit

            override fun onStartDiscoveryFailed(serviceType: String, errorCode: Int) {
                onError?.invoke("No se pudo iniciar escaneo LAN (código $errorCode)")
                stopDiscovery()
            }

            override fun onStopDiscoveryFailed(serviceType: String, errorCode: Int) = Unit
        }

        discoveryListener = listener
        runCatching {
            nsdManager.discoverServices(SERVICE_TYPE, NsdManager.PROTOCOL_DNS_SD, listener)
        }.onFailure { err ->
            discoveryListener = null
            onError?.invoke(err.message ?: "Error al iniciar NsdManager")
        }
    }

    @Suppress("DEPRECATION")
    private fun drainResolveQueue() {
        if (!isResolving.compareAndSet(false, true)) return
        val next = resolveQueue.poll()
        if (next == null) {
            isResolving.set(false)
            return
        }

        runCatching {
            nsdManager.resolveService(next, object : NsdManager.ResolveListener {
                override fun onResolveFailed(serviceInfo: NsdServiceInfo, errorCode: Int) {
                    isResolving.set(false)
                    drainResolveQueue()
                }

                override fun onServiceResolved(resolved: NsdServiceInfo) {
                    val ipv4 = resolved.host?.let { addr ->
                        if (addr is Inet4Address) addr.hostAddress else addr.hostAddress
                    } ?: ""
                    val attrs = resolved.attributes
                    val code = attrs["code"]?.toString(Charsets.UTF_8)
                        ?: resolved.serviceName.removePrefix("BUNKKER-")
                    val branchId = attrs["branchId"]?.toString(Charsets.UTF_8) ?: "sucursal-movil-1"
                    val branchName = attrs["branch"]?.toString(Charsets.UTF_8) ?: "Sucursal BUNKKER"
                    val epoch = attrs["epoch"]?.toString(Charsets.UTF_8)?.toLongOrNull() ?: 1L

                    if (ipv4.isNotBlank() && resolved.port > 0) {
                        val hostItem = DiscoveredBunkkerHost(
                            serviceName = resolved.serviceName,
                            roomCode = code,
                            branchId = branchId,
                            branchName = branchName,
                            hostIp = ipv4,
                            port = resolved.port,
                            hostEpoch = epoch
                        )
                        val updated = _discoveredHosts.value
                            .filterNot { it.roomCode == hostItem.roomCode && it.hostIp == hostItem.hostIp } + hostItem
                        _discoveredHosts.value = updated
                    }

                    isResolving.set(false)
                    drainResolveQueue()
                }
            })
        }.onFailure {
            isResolving.set(false)
            drainResolveQueue()
        }
    }

    fun stopDiscovery() {
        discoveryListener?.let { listener ->
            runCatching { nsdManager.stopServiceDiscovery(listener) }
        }
        discoveryListener = null
        resolveQueue.clear()
        if (registrationListener == null) {
            releaseMulticastLock()
        }
    }

    fun releaseAll() {
        unregisterHostService()
        stopDiscovery()
        releaseMulticastLock()
    }
}
