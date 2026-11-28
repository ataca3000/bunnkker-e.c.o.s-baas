package com.bunkker.ecos.hybridai

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
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
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
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
    val engine = remember { BunkkerHybridAiEngine(context) }
    val scope = rememberCoroutineScope()

    var selectedRole by remember { mutableStateOf("driver") }
    var prompt by remember { mutableStateOf("Resume prioridades de entrega PoD y stock crítico.") }
    var loading by remember { mutableStateOf(false) }
    var outcome by remember { mutableStateOf<HybridInferenceOutcome?>(null) }

    var showWelcomeGuide by remember { mutableStateOf(true) }
    var welcomeStep by remember { mutableIntStateOf(0) }
    var showFeedbackDialog by remember { mutableStateOf(false) }
    var feedbackNotes by remember { mutableStateOf("") }

    val welcomeSteps = listOf(
        "1. Elige tu rol (Reparto, Almacén o Caja) para probar sin configurar empresa.",
        "2. Ejecuta Inferencia On-Device: funciona incluso en un celular limpio sin Wi-Fi local.",
        "3. Si detectas alguna falla durante las pruebas, toca \"Reportar falla\" abajo."
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
                text = "BUNKKER E.C.O.S. · Android Híbrido",
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold
            )
            Text(
                text = "Firebase AI Logic (Gemini Nano 4 On-Device + Cloud Fallback)",
                style = MaterialTheme.typography.bodySmall
            )

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
                                    Text("Probar Demo")
                                }
                            }
                            TextButton(onClick = { showWelcomeGuide = false }) {
                                Text("Saltar")
                            }
                        }
                    }
                }
            }

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

            Spacer(modifier = Modifier.height(8.dp))

            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { showFeedbackDialog = true }) {
                    Text("Reportar falla")
                }
                TextButton(onClick = { uriHandler.openUri("$PROD_WEB_BASE/login") }) {
                    Text("Abrir ERP Web")
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
