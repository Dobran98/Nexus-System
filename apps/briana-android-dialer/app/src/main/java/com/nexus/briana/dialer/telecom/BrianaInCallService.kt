package com.nexus.briana.dialer.telecom

import android.content.Intent
import android.telecom.Call
import android.telecom.DisconnectCause
import android.telecom.InCallService
import com.nexus.briana.dialer.data.local.ShiftPreferences
import com.nexus.briana.dialer.data.model.TelemetryPayload
import com.nexus.briana.dialer.data.remote.NexusApiClient
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.time.Instant
import java.util.UUID

data class LiveCallUiState(
    val isInCall: Boolean = false,
    val phoneNumber: String = "",
    val stateLabel: String = "IDLE",
    val isConnected: Boolean = false,
    val activeStartMs: Long? = null
)

class BrianaInCallService : InCallService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var prefs: ShiftPreferences
    private lateinit var apiClient: NexusApiClient

    companion object {
        var activeCallInstance: Call? = null
            private set

        private val _liveState = MutableStateFlow(LiveCallUiState())
        val liveState = _liveState.asStateFlow()

        fun hangupFromPhoneUi() {
            activeCallInstance?.disconnect()
        }
    }

    override fun onCreate() {
        super.onCreate()
        prefs = ShiftPreferences(this)
        apiClient = NexusApiClient(this)
    }

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)
        activeCallInstance = call

        val callUuid = prefs.currentCallUuid ?: UUID.randomUUID().toString()
        val commandId = prefs.currentCommandId
        val contactId = prefs.currentContactId
        val initiatedFrom = prefs.currentInitiatedFrom
        val phoneNumber = call.details?.handle?.schemeSpecificPart ?: "Desconocido"

        val dialingIso = Instant.now().toString()
        var ringingIso: String? = null
        var activeIso: String? = null
        var activeMs: Long? = null
        var wasEverActive = false

        _liveState.value = LiveCallUiState(
            isInCall = true,
            phoneNumber = phoneNumber,
            stateLabel = "DIALING",
            isConnected = false
        )

        call.registerCallback(object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                super.onStateChanged(call, state)
                when (state) {
                    Call.STATE_DIALING -> {
                        _liveState.value = _liveState.value.copy(stateLabel = "DIALING")
                    }
                    Call.STATE_RINGING -> {
                        ringingIso = Instant.now().toString()
                        _liveState.value = _liveState.value.copy(stateLabel = "RINGING")
                        emitTelemetry(
                            callUuid, commandId, contactId, initiatedFrom,
                            state = "RINGING", isConnected = false,
                            dialingAt = dialingIso, ringingAt = ringingIso
                        )
                    }
                    Call.STATE_ACTIVE -> {
                        wasEverActive = true
                        activeMs = System.currentTimeMillis()
                        activeIso = Instant.now().toString()
                        _liveState.value = _liveState.value.copy(
                            stateLabel = "ACTIVE",
                            isConnected = true,
                            activeStartMs = activeMs
                        )
                        emitTelemetry(
                            callUuid, commandId, contactId, initiatedFrom,
                            state = "ACTIVE", isConnected = true,
                            dialingAt = dialingIso, ringingAt = ringingIso, activeAt = activeIso
                        )
                    }
                    Call.STATE_DISCONNECTED -> {
                        val disconnectedIso = Instant.now().toString()
                        val talkSeconds = if (wasEverActive && activeMs != null) {
                            ((System.currentTimeMillis() - activeMs!!) / 1000L).toInt().coerceAtLeast(0)
                        } else 0

                        val cause = call.details?.disconnectCause
                        val causeCode = cause?.code
                        val causeMsg = cause?.reason ?: cause?.label?.toString()

                        val endedBy = when {
                            prefs.pendingHangupFromPc -> "operator_pc"
                            causeCode == DisconnectCause.LOCAL -> "operator_phone"
                            causeCode == DisconnectCause.REMOTE && wasEverActive -> "remote_party"
                            else -> "network_or_no_answer"
                        }

                        emitTelemetry(
                            callUuid = callUuid,
                            commandId = commandId,
                            contactId = contactId,
                            initiatedFrom = initiatedFrom,
                            state = "DISCONNECTED",
                            isConnected = wasEverActive,
                            endedBy = endedBy,
                            dialingAt = dialingIso,
                            ringingAt = ringingIso,
                            activeAt = activeIso,
                            disconnectedAt = disconnectedIso,
                            talkDurationSeconds = talkSeconds,
                            disconnectCode = causeCode,
                            disconnectMsg = causeMsg
                        )

                        prefs.clearCurrentCallContext()
                        activeCallInstance = null
                        _liveState.value = LiveCallUiState(isInCall = false)
                        call.unregisterCallback(this)
                    }
                }
            }
        })
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        if (activeCallInstance == call) {
            activeCallInstance = null
            _liveState.value = LiveCallUiState(isInCall = false)
        }
    }

    private fun emitTelemetry(
        callUuid: String,
        commandId: String?,
        contactId: String?,
        initiatedFrom: String,
        state: String,
        isConnected: Boolean,
        endedBy: String? = null,
        dialingAt: String? = null,
        ringingAt: String? = null,
        activeAt: String? = null,
        disconnectedAt: String? = null,
        talkDurationSeconds: Int = 0,
        disconnectCode: Int? = null,
        disconnectMsg: String? = null
    ) {
        scope.launch {
            apiClient.sendTelemetryOrEnqueue(
                TelemetryPayload(
                    callUuid = callUuid,
                    deviceUid = prefs.deviceUid,
                    commandId = commandId,
                    contactId = contactId,
                    campaignId = prefs.activeCampaignId,
                    operatorId = prefs.activeOperatorId,
                    sessionId = prefs.activeSessionId,
                    state = state,
                    isConnected = isConnected,
                    initiatedFrom = initiatedFrom,
                    endedBy = endedBy,
                    dialingAt = dialingAt,
                    ringingAt = ringingAt,
                    activeAt = activeAt,
                    disconnectedAt = disconnectedAt,
                    talkDurationSeconds = talkDurationSeconds,
                    telecomDisconnectCode = disconnectCode,
                    telecomDisconnectMsg = disconnectMsg
                )
            )
        }
    }
}
