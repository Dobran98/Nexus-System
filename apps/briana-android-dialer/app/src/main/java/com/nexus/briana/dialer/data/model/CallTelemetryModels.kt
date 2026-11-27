package com.nexus.briana.dialer.data.model

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

@Serializable
data class RegisterDeviceRequest(
    val action: String = "register_device",
    val deviceUid: String,
    val model: String,
    val simPhoneNumber: String? = null,
    val carrierName: String? = null,
    val batteryPct: Int,
    val networkType: String,
    val appVersion: String = "1.0.0",
    val isDefaultDialer: Boolean
)

@Serializable
data class CallCommandDto(
    val id: String,
    val session_id: String,
    val device_id: String,
    val contact_id: String? = null,
    val call_uuid: String,
    val command_type: String, // DIAL | HANGUP | END_SHIFT
    val payload: JsonObject? = null,
    val status: String
)

@Serializable
data class TelemetryPayload(
    val callUuid: String,
    val deviceUid: String,
    val commandId: String? = null,
    val contactId: String? = null,
    val campaignId: String? = null,
    val operatorId: String? = null,
    val sessionId: String? = null,
    val state: String, // DIALING | RINGING | ACTIVE | DISCONNECTED
    val isConnected: Boolean = false,
    val initiatedFrom: String = "android_app",
    val endedBy: String? = null,
    val dialingAt: String? = null,
    val ringingAt: String? = null,
    val activeAt: String? = null,
    val disconnectedAt: String? = null,
    val talkDurationSeconds: Int = 0,
    val telecomDisconnectCode: Int? = null,
    val telecomDisconnectMsg: String? = null
)
