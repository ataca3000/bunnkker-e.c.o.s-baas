package com.bunkker.ecos.hybridai

import android.content.Context
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import com.google.firebase.Firebase
import com.google.firebase.ai.GenerativeModel
import com.google.firebase.ai.ai
import com.google.firebase.ai.ondevice.OnDeviceConfig
import com.google.firebase.ai.type.GenerativeBackend
import com.google.firebase.ai.type.InferenceMode
import com.google.firebase.ai.type.InferenceSource
import com.google.firebase.ai.type.content
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

enum class HybridSource {
    ON_DEVICE,
    IN_CLOUD,
    LOCAL_FALLBACK
}

data class HybridInferenceOutcome(
    val text: String,
    val source: HybridSource,
    val modelName: String,
    val latencyMs: Long,
    val requestedMode: InferenceMode,
    val note: String? = null
)

/**
 * Motor híbrido oficial para Android usando Firebase AI Logic SDK (Gemini Nano 4 On-Device + Gemini Cloud Fallback).
 * Espeja el comportamiento de `src/lib/firebaseAiLogic.ts` de la app Web.
 */
class BunkkerHybridAiEngine(
    private val context: Context,
    private val cloudModelName: String = "gemini-2.5-flash"
) {
    private val firebaseAi by lazy {
        Firebase.ai(backend = GenerativeBackend.googleAI())
    }

    private fun buildModel(
        mode: InferenceMode,
        systemInstruction: String
    ): GenerativeModel {
        return firebaseAi.generativeModel(
            modelName = cloudModelName,
            systemInstruction = content { text(systemInstruction) },
            onDeviceConfig = OnDeviceConfig(mode = mode)
        )
    }

    fun isNetworkAvailable(): Boolean {
        val cm = context.getSystemService(Context.CONNECTIVITY_SERVICE) as? ConnectivityManager
            ?: return false
        val network = cm.activeNetwork ?: return false
        val caps = cm.getNetworkCapabilities(network) ?: return false
        return caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)
    }

    suspend fun runOperationalPrompt(
        prompt: String,
        role: String = "driver",
        preferCloudForLargeDoc: Boolean = false
    ): HybridInferenceOutcome = withContext(Dispatchers.IO) {
        val started = System.currentTimeMillis()
        val mode = if (preferCloudForLargeDoc) {
            InferenceMode.PREFER_IN_CLOUD
        } else {
            InferenceMode.PREFER_ON_DEVICE
        }

        val roleInstruction = when (role.lowercase()) {
            "inventory", "warehouse" ->
                "Eres LION en Almacén de BUNKKER E.C.O.S. Resume existencias, ubicaciones y stock crítico en español."
            "sales", "cashier" ->
                "Eres LION en Caja de BUNKKER E.C.O.S. Resume cobros y validaciones en español."
            else ->
                "Eres LION en Ruta/Reparto de BUNKKER E.C.O.S. Asiste con entregas PoD y notas offline en español."
        }

        try {
            val model = buildModel(mode = mode, systemInstruction = roleInstruction)
            val response = model.generateContent(prompt)
            val replyText = response.text?.trim().orEmpty()
            val latency = System.currentTimeMillis() - started

            if (replyText.isNotEmpty()) {
                val isOnDevice = response.inferenceSource == InferenceSource.ON_DEVICE
                return@withContext HybridInferenceOutcome(
                    text = replyText,
                    source = if (isOnDevice) HybridSource.ON_DEVICE else HybridSource.IN_CLOUD,
                    modelName = if (isOnDevice) "gemini-nano-4-on-device" else cloudModelName,
                    latencyMs = latency,
                    requestedMode = mode
                )
            }
        } catch (err: Exception) {
            val latency = System.currentTimeMillis() - started
            return@withContext HybridInferenceOutcome(
                text = buildOfflineDeterministicReply(prompt, role),
                source = HybridSource.LOCAL_FALLBACK,
                modelName = "bunkker-android-local-rules",
                latencyMs = latency,
                requestedMode = mode,
                note = err.message
            )
        }

        val latency = System.currentTimeMillis() - started
        HybridInferenceOutcome(
            text = buildOfflineDeterministicReply(prompt, role),
            source = HybridSource.LOCAL_FALLBACK,
            modelName = "bunkker-android-local-rules",
            latencyMs = latency,
            requestedMode = mode
        )
    }

    private fun buildOfflineDeterministicReply(prompt: String, role: String): String {
        val lower = prompt.lowercase()
        return when {
            "stock" in lower || "almac" in lower ->
                "Modo local Android ($role): revisa productos con <5 piezas en bodega antes del próximo surtido."
            "ruta" in lower || "entreg" in lower ->
                "Modo local Android ($role): captura fotografía y firma del cliente para sellar la entrega PoD."
            else ->
                "Asistente local BUNKKER E.C.O.S. ($role) listo offline. En cuanto haya red o Gemini Nano 4 activo, las respuestas usarán inferencia generativa."
        }
    }
}
