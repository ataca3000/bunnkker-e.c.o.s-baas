package com.bunkker.ecos.hybridai

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import com.bunkker.ecos.hybridai.host.BunkkerHostRuntime
import com.bunkker.ecos.hybridai.host.RoomCodeGenerator
import kotlinx.coroutines.launch

private const val PROD_WEB_BASE = "https://ais-pre-htrghfnoo2szdbz5e4cyap-376729163743.us-east1.run.app"

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    BunkkerHybridCompanionScreen()
                }
            }
        }
    }
}

@Composable
fun BunkkerHybridCompanionScreen() {
    val context = LocalContext.current
    val uriHandler = LocalUriHandler.current
    val clipboard = LocalClipboardManager.current
    val engine = remember { BunkkerHybridAiEngine(context) }
    val scope = rememberCoroutineScope()

    var activeTab by remember { mutableIntStateOf(0) } // 0 = Modo Host LAN, 1 = IA Híbrida
    var selectedRole by remember { mutableStateOf("driver") }
    var prompt by remember { mutableStateOf("Resume prioridades de entrega PoD y stock crítico.") }
    var loading by remember { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<HybridInferenceOutcome?>(null) }

    var showWelcomeGuide by remember { mutableStateOf(true) }
    var welcomeStep by remember { mutableIntStateOf(0) }
    var showFeedbackDialog by remember { mutableStateOf(false) }
    var feedbackNotes by remember { mutableStateOf("") }

    var branchNameInput by remember { mutableStateOf("Sucursal Móvil BUNKKER") }
    var joinRoomCodeInput by remember { mutableStateOf("") }
    var isScanningLan by remember { mutableStateOf(false) }
    var scanStatusMessage by remember { mutableStateOf<String?>(null) }

    val hostState by BunkkerHostRuntime.sessionState.collectAsState()
    val discoveredHosts by BunkkerHostRuntime.discoveredHosts.collectAsState()

    val notificationLauncher = rememberLauncherForActivityResult(
        contract = ActivityResultContracts.RequestPermission()
    ) { _ ->
        BunkkerHostRuntime.startHostService(context, branchNameInput)
    }

    DisposableEffect(Unit) {
        onDispose {
            BunkkerHostRuntime.stopLanScan()
        }
    }

    val welcomeSteps = listOf(
        "1. Activa Modo Host LAN para convertir este teléfono en el cerebro temporal sin PC ni Internet.",
        "2. Otros teléfonos se conectan vía NsdManager (código BNK-XXXX) o navegador Wi-Fi.",
        "3. Al volver Internet, presiona Sincronizar a Firebase para sobrescribir la nube con la verdad local."
    )

    Scaffold { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(16.dp)
                .verticalScroll(rememberScrollState()),
            verticalArrangement = Arrangement.spacedBy(12.dp)
        ) {
            Text(
                text = "BUNKKER E.C.O.S. · Android Local-First",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Modo Host LAN (NsdManager) + Firebase AI Logic On-Device",
                style = MaterialTheme.typography.bodySmall
            )

            TabRow(selectedTabIndex = activeTab) {
                Tab(
                    selected = activeTab == 0,
                    onClick = { activeTab = 0 },
                    text = { Text("Modo Host LAN") }
                )
                Tab(
                    selected = activeTab == 1,
                    onClick = { activeTab = 1 },
                    text = { Text("IA Híbrida") }
                )
            }

            if (showWelcomeGuide) {
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(8.dp)
                    ) {
                        Text(
                            text = "Bienvenida rápida (${welcomeStep + 1}/3)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )
                        Text(
                            text = welcomeSteps[welcomeStep],
                            style = MaterialTheme.typography.bodySmall
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (welcomeStep < welcomeSteps.lastIndex) {
                                Button(onClick = { welcomeStep += 1 }) {
                                    Text("Siguiente")
                                }
                            } else {
                                Button(onClick = {
                                    selectedRole = "inventory"
                                    prompt = "Modo Demo Admin: lista alertas de stock bajo y prioridades."
                                    showWelcomeGuide = false
                                }) {
                                    Text("Listo para probar")
                                }
                            }
                            TextButton(onClick = { showWelcomeGuide = false }) {
                                Text("Saltar")
                            }
                        }
                    }
                }
            }

            if (activeTab == 0) {
                // ── TAB 0: MODO HOST ANDROID + CLIENTE NsdManager ────────────────────
                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "1. Cerebro Temporal de Sucursal (Host)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )

                        OutlinedTextField(
                            value = branchNameInput,
                            onValueChange = { branchNameInput = it },
                            label = { Text("Nombre de sucursal / caja") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true,
                            enabled = !hostState.isHosting
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            if (!hostState.isHosting) {
                                Button(onClick = {
                                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                        val granted = ContextCompat.checkSelfPermission(
                                            context,
                                            Manifest.permission.POST_NOTIFICATIONS
                                        ) == PackageManager.PERMISSION_GRANTED
                                        if (!granted) {
                                            notificationLauncher.launch(Manifest.permission.POST_NOTIFICATIONS)
                                            return@Button
                                        }
                                    }
                                    BunkkerHostRuntime.startHostService(context, branchNameInput)
                                }) {
                                    Text("Activar Modo Host")
                                }
                            } else {
                                OutlinedButton(onClick = { BunkkerHostRuntime.stopHostService(context) }) {
                                    Text("Detener Host")
                                }
                            }

                            OutlinedButton(onClick = { BunkkerHostRuntime.recordQuickDemoSale(context) }) {
                                Text("Venta local prueba")
                            }
                        }

                        if (hostState.isHosting) {
                            HorizontalDivider()
                            Text(
                                text = "Código de Sala: ${hostState.roomCode}",
                                style = MaterialTheme.typography.titleMedium,
                                fontFamily = FontFamily.Monospace,
                                fontWeight = FontWeight.Bold
                            )
                            Text(
                                text = "Portal PWA/Navegador en Wi-Fi: ${hostState.localPortalUrl}",
                                style = MaterialTheme.typography.bodySmall,
                                fontFamily = FontFamily.Monospace
                            )
                            Text(
                                text = buildString {
                                    append("NsdManager (_bunkker._tcp): ")
                                    append(if (hostState.isNsdPublished) "Anunciando en LAN" else "Iniciando anuncio...")
                                    append(" · Epoch ${hostState.hostEpoch}")
                                },
                                style = MaterialTheme.typography.bodySmall
                            )
                            Text(
                                text = "Productos: ${hostState.productCount} · Ventas locales: ${hostState.todayOrdersCount} ($${"%.2f".format(hostState.todaySalesTotal)}) · Pendientes nube: ${hostState.pendingCloudSyncCount} · Terminales: ${hostState.connectedClients.size}",
                                style = MaterialTheme.typography.bodySmall
                            )

                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                                OutlinedButton(onClick = {
                                    clipboard.setText(AnnotatedString(hostState.localPortalUrl))
                                    scanStatusMessage = "URL local copiada: ${hostState.localPortalUrl}"
                                }) {
                                    Text("Copiar URL LAN")
                                }
                                OutlinedButton(onClick = {
                                    uriHandler.openUri(hostState.localPortalUrl)
                                }) {
                                    Text("Abrir Portal")
                                }
                            }

                            if (hostState.connectedClients.isNotEmpty()) {
                                Text(
                                    text = "Terminales conectadas:",
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.SemiBold
                                )
                                hostState.connectedClients.forEach { client ->
                                    Text(
                                        text = "• ${client.deviceName} (${client.role}) · ${client.remoteAddress}",
                                        style = MaterialTheme.typography.bodySmall
                                    )
                                }
                            }
                        }

                        Button(
                            onClick = { BunkkerHostRuntime.triggerFirebaseOverwrite(context) },
                            modifier = Modifier.fillMaxWidth()
                        ) {
                            Text("Sincronizar a Firebase (El Host Manda)")
                        }

                        hostState.lastReconciliationNote?.let { note ->
                            Text(
                                text = note,
                                style = MaterialTheme.typography.bodySmall,
                                fontWeight = FontWeight.Medium
                            )
                        }

                        hostState.errorMessage?.let { err ->
                            Text(
                                text = "Aviso Host: $err",
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.error
                            )
                        }
                    }
                }

                Card(modifier = Modifier.fillMaxWidth()) {
                    Column(
                        modifier = Modifier.padding(14.dp),
                        verticalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        Text(
                            text = "2. Unirse a un Host en este Wi-Fi (Cliente NsdManager)",
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.Bold
                        )

                        OutlinedTextField(
                            value = joinRoomCodeInput,
                            onValueChange = { joinRoomCodeInput = RoomCodeGenerator.normalize(it) },
                            label = { Text("Filtrar por código de sala (ej. BNK-4821)") },
                            modifier = Modifier.fillMaxWidth(),
                            singleLine = true
                        )

                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Button(onClick = {
                                if (!isScanningLan) {
                                    isScanningLan = true
                                    scanStatusMessage = "Buscando Hosts _bunkker._tcp en Wi-Fi..."
                                    BunkkerHostRuntime.startLanScan(context) { err ->
                                        scanStatusMessage = err
                                        isScanningLan = false
                                    }
                                } else {
                                    isScanningLan = false
                                    BunkkerHostRuntime.stopLanScan()
                                    scanStatusMessage = "Escaneo LAN detenido."
                                }
                            }) {
                                Text(if (isScanningLan) "Detener Escaneo" else "Buscar Host Wi-Fi")
                            }
                        }

                        scanStatusMessage?.let { msg ->
                            Text(text = msg, style = MaterialTheme.typography.bodySmall)
                        }

                        val filteredHosts = discoveredHosts.filter {
                            joinRoomCodeInput.isBlank() || it.roomCode.contains(joinRoomCodeInput, ignoreCase = true)
                        }

                        if (filteredHosts.isEmpty()) {
                            Text(
                                text = if (isScanningLan) {
                                    "Escuchando anuncios mDNS (_bunkker._tcp.) en la subred actual..."
                                } else {
                                    "Toca \"Buscar Host Wi-Fi\" cuando otro Android tenga activo el Modo Host."
                                },
                                style = MaterialTheme.typography.bodySmall
                            )
                        } else {
                            filteredHosts.forEach { found ->
                                Card(modifier = Modifier.fillMaxWidth()) {
                                    Column(
                                        modifier = Modifier.padding(10.dp),
                                        verticalArrangement = Arrangement.spacedBy(6.dp)
                                    ) {
                                        Text(
                                            text = "${found.branchName} · ${found.roomCode}",
                                            style = MaterialTheme.typography.labelLarge,
                                            fontWeight = FontWeight.Bold
                                        )
                                        Text(
                                            text = "${found.httpBaseUrl} · Epoch ${found.hostEpoch}",
                                            style = MaterialTheme.typography.bodySmall,
                                            fontFamily = FontFamily.Monospace
                                        )
                                        Button(onClick = { uriHandler.openUri(found.httpBaseUrl) }) {
                                            Text("Conectar a este Host")
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            } else {
                // ── TAB 1: IA HÍBRIDA ON-DEVICE (GEMINI NANO 4) ─────────────────────
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    listOf("driver" to "Reparto", "inventory" to "Almacén", "sales" to "Caja").forEach { (id, label) ->
                        OutlinedButton(onClick = { selectedRole = id }) {
                            Text(if (selectedRole == id) "✓ $label" else label)
                        }
                    }
                }

                OutlinedTextField(
                    value = prompt,
                    onValueChange = { prompt = it },
                    label = { Text("Consulta operativa para LION") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )

                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Button(
                        enabled = !loading && prompt.isNotBlank(),
                        onClick = {
                            loading = true
                            scope.launch {
                                outcome = engine.runOperationalPrompt(
                                    prompt = prompt,
                                    role = selectedRole,
                                    preferCloudForLargeDoc = false
                                )
                                loading = false
                            }
                        }
                    ) {
                        Text(if (loading) "Ejecutando..." else "Inferencia On-Device")
                    }

                    OutlinedButton(
                        enabled = !loading && prompt.isNotBlank(),
                        onClick = {
                            loading = true
                            scope.launch {
                                outcome = engine.runOperationalPrompt(
                                    prompt = prompt,
                                    role = selectedRole,
                                    preferCloudForLargeDoc = true
                                )
                                loading = false
                            }
                        }
                    ) {
                        Text("Reporte Largo (Cloud)")
                    }
                }

                outcome?.let { res ->
                    Card(modifier = Modifier.fillMaxWidth()) {
                        Column(modifier = Modifier.padding(14.dp)) {
                            val badge = when (res.source) {
                                HybridSource.ON_DEVICE -> "On-Device · Gemini Nano 4"
                                HybridSource.IN_CLOUD -> "Cloud · Firebase AI Logic"
                                HybridSource.LOCAL_FALLBACK -> "Offline Local · Reglas BUNKKER"
                            }
                            Text(
                                text = "$badge · ${res.latencyMs} ms",
                                style = MaterialTheme.typography.labelLarge,
                                fontWeight = FontWeight.SemiBold
                            )
                            Spacer(modifier = Modifier.height(6.dp))
                            Text(text = res.text, style = MaterialTheme.typography.bodyMedium)
                            res.note?.let { note ->
                                Spacer(modifier = Modifier.height(6.dp))
                                Text(
                                    text = "Nota técnica: $note",
                                    style = MaterialTheme.typography.bodySmall
                                )
                            }
                        }
                    }
                }
            }

            Spacer(modifier = Modifier.height(4.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showFeedbackDialog = true }) {
                    Text("Reportar falla")
                }
                TextButton(onClick = { uriHandler.openUri("$PROD_WEB_BASE/conectar-host") }) {
                    Text("Puente Web Host")
                }
            }

            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                TextButton(onClick = { uriHandler.openUri("$PROD_WEB_BASE/privacidad") }) {
                    Text("Privacidad")
                }
                TextButton(onClick = { uriHandler.openUri("$PROD_WEB_BASE/terminos") }) {
                    Text("Términos")
                }
                TextButton(onClick = { uriHandler.openUri("$PROD_WEB_BASE/privacidad#eliminacion-cuenta") }) {
                    Text("Eliminar cuenta")
                }
            }
        }
    }

    if (showFeedbackDialog) {
        AlertDialog(
            onDismissRequest = { showFeedbackDialog = false },
            title = { Text("Reportar falla / Comentario") },
            text = {
                OutlinedTextField(
                    value = feedbackNotes,
                    onValueChange = { feedbackNotes = it },
                    label = { Text("Describe qué ocurrió en tu prueba") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3
                )
            },
            confirmButton = {
                Button(
                    enabled = feedbackNotes.isNotBlank(),
                    onClick = {
                        val mailIntent = Intent(Intent.ACTION_SENDTO).apply {
                            data = Uri.parse("mailto:luishalo69@gmail.com")
                            putExtra(Intent.EXTRA_SUBJECT, "Feedback Beta Android BUNKKER ($selectedRole)")
                            putExtra(Intent.EXTRA_TEXT, feedbackNotes)
                        }
                        runCatching { context.startActivity(mailIntent) }
                        feedbackNotes = ""
                        showFeedbackDialog = false
                    }
                ) {
                    Text("Enviar")
                }
            },
            dismissButton = {
                TextButton(onClick = { showFeedbackDialog = false }) {
                    Text("Cancelar")
                }
            }
        )
    }
}
