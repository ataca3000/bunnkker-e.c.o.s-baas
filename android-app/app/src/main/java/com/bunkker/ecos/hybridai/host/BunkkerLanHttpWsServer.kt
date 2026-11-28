package com.bunkker.ecos.hybridai.host

import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import org.json.JSONArray
import org.json.JSONObject
import java.io.BufferedInputStream
import java.io.ByteArrayOutputStream
import java.io.OutputStream
import java.net.InetAddress
import java.net.ServerSocket
import java.net.Socket
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Servidor HTTP/1.1 + WebSocket (RFC 6455) embebido en Kotlin puro sobre ServerSocket.
 * No requiere librerías externas ni PC: convierte cualquier Android en el cerebro LAN
 * para otros celulares (App nativa) y navegadores/tablets (Portal HTTP local en :8765).
 */
class BunkkerLanHttpWsServer(
    private val store: BunkkerHostSqliteStore,
    private val port: Int = 8765,
    private val onStateChanged: () -> Unit
) {
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var serverSocket: ServerSocket? = null

    private val wsClients = ConcurrentHashMap<String, Socket>()
    private val joinedTerminals = ConcurrentHashMap<String, ConnectedClientRecord>()

    @Volatile
    var activeRoomCode: String = ""
        private set

    @Volatile
    var activeBranchId: String = "sucursal-movil-1"
        private set

    @Volatile
    var activeBranchName: String = "Sucursal Móvil BUNKKER"
        private set

    @Volatile
    var activeHostIp: String = "127.0.0.1"
        private set

    fun start(
        roomCode: String,
        branchId: String,
        branchName: String,
        hostIp: String
    ) {
        stop()
        activeRoomCode = roomCode
        activeBranchId = branchId
        activeBranchName = branchName
        activeHostIp = hostIp

        val ss = ServerSocket(port, 50, InetAddress.getByName("0.0.0.0"))
        serverSocket = ss

        scope.launch {
            while (isActive && !ss.isClosed) {
                val client = runCatching { ss.accept() }.getOrNull() ?: break
                launch { handleConnection(client) }
            }
        }
    }

    fun getConnectedClients(): List<ConnectedClientRecord> =
        joinedTerminals.values.sortedByDescending { it.connectedAt }

    fun broadcastWsEvent(type: String, data: JSONObject) {
        val frame = buildWsTextFrame(
            JSONObject().apply {
                put("type", type)
                put("timestamp", Instant.now().toString())
                put("data", data)
            }.toString()
        )
        val iterator = wsClients.entries.iterator()
        while (iterator.hasNext()) {
            val (id, sock) = iterator.next()
            try {
                if (sock.isClosed) {
                    iterator.remove()
                    continue
                }
                synchronized(sock) {
                    sock.getOutputStream().write(frame)
                    sock.getOutputStream().flush()
                }
            } catch (_: Exception) {
                runCatching { sock.close() }
                iterator.remove()
            }
        }
    }

    fun stop() {
        runCatching { serverSocket?.close() }
        serverSocket = null
        wsClients.values.forEach { runCatching { it.close() } }
        wsClients.clear()
        joinedTerminals.clear()
    }

    fun destroy() {
        stop()
        scope.cancel()
    }

    private fun handleConnection(socket: Socket) {
        var keepOpenForWs = false
        try {
            socket.soTimeout = 15_000
            val input = BufferedInputStream(socket.getInputStream())
            val output = socket.getOutputStream()

            val headerBytes = ByteArrayOutputStream()
            var prev3 = -1
            var prev2 = -1
            var prev1 = -1
            while (true) {
                val b = input.read()
                if (b == -1) return
                headerBytes.write(b)
                if (prev3 == '\r'.code && prev2 == '\n'.code && prev1 == '\r'.code && b == '\n'.code) {
                    break
                }
                prev3 = prev2
                prev2 = prev1
                prev1 = b
                if (headerBytes.size() > 32_768) return
            }

            val rawHeaders = headerBytes.toString(Charsets.UTF_8.name())
            val lines = rawHeaders.split("\r\n").filter { it.isNotBlank() }
            if (lines.isEmpty()) return

            val requestLine = lines[0].split(" ")
            val method = requestLine.getOrNull(0)?.uppercase() ?: "GET"
            val rawPath = requestLine.getOrNull(1) ?: "/"
            val path = rawPath.substringBefore("?")

            val headers = mutableMapOf<String, String>()
            for (line in lines.drop(1)) {
                val idx = line.indexOf(':')
                if (idx > 0) {
                    headers[line.substring(0, idx).trim().lowercase()] =
                        line.substring(idx + 1).trim()
                }
            }

            if (method == "OPTIONS") {
                writeHttpResponse(output, 204, "text/plain; charset=utf-8", "")
                return
            }

            // Upgrade WebSocket RFC-6455
            val upgrade = headers["upgrade"]?.lowercase()
            val wsKey = headers["sec-websocket-key"]
            if (upgrade == "websocket" && !wsKey.isNullOrBlank() && path == "/ws/host") {
                keepOpenForWs = true
                handleWebSocketLoop(socket, input, output, wsKey)
                return
            }

            val contentLength = headers["content-length"]?.toIntOrNull()?.coerceIn(0, 1_048_576) ?: 0
            val bodyStr = if (contentLength > 0) {
                val buf = ByteArray(contentLength)
                var readTotal = 0
                while (readTotal < contentLength) {
                    val r = input.read(buf, readTotal, contentLength - readTotal)
                    if (r == -1) break
                    readTotal += r
                }
                String(buf, 0, readTotal, Charsets.UTF_8)
            } else {
                ""
            }

            when {
                method == "GET" && path == "/" -> {
                    writeHttpResponse(output, 200, "text/html; charset=utf-8", buildLanPortalHtml())
                }
                method == "GET" && path == "/api/host/info" -> {
                    val info = buildHostInfoJson()
                    writeHttpResponse(output, 200, "application/json; charset=utf-8", info.toString())
                }
                method == "GET" && path == "/api/host/snapshot" -> {
                    val snap = buildSnapshotJson()
                    writeHttpResponse(output, 200, "application/json; charset=utf-8", snap.toString())
                }
                method == "POST" && path == "/api/host/join" -> {
                    val req = runCatching { JSONObject(bodyStr) }.getOrNull() ?: JSONObject()
                    val code = RoomCodeGenerator.normalize(req.optString("roomCode"))
                    if (code != activeRoomCode) {
                        val err = JSONObject().apply {
                            put("ok", false)
                            put("error", "Código de sala incorrecto para este Host.")
                        }
                        writeHttpResponse(output, 403, "application/json; charset=utf-8", err.toString())
                        return
                    }
                    val clientId = req.optString("clientId").ifBlank { UUID.randomUUID().toString().take(12) }
                    val deviceName = req.optString("deviceName").ifBlank { "Terminal Wi-Fi" }
                    val role = req.optString("role").ifBlank { "sales" }
                    val record = ConnectedClientRecord(
                        clientId = clientId,
                        deviceName = deviceName,
                        role = role,
                        remoteAddress = socket.inetAddress.hostAddress ?: "LAN",
                        connectedAt = Instant.now().toString()
                    )
                    joinedTerminals[clientId] = record
                    onStateChanged()
                    broadcastWsEvent("client:joined", JSONObject().apply {
                        put("clientId", clientId)
                        put("deviceName", deviceName)
                        put("role", role)
                    })
                    val ok = JSONObject().apply {
                        put("ok", true)
                        put("clientId", clientId)
                        put("roomCode", activeRoomCode)
                        put("branchId", activeBranchId)
                        put("branchName", activeBranchName)
                        put("hostEpoch", store.getHostEpoch())
                    }
                    writeHttpResponse(output, 200, "application/json; charset=utf-8", ok.toString())
                }
                method == "POST" && path == "/api/host/sale" -> {
                    val req = runCatching { JSONObject(bodyStr) }.getOrNull()
                    if (req == null) {
                        writeHttpResponse(output, 400, "application/json; charset=utf-8", """{"ok":false,"error":"JSON inválido"}""")
                        return
                    }
                    val txId = req.optString("txId").ifBlank { "tx-${UUID.randomUUID().toString().take(10)}" }
                    val role = req.optString("cashierRole").ifBlank { "sales" }
                    val device = req.optString("deviceName").ifBlank { "Terminal LAN" }
                    val itemsJson = req.optJSONArray("items") ?: JSONArray()
                    val items = mutableListOf<LocalSaleItem>()
                    var computedTotal = 0.0
                    for (i in 0 until itemsJson.length()) {
                        val obj = itemsJson.optJSONObject(i) ?: continue
                        val qty = obj.optInt("qty", 1).coerceAtLeast(1)
                        val price = obj.optDouble("unitPrice", 0.0).coerceAtLeast(0.0)
                        computedTotal += qty * price
                        items.add(
                            LocalSaleItem(
                                productId = obj.optString("productId"),
                                name = obj.optString("name", "Producto"),
                                qty = qty,
                                unitPrice = price
                            )
                        )
                    }
                    val saleTotal = if (req.has("total") && req.optDouble("total", 0.0) > 0) {
                        req.optDouble("total")
                    } else {
                        computedTotal
                    }
                    val saleRecord = LocalSaleRecord(
                        txId = txId,
                        roomCode = activeRoomCode,
                        cashierRole = role,
                        deviceName = device,
                        items = items,
                        total = saleTotal,
                        createdAt = req.optString("createdAt").ifBlank { Instant.now().toString() },
                        syncedToCloud = false
                    )
                    val inserted = store.recordAtomicSale(saleRecord)
                    onStateChanged()
                    if (inserted) {
                        broadcastWsEvent("sale:created", JSONObject().apply {
                            put("txId", saleRecord.txId)
                            put("total", saleRecord.total)
                            put("deviceName", saleRecord.deviceName)
                        })
                        broadcastWsEvent("stock:updated", buildSnapshotJson())
                    }
                    val res = JSONObject().apply {
                        put("ok", true)
                        put("txId", saleRecord.txId)
                        put("duplicated", !inserted)
                        put("hostEpoch", store.getHostEpoch())
                    }
                    writeHttpResponse(output, 200, "application/json; charset=utf-8", res.toString())
                }
                method == "POST" && path == "/api/host/product/upsert" -> {
                    val req = runCatching { JSONObject(bodyStr) }.getOrNull()
                    if (req == null || req.optString("name").isBlank()) {
                        writeHttpResponse(output, 400, "application/json; charset=utf-8", """{"ok":false,"error":"Producto inválido"}""")
                        return
                    }
                    val record = LocalProductRecord(
                        id = req.optString("id").ifBlank { "prod-${UUID.randomUUID().toString().take(8)}" },
                        sku = req.optString("sku").ifBlank { "SKU-${System.currentTimeMillis() % 10000}" },
                        name = req.optString("name"),
                        price = req.optDouble("price", 0.0).coerceAtLeast(0.0),
                        stock = req.optInt("stock", 0).coerceAtLeast(0),
                        category = req.optString("category").ifBlank { "General" },
                        estante = req.optString("estante"),
                        fila = req.optString("fila"),
                        updatedAt = Instant.now().toString()
                    )
                    store.upsertProduct(record)
                    onStateChanged()
                    broadcastWsEvent("stock:updated", buildSnapshotJson())
                    writeHttpResponse(output, 200, "application/json; charset=utf-8", """{"ok":true,"id":"${record.id}"}""")
                }
                else -> {
                    writeHttpResponse(output, 404, "application/json; charset=utf-8", """{"ok":false,"error":"Ruta no encontrada"}""")
                }
            }
        } catch (_: Exception) {
            // Cierre silencioso ante desconexión de cliente Wi-Fi
        } finally {
            if (!keepOpenForWs) {
                runCatching { socket.close() }
            }
        }
    }

    private fun handleWebSocketLoop(
        socket: Socket,
        input: BufferedInputStream,
        output: OutputStream,
        wsKey: String
    ) {
        val acceptSeed = "${wsKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11"
        val acceptHash = MessageDigest.getInstance("SHA-1").digest(acceptSeed.toByteArray(Charsets.UTF_8))
        val acceptBase64 = Base64.getEncoder().encodeToString(acceptHash)

        val handshake = buildString {
            append("HTTP/1.1 101 Switching Protocols\r\n")
            append("Upgrade: websocket\r\n")
            append("Connection: Upgrade\r\n")
            append("Sec-WebSocket-Accept: $acceptBase64\r\n\r\n")
        }
        output.write(handshake.toByteArray(Charsets.UTF_8))
        output.flush()

        socket.soTimeout = 0
        val clientId = UUID.randomUUID().toString().take(12)
        wsClients[clientId] = socket

        // Enviar estado inicial al conectarse
        val welcomeFrame = buildWsTextFrame(
            JSONObject().apply {
                put("type", "host:welcome")
                put("data", buildSnapshotJson())
            }.toString()
        )
        synchronized(socket) {
            output.write(welcomeFrame)
            output.flush()
        }

        try {
            while (!socket.isClosed) {
                val b0 = input.read()
                if (b0 == -1) break
                val opcode = b0 and 0x0F
                val b1 = input.read()
                if (b1 == -1) break
                val masked = (b1 and 0x80) != 0
                var len = (b1 and 0x7F).toLong()
                if (len == 126L) {
                    val h = input.read()
                    val l = input.read()
                    if (h == -1 || l == -1) break
                    len = ((h shl 8) or l).toLong()
                } else if (len == 127L) {
                    var extended = 0L
                    for (i in 0 until 8) {
                        val nb = input.read()
                        if (nb == -1) return
                        extended = (extended shl 8) or (nb.toLong() and 0xFF)
                    }
                    len = extended
                }

                if (len > 1_048_576L) break
                val maskKey = if (masked) {
                    ByteArray(4) {
                        val m = input.read()
                        if (m == -1) return
                        m.toByte()
                    }
                } else null

                val payload = ByteArray(len.toInt())
                var readCount = 0
                while (readCount < payload.size) {
                    val r = input.read(payload, readCount, payload.size - readCount)
                    if (r == -1) break
                    readCount += r
                }
                if (maskKey != null) {
                    for (i in payload.indices) {
                        payload[i] = (payload[i].toInt() xor maskKey[i % 4].toInt()).toByte()
                    }
                }

                if (opcode == 0x8) break // Close
                if (opcode == 0x9) { // Ping -> Pong
                    synchronized(socket) {
                        output.write(byteArrayOf(0x8A.toByte(), payload.size.toByte()))
                        output.write(payload)
                        output.flush()
                    }
                }
            }
        } finally {
            wsClients.remove(clientId)
            runCatching { socket.close() }
        }
    }

    private fun buildWsTextFrame(text: String): ByteArray {
        val bytes = text.toByteArray(Charsets.UTF_8)
        val out = ByteArrayOutputStream()
        out.write(0x81) // FIN + text frame
        when {
            bytes.size <= 125 -> out.write(bytes.size)
            bytes.size <= 65535 -> {
                out.write(126)
                out.write((bytes.size shr 8) and 0xFF)
                out.write(bytes.size and 0xFF)
            }
            else -> {
                out.write(127)
                val len = bytes.size.toLong()
                for (shift in 56 downTo 0 step 8) {
                    out.write(((len shr shift) and 0xFF).toInt())
                }
            }
        }
        out.write(bytes)
        return out.toByteArray()
    }

    private fun buildHostInfoJson(): JSONObject {
        val (todaySales, todayOrders) = store.getSalesTotals()
        return JSONObject().apply {
            put("ok", true)
            put("roomCode", activeRoomCode)
            put("branchId", activeBranchId)
            put("branchName", activeBranchName)
            put("hostEpoch", store.getHostEpoch())
            put("hostIp", activeHostIp)
            put("port", port)
            put("productCount", store.listProducts().size)
            put("connectedClients", joinedTerminals.size)
            put("pendingCloudSync", store.getPendingSyncCount())
            put("todaySales", todaySales)
            put("todayOrders", todayOrders)
            put("startedAt", Instant.now().toString())
        }
    }

    private fun buildSnapshotJson(): JSONObject {
        val productsArray = JSONArray()
        for (p in store.listProducts()) {
            productsArray.put(
                JSONObject().apply {
                    put("id", p.id)
                    put("sku", p.sku)
                    put("name", p.name)
                    put("price", p.price)
                    put("stock", p.stock)
                    put("category", p.category)
                    put("estante", p.estante)
                    put("fila", p.fila)
                    put("updatedAt", p.updatedAt)
                }
            )
        }
        return JSONObject().apply {
            put("ok", true)
            put("roomCode", activeRoomCode)
            put("branchId", activeBranchId)
            put("branchName", activeBranchName)
            put("hostEpoch", store.getHostEpoch())
            put("products", productsArray)
            put("pendingCloudSync", store.getPendingSyncCount())
        }
    }

    private fun writeHttpResponse(
        output: OutputStream,
        status: Int,
        contentType: String,
        body: String
    ) {
        val bytes = body.toByteArray(Charsets.UTF_8)
        val statusText = when (status) {
            200 -> "OK"
            204 -> "No Content"
            400 -> "Bad Request"
            403 -> "Forbidden"
            404 -> "Not Found"
            else -> "Internal Server Error"
        }
        val header = buildString {
            append("HTTP/1.1 $status $statusText\r\n")
            append("Content-Type: $contentType\r\n")
            append("Content-Length: ${bytes.size}\r\n")
            append("Access-Control-Allow-Origin: *\r\n")
            append("Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n")
            append("Access-Control-Allow-Headers: Content-Type\r\n")
            append("Connection: close\r\n\r\n")
        }
        output.write(header.toByteArray(Charsets.UTF_8))
        if (bytes.isNotEmpty()) output.write(bytes)
        output.flush()
    }

    /**
     * Mini portal operativo HTTP servido por el Android Host para cualquier navegador/PWA
     * en el mismo Wi-Fi, eliminando el bloqueo de Mixed Content (https -> ws).
     */
    private fun buildLanPortalHtml(): String = """
        <!doctype html>
        <html lang="es">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>BUNKKER · Cliente LAN ($activeRoomCode)</title>
          <style>
            body { font-family: system-ui, sans-serif; background:#0b1120; color:#f8fafc; margin:0; padding:16px; }
            .wrap { max-width:720px; margin:0 auto; }
            .card { background:#111827; border:1px solid #1f2937; border-radius:14px; padding:16px; margin-bottom:14px; }
            .row { display:flex; justify-content:space-between; align-items:center; gap:10px; flex-wrap:wrap; }
            input, select, button { font:inherit; border-radius:10px; padding:10px 12px; border:1px solid #334155; }
            input, select { background:#020617; color:#f8fafc; }
            button { background:#0ea5e9; color:#020617; font-weight:700; border:none; cursor:pointer; min-height:44px; }
            .prod { display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #1e293b; }
            .mono { font-family: ui-monospace, monospace; font-variant-numeric: tabular-nums; }
            .muted { color:#94a3b8; font-size:13px; }
          </style>
        </head>
        <body>
          <div class="wrap">
            <div class="card">
              <div class="row">
                <div>
                  <div class="muted">Modo Host Android · Red Local Wi-Fi</div>
                  <h2 style="margin:4px 0">$activeBranchName</h2>
                </div>
                <div class="mono" style="font-size:20px;font-weight:800">$activeRoomCode</div>
              </div>
              <p class="muted" id="wsState">Conectando en tiempo real con el Host...</p>
            </div>
            <div class="card">
              <div class="row">
                <input id="devName" value="Caja / Móvil LAN" placeholder="Nombre de terminal" />
                <select id="devRole">
                  <option value="sales">Caja</option>
                  <option value="inventory">Almacén</option>
                  <option value="driver">Reparto</option>
                </select>
                <button onclick="joinHost()">Conectar Terminal</button>
              </div>
            </div>
            <div class="card">
              <h3 style="margin-top:0">Catálogo Vivo del Host</h3>
              <div id="catalog">Cargando inventario...</div>
            </div>
          </div>
          <script>
            const ROOM = "$activeRoomCode";
            function render(products) {
              const box = document.getElementById('catalog');
              if (!products || !products.length) { box.textContent = 'Sin productos'; return; }
              box.innerHTML = products.map(p =>
                '<div class="prod"><div><strong>' + p.name + '</strong><div class="muted mono">' +
                p.sku + ' · Stock: ' + p.stock + '</div></div>' +
                '<button onclick="sellOne(\'' + p.id + '\',\'' + p.name.replace(/'/g, '') + '\',' + p.price + ')">Cobrar $' + p.price + '</button></div>'
              ).join('');
            }
            async function loadSnapshot() {
              const r = await fetch('/api/host/snapshot');
              const d = await r.json();
              render(d.products);
            }
            async function joinHost() {
              await fetch('/api/host/join', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                  roomCode: ROOM,
                  deviceName: document.getElementById('devName').value,
                  role: document.getElementById('devRole').value
                })
              });
              document.getElementById('wsState').textContent = 'Terminal vinculada al Host ' + ROOM;
            }
            async function sellOne(id, name, price) {
              await fetch('/api/host/sale', {
                method:'POST',
                headers:{'Content-Type':'application/json'},
                body:JSON.stringify({
                  roomCode: ROOM,
                  cashierRole: document.getElementById('devRole').value,
                  deviceName: document.getElementById('devName').value,
                  items:[{productId:id, name:name, qty:1, unitPrice:price}],
                  total:price
                })
              });
              loadSnapshot();
            }
            const ws = new WebSocket('ws://' + location.host + '/ws/host');
            ws.onopen = () => document.getElementById('wsState').textContent = 'Conectado por WebSocket LAN · Sin Internet';
            ws.onmessage = (ev) => {
              try {
                const msg = JSON.parse(ev.data);
                if (msg.data && msg.data.products) render(msg.data.products);
              } catch {}
            };
            loadSnapshot();
          </script>
        </body>
        </html>
    """.trimIndent()
}
