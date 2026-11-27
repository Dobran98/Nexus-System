package com.nexus.briana.dialer.data.remote

import android.content.Context
import com.nexus.briana.dialer.data.local.BrianaDatabase
import com.nexus.briana.dialer.data.local.PendingTelemetryEntity
import com.nexus.briana.dialer.data.local.ShiftPreferences
import com.nexus.briana.dialer.data.model.CallCommandDto
import com.nexus.briana.dialer.data.model.RegisterDeviceRequest
import com.nexus.briana.dialer.data.model.TelemetryPayload
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

data class HeartbeatResult(
    val pairingPin: String,
    val sessionId: String?,
    val operatorId: String?,
    val operatorName: String?,
    val campaignId: String?,
    val commands: List<CallCommandDto>
)

class NexusApiClient(context: Context) {
    private val prefs = ShiftPreferences(context)
    private val dao = BrianaDatabase.getInstance(context).pendingTelemetryDao()
    private val json = Json { ignoreUnknownKeys = true }
    private val mediaType = "application/json; charset=utf-8".toMediaType()

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .build()

    suspend fun registerAndHeartbeat(reqData: RegisterDeviceRequest): HeartbeatResult? = withContext(Dispatchers.IO) {
        try {
            val bodyStr = json.encodeToString(reqData)
            val request = Request.Builder()
                .url("${prefs.baseUrl}/api/briana/pairing")
                .post(bodyStr.toRequestBody(mediaType))
                .build()

            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return@withContext null
                val raw = response.body?.string() ?: return@withContext null
                val root = json.parseToJsonElement(raw).jsonObject
                val device = root["device"]?.jsonObject
                val pin = device?.get("pairing_pin")?.jsonPrimitive?.content ?: prefs.pairingPin

                val activeSess = root["activeSession"]?.let { elem ->
                    if (elem.toString() == "null") null else elem.jsonObject
                }
                val sessId = activeSess?.get("id")?.jsonPrimitive?.content
                val opId = activeSess?.get("operator_id")?.jsonPrimitive?.content
                val campId = activeSess?.get("campaign_id")?.let {
                    if (it.toString() == "null") null else it.jsonPrimitive.content
                }
                val opName = activeSess?.get("profiles")?.let {
                    if (it.toString() == "null") null else it.jsonObject["full_name"]?.jsonPrimitive?.content
                }

                val commandsJson = root["pendingCommands"]?.jsonArray ?: emptyList()
                val commands = commandsJson.map { json.decodeFromJsonElement(CallCommandDto.serializer(), it) }

                HeartbeatResult(pin, sessId, opId, opName, campId, commands)
            }
        } catch (_: Exception) {
            null
        }
    }

    suspend fun sendTelemetryOrEnqueue(payload: TelemetryPayload) = withContext(Dispatchers.IO) {
        val payloadJson = json.encodeToString(payload)
        if (!postRawTelemetry(payloadJson)) {
            dao.enqueue(PendingTelemetryEntity(payloadJson = payloadJson))
        } else {
            flushOutbox()
        }
    }

    suspend fun flushOutbox() = withContext(Dispatchers.IO) {
        val batch = dao.getBatch()
        for (item in batch) {
            if (postRawTelemetry(item.payloadJson)) {
                dao.deleteById(item.id)
            } else {
                break
            }
        }
    }

    private fun postRawTelemetry(payloadJson: String): Boolean {
        return try {
            val request = Request.Builder()
                .url("${prefs.baseUrl}/api/briana/telemetry")
                .post(payloadJson.toRequestBody(mediaType))
                .build()
            client.newCall(request).execute().use { it.isSuccessful }
        } catch (_: Exception) {
            false
        }
    }
}
