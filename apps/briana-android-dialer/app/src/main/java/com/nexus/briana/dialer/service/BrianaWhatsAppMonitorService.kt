package com.nexus.briana.dialer.service

import android.app.Notification
import android.content.Context
import android.media.AudioManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import com.nexus.briana.dialer.data.local.ShiftPreferences
import com.nexus.briana.dialer.data.model.TelemetryPayload
import com.nexus.briana.dialer.data.remote.NexusApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

/**
 * Monitorea llamadas VoIP de WhatsApp / WhatsApp Business mediante la notificación
 * del sistema de categoría llamada + modo de audio, enviando telemetría en vivo
 * al igual que las llamadas SIM.
 */
class BrianaWhatsAppMonitorService : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: ShiftPreferences
    private lateinit var apiClient: NexusApiClient

    private var activeWaCallUuid: String? = null
    private var waDialingIso: String? = null
    private var waRingingIso: String? = null
    private var waActiveIso: String? = null
    private var waActiveMs: Long? = null
    private var waWasConnected = false

    private val whatsappPackages = setOf("com.whatsapp", "com.whatsapp.w4b")

    override fun onCreate() {
        super.onCreate()
        prefs = ShiftPreferences(this)
        apiClient = NexusApiClient(this)
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        if (sbn == null || !prefs.isShiftActive) return
        if (!whatsappPackages.contains(sbn.packageName)) return

        val notification = sbn.notification ?: return
        val isCallCategory = notification.category == Notification.CATEGORY_CALL
        val text = (notification.extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "").lowercase()

        if (!isCallCategory && !text.contains("llam") && !text.contains("call") && !text.contains("marcando")) {
            return
        }

        // Ignorar llamadas entrantes sin respuesta si aún no está saliendo ni conectada
        if (text.contains("llamada entrante") || text.contains("incoming")) return

        if (activeWaCallUuid == null) {
            activeWaCallUuid = prefs.currentCallUuid ?: UUID.randomUUID().toString()
            waDialingIso = Instant.now().toString()
            waRingingIso = Instant.now().toString()
            waWasConnected = false
            waActiveMs = null
            waActiveIso = null

            emitWaTelemetry("RINGING", isConnected = false)
        }

        // Detectar si ya contestaron: WhatsApp cambia el texto al cronómetro (ej. "00:01")
        // o el AudioManager está en MODE_IN_COMMUNICATION con cronómetro activo
        val showsChronometer = notification.extras?.getBoolean(Notification.EXTRA_SHOW_CHRONOMETER, false) == true
        val hasTimerPattern = Regex("\\d{1,2}:\\d{2}").containsMatchIn(text) || showsChronometer
        val audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
        val isInCommAudio = audioManager.mode == AudioManager.MODE_IN_COMMUNICATION

        if (!waWasConnected && (hasTimerPattern || (isInCommAudio && !text.contains("llamando") && !text.contains("calling") && !text.contains("sonando")))) {
            waWasConnected = true
            waActiveMs = System.currentTimeMillis()
            waActiveIso = Instant.now().toString()
            emitWaTelemetry("ACTIVE", isConnected = true)
        }
    }

    override fun onNotificationRemoved(sbn: StatusBarNotification?) {
        if (sbn == null || activeWaCallUuid == null) return
        if (!whatsappPackages.contains(sbn.packageName)) return

        val notification = sbn.notification
        val isCallCategory = notification?.category == Notification.CATEGORY_CALL
        val text = (notification?.extras?.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: "").lowercase()

        if (isCallCategory || text.contains("llam") || text.contains("call") || Regex("\\d{1,2}:\\d{2}").containsMatchIn(text)) {
            val disconnectedIso = Instant.now().toString()
            val talkSeconds = if (waWasConnected && waActiveMs != null) {
                ((System.currentTimeMillis() - waActiveMs!!) / 1000L).toInt().coerceAtLeast(0)
            } else 0

            val endedBy = when {
                prefs.pendingHangupFromPc -> "operator_pc"
                waWasConnected -> "remote_party"
                else -> "network_or_no_answer"
            }

            val uuid = activeWaCallUuid!!
            val cmdId = prefs.currentCommandId
            val contactId = prefs.currentContactId
            val initiatedFrom = prefs.currentInitiatedFrom

            scope.launch {
                apiClient.sendTelemetryOrEnqueue(
                    TelemetryPayload(
                        callUuid = uuid,
                        deviceUid = prefs.deviceUid,
                        commandId = cmdId,
                        contactId = contactId,
                        campaignId = prefs.activeCampaignId,
                        operatorId = prefs.activeOperatorId,
                        sessionId = prefs.activeSessionId,
                        state = "DISCONNECTED",
                        callChannel = "whatsapp",
                        isConnected = waWasConnected,
                        initiatedFrom = initiatedFrom,
                        endedBy = endedBy,
                        dialingAt = waDialingIso,
                        ringingAt = waRingingIso,
                        activeAt = waActiveIso,
                        disconnectedAt = disconnectedIso,
                        talkDurationSeconds = talkSeconds
                    )
                )
            }

            prefs.clearCurrentCallContext()
            activeWaCallUuid = null
            waWasConnected = false
            waActiveMs = null
        }
    }

    private fun emitWaTelemetry(state: String, isConnected: Boolean) {
        val uuid = activeWaCallUuid ?: return
        scope.launch {
            apiClient.sendTelemetryOrEnqueue(
                TelemetryPayload(
                    callUuid = uuid,
                    deviceUid = prefs.deviceUid,
                    commandId = prefs.currentCommandId,
                    contactId = prefs.currentContactId,
                    campaignId = prefs.activeCampaignId,
                    operatorId = prefs.activeOperatorId,
                    sessionId = prefs.activeSessionId,
                    state = state,
                    callChannel = "whatsapp",
                    isConnected = isConnected,
                    initiatedFrom = prefs.currentInitiatedFrom,
                    dialingAt = waDialingIso,
                    ringingAt = waRingingIso,
                    activeAt = waActiveIso
                )
            )
        }
    }
}
